import { it, expect, vi } from "vitest";
import { fetchSnapshot } from "./github.js";
import { Store } from "./state.js";
const target = { repo: "org/server", pr: 742 };
const pr = { headRefOid: "abc", baseRefOid: "base", state: "OPEN", isDraft: false, reviewDecision: "APPROVED", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", statusCheckRollup: [] };
it("paginates threads and replies and preserves empty review state", async () => {
  const read = vi.fn(async (args: string[]) => {
    if (args[0] === "pr") return pr;
    if (args.includes("--slurp")) return args.at(-1)!.includes("/reviews") ? [[{ id: 1, state: "APPROVED", body: "", user: { login: "bot" } }]] : [[]];
    if (args.some(arg => arg.startsWith("id="))) return { data: { node: { comments: { nodes: [{ id: "reply", body: "reply" }], pageInfo: { hasNextPage: false } } } } };
    const second = args.includes("cursor=next");
    return { data: { repository: { pullRequest: { reviewThreads: {
      nodes: second ? [] : [{ id: "thread", isResolved: false, comments: { nodes: [{ id: "comment", body: "fix" }], pageInfo: { hasNextPage: true, endCursor: "reply-next" } } }],
      pageInfo: { hasNextPage: !second, endCursor: second ? null : "next" },
    } } } } };
  });
  const snapshot = await fetchSnapshot(target, read);
  expect(snapshot.reviews[0]).toMatchObject({ state: "APPROVED", body: "", author: "bot" });
  expect((snapshot.threads[0] as any).comments).toHaveLength(2);
  expect(read.mock.calls.some(([args]) => args.includes("cursor=next"))).toBe(true);
});
it("tracks mergeability, approval, and draft changes even without new feedback or CI", async () => {
  let metadata = { ...pr };
  const read = vi.fn(async (args: string[]) => {
    if (args[0] === "pr") return metadata;
    if (args.includes("--slurp")) return [[]];
    return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
  });
  const store = new Store("/unused");
  const initial = await fetchSnapshot(target, read);
  expect(initial).toMatchObject({ baseSha: "base", isDraft: false, reviewDecision: "APPROVED", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" });
  expect(read.mock.calls[0][0].at(-1)).toContain("mergeable,mergeStateStatus");
  expect(store.update(target, initial).revision).toBe(1);
  for (const change of [{ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }, { reviewDecision: "CHANGES_REQUESTED" }, { isDraft: true }]) {
    metadata = { ...metadata, ...change };
    const next = await fetchSnapshot(target, read);
    expect(store.update(target, next).revision).toBeGreaterThan(1);
    expect(next).toMatchObject(change);
  }
});
it("rejects snapshots mixed across a base branch update", async () => {
  let prReads = 0;
  const read = async (args: string[]) => {
    if (args[0] === "pr") return { ...pr, baseRefOid: ++prReads === 1 ? "base" : "new-base" };
    if (args.includes("--slurp")) return [[]];
    return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
  };
  await expect(fetchSnapshot(target, read)).rejects.toThrow("changed during reconciliation");
});
it("rejects partial GraphQL results rather than deleting cached feedback", async () => {
  const read = async (args: string[]) => args[0] === "pr" ? pr : args.includes("--slurp") ? [[]] : { errors: [{ message: "rate limit" }] };
  await expect(fetchSnapshot(target, read)).rejects.toThrow("partial GraphQL");
});
it("rejects snapshots mixed across a concurrent push", async () => {
  let prReads = 0;
  const read = async (args: string[]) => {
    if (args[0] === "pr") return { ...pr, headRefOid: ++prReads === 1 ? "abc" : "new" };
    if (args.includes("--slurp")) return [[]];
    return { data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } } } } } };
  };
  await expect(fetchSnapshot(target, read)).rejects.toThrow("changed during reconciliation");
});
