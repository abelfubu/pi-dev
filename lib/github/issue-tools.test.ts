import { describe, it, expect } from "vitest";
import { issueToolConfig } from "./issue-tools.js";

const ctx = { cwd: "/tmp/repo" };

describe("issueToolConfig", () => {
  it("has the expected tool metadata", () => {
    expect(issueToolConfig.name).toBe("gh_issue");
    expect(issueToolConfig.label).toBe("GitHub Issue");
  });

  describe("create", () => {
    const handler = issueToolConfig.handlers.create;

    it("throws when title is missing", () => {
      expect(() => handler.buildArgs({ action: "create" } as any, ctx)).toThrow(
        "title is required for create",
      );
    });

    it("builds minimal args", () => {
      const args = handler.buildArgs({ action: "create", title: "Bug" } as any, ctx);
      expect(args).toEqual(["issue", "create", "--title", "Bug"]);
    });

    it("splits multiple labels", () => {
      const args = handler.buildArgs(
        { action: "create", title: "Bug", label: "bug, triage" } as any,
        ctx,
      );
      expect(args).toEqual([
        "issue",
        "create",
        "--title",
        "Bug",
        "--label",
        "bug",
        "--label",
        "triage",
      ]);
    });

    it("formats stdout into a created URL", () => {
      const text = handler.format(
        { stdout: "https://github.com/owner/repo/issues/7", stderr: "", exitCode: 0 },
        { action: "create" } as any,
        ctx,
      );
      expect(text).toBe("Created issue: https://github.com/owner/repo/issues/7");
    });
  });

  describe("list", () => {
    const handler = issueToolConfig.handlers.list;

    it("uses default state and limit", () => {
      const args = handler.buildArgs({ action: "list" } as any, ctx);
      expect(args).toEqual([
        "issue",
        "list",
        "--json",
        "number,title,state,author,createdAt",
        "--state",
        "open",
        "--limit",
        "30",
      ]);
    });

    it("applies filters", () => {
      const args = handler.buildArgs(
        { action: "list", state: "all", limit: 10, label: "bug", author: "alice" } as any,
        ctx,
      );
      expect(args).toEqual([
        "issue",
        "list",
        "--json",
        "number,title,state,author,createdAt",
        "--state",
        "all",
        "--limit",
        "10",
        "--label",
        "bug",
        "--author",
        "alice",
      ]);
    });

    it("formats an empty list", () => {
      expect(handler.format([], { action: "list" } as any, ctx)).toBe("No issues found.");
    });
  });

  describe("view", () => {
    const handler = issueToolConfig.handlers.view;

    it("throws when number is missing", () => {
      expect(() => handler.buildArgs({ action: "view" } as any, ctx)).toThrow(
        "number is required for view",
      );
    });

    it("builds args", () => {
      const args = handler.buildArgs({ action: "view", number: 7 } as any, ctx);
      expect(args).toEqual([
        "issue",
        "view",
        "7",
        "--json",
        "number,title,url,state,author,createdAt,labels,body",
      ]);
    });

    it("formats an issue with labels", () => {
      const text = handler.format(
        {
          number: 7,
          title: "Bug",
          url: "https://example.com",
          state: "OPEN",
          author: { login: "alice" },
          createdAt: "2024-01-01",
          labels: [{ name: "bug" }],
        } as any,
        { action: "view" } as any,
        ctx,
      );
      expect(text).toContain("#7");
      expect(text).toContain("**Labels:** bug");
    });
  });

  describe("comment", () => {
    const handler = issueToolConfig.handlers.comment;

    it("throws when required params are missing", () => {
      expect(() => handler.buildArgs({ action: "comment" } as any, ctx)).toThrow("number");
      expect(() =>
        handler.buildArgs({ action: "comment", number: 7 } as any, ctx),
      ).toThrow("body");
    });

    it("builds args", () => {
      const args = handler.buildArgs(
        { action: "comment", number: 7, body: "Thanks" } as any,
        ctx,
      );
      expect(args).toEqual(["issue", "comment", "7", "--body", "Thanks"]);
    });

    it("formats fallback", () => {
      expect(
        handler.format({ stdout: "" } as any, { action: "comment", number: 7 } as any, ctx),
      ).toBe("Commented on issue #7.");
    });
  });

  describe("close", () => {
    const handler = issueToolConfig.handlers.close;

    it("throws when number is missing", () => {
      expect(() => handler.buildArgs({ action: "close" } as any, ctx)).toThrow(
        "number is required for close",
      );
    });

    it("uses default reason and supports comment", () => {
      const args = handler.buildArgs(
        { action: "close", number: 7, comment: "Resolved" } as any,
        ctx,
      );
      expect(args).toEqual(["issue", "close", "7", "--reason", "completed", "--comment", "Resolved"]);
    });

    it("allows custom reason", () => {
      const args = handler.buildArgs(
        { action: "close", number: 7, reason: "not_planned" } as any,
        ctx,
      );
      expect(args).toEqual(["issue", "close", "7", "--reason", "not_planned"]);
    });
  });

  describe("reopen", () => {
    const handler = issueToolConfig.handlers.reopen;

    it("builds args and formats fallback", () => {
      const args = handler.buildArgs({ action: "reopen", number: 7 } as any, ctx);
      expect(args).toEqual(["issue", "reopen", "7"]);
      expect(
        handler.format({ stdout: "" } as any, { action: "reopen", number: 7 } as any, ctx),
      ).toBe("Reopened issue #7.");
    });
  });
});
