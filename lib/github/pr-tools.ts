import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatPr, formatPrList, formatChecks } from "./format.js";

const DEFAULT_VIEW_FIELDS =
  "number,title,url,state,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,body";

function getCwd(ctx?: { cwd?: string }): string {
  return ctx?.cwd ?? process.cwd();
}

function repoFlag(args: string[], repo?: string): void {
  if (repo) args.push("--repo", repo);
}

function success(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details: details ?? {} };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true as const, details: {} };
}

const PrAction = Type.Union([
  Type.Literal("create"),
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("checks"),
  Type.Literal("merge"),
  Type.Literal("comment"),
  Type.Literal("close"),
  Type.Literal("reopen"),
  Type.Literal("review"),
  Type.Literal("diff"),
]);

export default function registerPrTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_pr",
    label: "GitHub Pull Request",
    description:
      "Perform a GitHub pull request operation: create, list, view, checks, merge, comment, close, reopen, review, or diff",
    parameters: Type.Object({
      action: PrAction,
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
      number: Type.Optional(
        Type.Union([Type.String(), Type.Number()], {
          description: "PR number, branch name, or URL",
        }),
      ),
      title: Type.Optional(Type.String({ description: "PR title (for create)" })),
      body: Type.Optional(
        Type.String({ description: "Markdown body (for create, comment, or review)" }),
      ),
      base: Type.Optional(Type.String({ description: "Base branch to merge into (create)" })),
      head: Type.Optional(Type.String({ description: "Head branch with changes (create)" })),
      draft: Type.Optional(Type.Boolean({ description: "Create as draft", default: false })),
      label: Type.Optional(
        Type.String({ description: "Labels to add or filter, comma-separated (create/list)" }),
      ),
      assignee: Type.Optional(Type.String({ description: "Assignee login (create/list)" })),
      reviewer: Type.Optional(
        Type.String({ description: "Reviewer login, comma-separated (create)" }),
      ),
      milestone: Type.Optional(Type.String({ description: "Milestone name (create)" })),
      method: Type.Optional(
        Type.String({ description: "Merge method: merge, squash, rebase", default: "merge" }),
      ),
      auto: Type.Optional(
        Type.Boolean({ description: "Enable auto-merge (merge)", default: false }),
      ),
      deleteBranch: Type.Optional(
        Type.Boolean({ description: "Delete branch after merging (merge)", default: false }),
      ),
      comment: Type.Optional(
        Type.String({ description: "Optional closing comment (close)" }),
      ),
      required: Type.Optional(
        Type.Boolean({ description: "Only required checks (checks)", default: false }),
      ),
      fields: Type.Optional(
        Type.String({
          description: "Comma-separated JSON fields (view)",
          default: DEFAULT_VIEW_FIELDS,
        }),
      ),
      reviewAction: Type.Optional(
        Type.String({
          description: "Review action: approve, request-changes, comment (review)",
          default: "comment",
        }),
      ),
      state: Type.Optional(
        Type.String({
          description: "Filter by state: open, closed, merged, all (list)",
          default: "open",
        }),
      ),
      author: Type.Optional(Type.String({ description: "Filter by author login (list)" })),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of results (list)", default: 30 }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const action = params.action as string;

        if (action === "create") {
          if (!params.title) {
            return errorResult(new Error("title is required for create"));
          }
          const args = ["pr", "create", "--title", params.title];
          if (params.body) {
            args.push("--body", params.body);
          } else {
            args.push("--fill");
          }
          if (params.base) args.push("--base", params.base);
          if (params.head) args.push("--head", params.head);
          if (params.draft) args.push("--draft");
          if (params.label) {
            for (const label of params.label
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)) {
              args.push("--label", label);
            }
          }
          if (params.assignee) args.push("--assignee", params.assignee);
          if (params.reviewer) {
            for (const reviewer of params.reviewer
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)) {
              args.push("--reviewer", reviewer);
            }
          }
          if (params.milestone) args.push("--milestone", params.milestone);
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          const url =
            result.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? result.stdout;

          return success(`Created pull request: ${url}`, { url, stdout: result.stdout });
        }

        if (action === "list") {
          const args = [
            "pr",
            "list",
            "--json",
            "number,title,state,author,isDraft,headRefName,baseRefName",
          ];
          args.push("--state", (params.state as string) ?? "open");
          args.push("--limit", String((params.limit as number) ?? 30));
          if (params.label) args.push("--label", params.label);
          if (params.author) args.push("--author", params.author);
          if (params.assignee) args.push("--assignee", params.assignee);
          if (params.base) args.push("--base", params.base);
          if (params.head) args.push("--head", params.head);
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatPrList(data as any[]), { prs: data });
        }

        if (action === "view") {
          const args = ["pr", "view"];
          if (params.number) args.push(String(params.number));
          args.push("--json", (params.fields as string) ?? DEFAULT_VIEW_FIELDS);
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatPr(data), { pr: data });
        }

        if (action === "checks") {
          const args = ["pr", "checks"];
          if (params.number) args.push(String(params.number));
          if (params.required) args.push("--required");
          args.push("--json", "name,state,bucket,completedAt,link");
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          const checks = result.stdout ? JSON.parse(result.stdout) : [];
          return success(formatChecks(checks, result.exitCode), {
            checks,
            exitCode: result.exitCode,
          });
        }

        if (action === "merge") {
          if (!params.number) {
            return errorResult(new Error("number is required for merge"));
          }
          const args = ["pr", "merge", String(params.number)];
          if (params.auto) {
            args.push("--auto");
            if (params.method) args.push(`--${params.method}`);
          } else {
            args.push(`--${(params.method as string) ?? "merge"}`);
          }
          if (params.deleteBranch) args.push("--delete-branch");
          if (params.body) args.push("--body", params.body);
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Merged PR #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "comment") {
          if (!params.number) {
            return errorResult(new Error("number is required for comment"));
          }
          if (!params.body) {
            return errorResult(new Error("body is required for comment"));
          }
          const args = ["pr", "comment", String(params.number), "--body", params.body];
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Commented on PR #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "close") {
          if (!params.number) {
            return errorResult(new Error("number is required for close"));
          }
          const args = ["pr", "close", String(params.number)];
          if (params.comment) args.push("--comment", params.comment);
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Closed PR #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "reopen") {
          if (!params.number) {
            return errorResult(new Error("number is required for reopen"));
          }
          const args = ["pr", "reopen", String(params.number)];
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Reopened PR #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "review") {
          if (!params.number) {
            return errorResult(new Error("number is required for review"));
          }
          const args = [
            "pr",
            "review",
            String(params.number),
            `--${(params.reviewAction as string) ?? "comment"}`,
          ];
          if (params.body) args.push("--body", params.body);
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Reviewed PR #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "diff") {
          if (!params.number) {
            return errorResult(new Error("number is required for diff"));
          }
          const args = ["pr", "diff", String(params.number)];
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || "No diff output.", { stdout: result.stdout });
        }

        return errorResult(new Error(`Unknown PR action: ${action}`));
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
