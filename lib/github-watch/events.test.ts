import { expect, it } from "vitest";
import { actionableSummary } from "./events.js";
import type { Snapshot } from "./state.js";

const base: Snapshot = {
  headSha: "head", baseSha: "base", state: "OPEN", isDraft: false,
  reviewDecision: null, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN",
  comments: [], reviews: [], threads: [], checks: [],
};

it("does not wake for initial snapshots or routine progress", () => {
  expect(actionableSummary(undefined, base)).toBeUndefined();
  expect(actionableSummary(base, { ...base, headSha: "next" })).toBeUndefined();
  expect(actionableSummary(base, { ...base, checks: [{ name: "build", status: "IN_PROGRESS" }] })).toBeUndefined();
  expect(actionableSummary(base, { ...base, isDraft: true })).toBeUndefined();
});

it("summarizes only new or edited actionable feedback", () => {
  const withComment = { ...base, comments: [{ id: 1, body: "fix this" }] };
  expect(actionableSummary(base, withComment)).toBe("New or updated feedback: 1 comment.");
  expect(actionableSummary(withComment, withComment)).toBeUndefined();
  expect(actionableSummary(withComment, { ...withComment, comments: [{ id: 1, body: "edited" }] })).toContain("1 comment");
  expect(actionableSummary(base, { ...base, reviews: [{ id: 1, state: "APPROVED" }] })).toBeUndefined();
  expect(actionableSummary(base, { ...base, reviews: [{ id: 1, state: "CHANGES_REQUESTED" }] })).toContain("1 review");
  expect(actionableSummary(base, { ...base, threads: [{ id: 1, isResolved: true, comments: [] }] })).toBeUndefined();
  expect(actionableSummary(base, { ...base, threads: [{ id: 1, isResolved: false, isOutdated: false, comments: [] }] })).toContain("1 unresolved thread");
});

it("summarizes a failing check once per head", () => {
  const failed = { ...base, checks: [{ name: "build", status: "COMPLETED", conclusion: "FAILURE" }] };
  expect(actionableSummary(base, failed)).toBe("CI failed: build.");
  expect(actionableSummary(failed, failed)).toBeUndefined();
  expect(actionableSummary(failed, { ...failed, headSha: "next" })).toBe("CI failed: build.");
});

it("wakes for conflicts, verified-ready candidates, and merges", () => {
  const conflict = { ...base, mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" };
  expect(actionableSummary(base, conflict)).toBe("PR has merge conflicts.");
  expect(actionableSummary(conflict, conflict)).toBeUndefined();
  const ready = { ...base, reviewDecision: "APPROVED" };
  expect(actionableSummary(base, ready)).toContain("may be ready to merge");
  expect(actionableSummary(base, { ...base, state: "MERGED" })).toBe("PR merged.");
});
