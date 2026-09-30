import { execFile } from "node:child_process";
import type { Snapshot, Target } from "./state.js";

type Json = Record<string, any>;
export type GhReader = (args: string[]) => Promise<any>;
export const ghJson: GhReader = args => new Promise((resolve, reject) => {
  execFile("gh", args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr.trim() || error.message));
    try { resolve(JSON.parse(stdout)); } catch { reject(new Error("Invalid JSON returned by gh")); }
  });
});
const fields = (row: Json, names: string[]): Json => Object.fromEntries(names.map(name => [name, row[name] ?? null]));
const sorted = (rows: Json[]): Json[] => rows.sort((a, b) => String(a.id ?? JSON.stringify(a)).localeCompare(String(b.id ?? JSON.stringify(b))));

/** A complete read succeeds as a unit; partial reads never replace a good snapshot. */
export async function fetchSnapshot(target: Target, read: GhReader = ghJson): Promise<Snapshot> {
  const prefix = `repos/${target.repo}`;
  const pages = async (endpoint: string): Promise<Json[]> => {
    const result = await read(["api", "--hostname", "github.com", "--paginate", "--slurp", endpoint]);
    if (!Array.isArray(result) || !result.every(Array.isArray)) throw new Error("Incomplete GitHub pagination result");
    return result.flat();
  };
  const [pr, comments, reviews] = await Promise.all([
    read(["pr", "view", `https://github.com/${target.repo}/pull/${target.pr}`, "--json", "headRefOid,state,statusCheckRollup"]),
    pages(`${prefix}/issues/${target.pr}/comments?per_page=100`),
    pages(`${prefix}/pulls/${target.pr}/reviews?per_page=100`),
  ]);
  if (typeof pr.headRefOid !== "string" || !["OPEN", "MERGED", "CLOSED"].includes(pr.state) || (pr.statusCheckRollup !== null && !Array.isArray(pr.statusCheckRollup))) throw new Error("Incomplete PR metadata/check rollup");
  const [owner, repo] = target.repo.split("/");
  const threads: Json[] = [];
  let cursor: string | undefined;
  do {
    const query = `query($owner:String!,$repo:String!,$pr:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviewThreads(first:100,after:$cursor){nodes{id isResolved isOutdated path line comments(first:100){nodes{id body createdAt updatedAt url author{login}} pageInfo{hasNextPage endCursor}}} pageInfo{hasNextPage endCursor}}}}}`;
    const args = ["api", "--hostname", "github.com", "graphql", "-f", `query=${query}`, "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `pr=${target.pr}`];
    if (cursor) args.push("-f", `cursor=${cursor}`);
    const result = await read(args);
    if (result.errors?.length) throw new Error("GitHub returned partial GraphQL data");
    const connection = result.data?.repository?.pullRequest?.reviewThreads;
    if (!connection?.nodes || !connection.pageInfo) throw new Error("Missing review threads");
    for (const thread of connection.nodes) {
      let commentCursor = thread.comments.pageInfo.hasNextPage ? thread.comments.pageInfo.endCursor : undefined;
      const allComments = [...thread.comments.nodes];
      while (commentCursor) {
        const next = await read(["api", "--hostname", "github.com", "graphql", "-f", "query=query($id:ID!,$cursor:String!){node(id:$id){... on PullRequestReviewThread{comments(first:100,after:$cursor){nodes{id body createdAt updatedAt url author{login}} pageInfo{hasNextPage endCursor}}}}}", "-f", `id=${thread.id}`, "-f", `cursor=${commentCursor}`]);
        const page = next.data?.node?.comments;
        if (next.errors?.length || !page?.nodes || !page.pageInfo) throw new Error("Incomplete thread comments");
        allComments.push(...page.nodes);
        const previous = commentCursor;
        commentCursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined;
        if (page.pageInfo.hasNextPage && (!commentCursor || commentCursor === previous)) throw new Error("Invalid comment pagination cursor");
      }
      threads.push({ ...thread, comments: sorted(allComments) });
    }
    const previous = cursor;
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : undefined;
    if (connection.pageInfo.hasNextPage && (!cursor || cursor === previous)) throw new Error("Invalid thread pagination cursor");
  } while (cursor);
  // Prevent mixed-head snapshots after a concurrent push. The next poll retries.
  const latest = await read(["pr", "view", `https://github.com/${target.repo}/pull/${target.pr}`, "--json", "headRefOid,state"]);
  if (latest.headRefOid !== pr.headRefOid || latest.state !== pr.state) throw new Error("PR changed during reconciliation; retrying next poll");
  return {
    headSha: pr.headRefOid, state: pr.state,
    comments: sorted(comments.map(row => ({ ...fields(row, ["id", "body", "created_at", "updated_at", "html_url"]), author: row.user?.login }))),
    reviews: sorted(reviews.map(row => ({ ...fields(row, ["id", "body", "state", "submitted_at", "commit_id", "html_url"]), author: row.user?.login }))),
    threads: sorted(threads),
    checks: sorted((pr.statusCheckRollup ?? []).map((row: Json) => fields(row, ["__typename", "name", "context", "status", "conclusion", "state", "detailsUrl", "targetUrl", "startedAt", "completedAt", "workflowName"]))),
  };
}
