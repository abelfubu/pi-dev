import { describe, it, expect } from "vitest";
import { prToolConfig } from "./pr-tools.js";

const ctx = { cwd: "/tmp/repo" };

describe("prToolConfig", () => {
  it("has the expected tool metadata", () => {
    expect(prToolConfig.name).toBe("gh_pr");
    expect(prToolConfig.label).toBe("GitHub Pull Request");
    expect(prToolConfig.description).toContain("create, list, view");
  });

  describe("create", () => {
    const handler = prToolConfig.handlers.create;

    it("throws when title is missing", () => {
      expect(() => handler.buildArgs({ action: "create" } as any, ctx)).toThrow(
        "title is required for create",
      );
    });

    it("builds minimal args with --fill", () => {
      const args = handler.buildArgs({ action: "create", title: "Fix bug" } as any, ctx);
      expect(args).toEqual(["pr", "create", "--title", "Fix bug", "--fill"]);
    });

    it("builds args with body", () => {
      const args = handler.buildArgs(
        { action: "create", title: "Fix bug", body: "Details" } as any,
        ctx,
      );
      expect(args).toEqual(["pr", "create", "--title", "Fix bug", "--body", "Details"]);
    });

    it("splits multiple labels and reviewers", () => {
      const args = handler.buildArgs(
        {
          action: "create",
          title: "Fix bug",
          label: "bug, urgent",
          reviewer: "alice, bob",
        } as any,
        ctx,
      );
      expect(args).toEqual([
        "pr",
        "create",
        "--title",
        "Fix bug",
        "--fill",
        "--label",
        "bug",
        "--label",
        "urgent",
        "--reviewer",
        "alice",
        "--reviewer",
        "bob",
      ]);
    });

    it("formats stdout into a created URL", () => {
      const text = handler.format(
        { stdout: "https://github.com/owner/repo/pull/42", stderr: "", exitCode: 0 },
        { action: "create", title: "Fix" } as any,
        ctx,
      );
      expect(text).toBe("Created pull request: https://github.com/owner/repo/pull/42");
    });
  });

  describe("list", () => {
    const handler = prToolConfig.handlers.list;

    it("uses default state and limit", () => {
      const args = handler.buildArgs({ action: "list" } as any, ctx);
      expect(args).toEqual([
        "pr",
        "list",
        "--json",
        "number,title,state,author,isDraft,headRefName,baseRefName",
        "--state",
        "open",
        "--limit",
        "30",
      ]);
    });

    it("applies filters", () => {
      const args = handler.buildArgs(
        {
          action: "list",
          state: "closed",
          limit: 5,
          label: "bug",
          author: "alice",
          assignee: "bob",
          base: "main",
          head: "feature",
        } as any,
        ctx,
      );
      expect(args).toEqual([
        "pr",
        "list",
        "--json",
        "number,title,state,author,isDraft,headRefName,baseRefName",
        "--state",
        "closed",
        "--limit",
        "5",
        "--label",
        "bug",
        "--author",
        "alice",
        "--assignee",
        "bob",
        "--base",
        "main",
        "--head",
        "feature",
      ]);
    });

    it("formats a list of PRs", () => {
      const text = handler.format(
        [
          {
            number: 1,
            title: "PR one",
            state: "OPEN",
            isDraft: false,
            author: { login: "alice" },
          },
        ] as any,
        { action: "list" } as any,
        ctx,
      );
      expect(text).toContain("#1");
      expect(text).toContain("PR one");
      expect(text).toContain("alice");
    });
  });

  describe("view", () => {
    const handler = prToolConfig.handlers.view;

    it("builds args with default fields", () => {
      const args = handler.buildArgs({ action: "view", number: 42 } as any, ctx);
      expect(args).toEqual([
        "pr",
        "view",
        "42",
        "--json",
        "number,title,url,state,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,body",
      ]);
    });

    it("builds args without number", () => {
      const args = handler.buildArgs({ action: "view" } as any, ctx);
      expect(args).toEqual([
        "pr",
        "view",
        "--json",
        "number,title,url,state,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,body",
      ]);
    });

    it("formats a PR", () => {
      const text = handler.format(
        { number: 42, title: "T", url: "https://example.com", state: "OPEN" } as any,
        { action: "view" } as any,
        ctx,
      );
      expect(text).toContain("#42");
      expect(text).toContain("T");
    });
  });

  describe("checks", () => {
    const handler = prToolConfig.handlers.checks;

    it("builds args with required flag", () => {
      const args = handler.buildArgs({ action: "checks", number: 42, required: true } as any, ctx);
      expect(args).toEqual([
        "pr",
        "checks",
        "42",
        "--required",
        "--json",
        "name,state,bucket,completedAt,link",
      ]);
    });

    it("formats checks with exit code 0", () => {
      const text = handler.format(
        { stdout: '[{"name":"test","state":"SUCCESS","bucket":"pass"}]', stderr: "", exitCode: 0 },
        { action: "checks" } as any,
        ctx,
      );
      expect(text).toContain("✅");
      expect(text).toContain("test");
    });

    it("formats pending checks with exit code 8", () => {
      const text = handler.format(
        { stdout: "", stderr: "", exitCode: 8 },
        { action: "checks" } as any,
        ctx,
      );
      expect(text).toBe("Checks are pending.");
    });
  });

  describe("merge", () => {
    const handler = prToolConfig.handlers.merge;

    it("throws when number is missing", () => {
      expect(() => handler.buildArgs({ action: "merge" } as any, ctx)).toThrow(
        "number is required for merge",
      );
    });

    it("builds default merge args", () => {
      const args = handler.buildArgs({ action: "merge", number: 42 } as any, ctx);
      expect(args).toEqual(["pr", "merge", "42", "--merge"]);
    });

    it("builds auto-merge with squash", () => {
      const args = handler.buildArgs(
        { action: "merge", number: 42, auto: true, method: "squash", deleteBranch: true } as any,
        ctx,
      );
      expect(args).toEqual(["pr", "merge", "42", "--auto", "--squash", "--delete-branch"]);
    });

    it("formats stdout fallback", () => {
      const text = handler.format(
        { stdout: "Merged.", stderr: "", exitCode: 0 },
        { action: "merge", number: 42 } as any,
        ctx,
      );
      expect(text).toBe("Merged.");
    });
  });

  describe("comment", () => {
    const handler = prToolConfig.handlers.comment;

    it("throws when required params are missing", () => {
      expect(() => handler.buildArgs({ action: "comment" } as any, ctx)).toThrow("number");
      expect(() =>
        handler.buildArgs({ action: "comment", number: 42 } as any, ctx),
      ).toThrow("body");
    });

    it("builds args", () => {
      const args = handler.buildArgs(
        { action: "comment", number: 42, body: "LGTM" } as any,
        ctx,
      );
      expect(args).toEqual(["pr", "comment", "42", "--body", "LGTM"]);
    });
  });

  describe("close", () => {
    const handler = prToolConfig.handlers.close;

    it("builds args with optional comment", () => {
      const args = handler.buildArgs(
        { action: "close", number: 42, comment: "Done" } as any,
        ctx,
      );
      expect(args).toEqual(["pr", "close", "42", "--comment", "Done"]);
    });
  });

  describe("reopen", () => {
    const handler = prToolConfig.handlers.reopen;

    it("builds args", () => {
      const args = handler.buildArgs({ action: "reopen", number: 42 } as any, ctx);
      expect(args).toEqual(["pr", "reopen", "42"]);
    });
  });

  describe("review", () => {
    const handler = prToolConfig.handlers.review;

    it("defaults to comment review", () => {
      const args = handler.buildArgs({ action: "review", number: 42 } as any, ctx);
      expect(args).toEqual(["pr", "review", "42", "--comment"]);
    });

    it("supports request-changes with body", () => {
      const args = handler.buildArgs(
        { action: "review", number: 42, reviewAction: "request-changes", body: "Fix" } as any,
        ctx,
      );
      expect(args).toEqual(["pr", "review", "42", "--request-changes", "--body", "Fix"]);
    });
  });

  describe("diff", () => {
    const handler = prToolConfig.handlers.diff;

    it("throws when number is missing", () => {
      expect(() => handler.buildArgs({ action: "diff" } as any, ctx)).toThrow(
        "number is required for diff",
      );
    });

    it("builds args and formats output", () => {
      const args = handler.buildArgs({ action: "diff", number: 42 } as any, ctx);
      expect(args).toEqual(["pr", "diff", "42"]);
      expect(handler.format({ stdout: "+added" } as any, {} as any, ctx)).toBe("+added");
    });
  });
});
