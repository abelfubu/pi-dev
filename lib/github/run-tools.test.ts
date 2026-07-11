import { describe, it, expect } from "vitest";
import { runToolConfig } from "./run-tools.js";

const ctx = { cwd: "/tmp/repo" };

describe("runToolConfig", () => {
  it("has the expected tool metadata", () => {
    expect(runToolConfig.name).toBe("gh_run");
    expect(runToolConfig.label).toBe("GitHub Actions Run");
  });

  describe("list", () => {
    const handler = runToolConfig.handlers.list;

    it("uses default limit", () => {
      const args = handler.buildArgs({ action: "list" } as any, ctx);
      expect(args).toEqual([
        "run",
        "list",
        "--json",
        "databaseId,displayTitle,status,conclusion,workflowName,headBranch,event,createdAt",
        "--limit",
        "10",
      ]);
    });

    it("applies filters", () => {
      const args = handler.buildArgs(
        {
          action: "list",
          limit: 3,
          workflow: "ci.yml",
          branch: "main",
          status: "completed",
          event: "push",
        } as any,
        ctx,
      );
      expect(args).toEqual([
        "run",
        "list",
        "--json",
        "databaseId,displayTitle,status,conclusion,workflowName,headBranch,event,createdAt",
        "--limit",
        "3",
        "--workflow",
        "ci.yml",
        "--branch",
        "main",
        "--status",
        "completed",
        "--event",
        "push",
      ]);
    });

    it("formats runs", () => {
      const text = handler.format(
        [
          {
            databaseId: 123,
            displayTitle: "CI",
            status: "completed",
            conclusion: "success",
            workflowName: "CI",
          },
        ] as any,
        { action: "list" } as any,
        ctx,
      );
      expect(text).toContain("#123");
      expect(text).toContain("CI");
    });
  });

  describe("view", () => {
    const handler = runToolConfig.handlers.view;

    it("throws when id is missing", () => {
      expect(() => handler.buildArgs({ action: "view" } as any, ctx)).toThrow(
        "id is required for view",
      );
    });

    it("builds JSON view args with job", () => {
      const args = handler.buildArgs({ action: "view", id: 123, job: 456 } as any, ctx);
      expect(args).toEqual([
        "run",
        "view",
        "123",
        "--json",
        "databaseId,displayTitle,status,conclusion,workflowName,headBranch,createdAt,jobs",
        "--job",
        "456",
      ]);
    });

    it("builds log-failed args", () => {
      const args = handler.buildArgs({ action: "view", id: 123, logFailed: true } as any, ctx);
      expect(args).toEqual(["run", "view", "123", "--log-failed"]);
    });

    it("formats log-failed output", () => {
      const text = handler.format(
        { stdout: "log line" } as any,
        { action: "view", logFailed: true } as any,
        ctx,
      );
      expect(text).toBe("log line");
    });

    it("formats JSON output", () => {
      const text = handler.format(
        { stdout: '{"databaseId":123,"displayTitle":"CI","workflowName":"CI","jobs":[]}' } as any,
        { action: "view" } as any,
        ctx,
      );
      expect(text).toContain("Run #123");
    });
  });

  describe("rerun", () => {
    const handler = runToolConfig.handlers.rerun;

    it("throws when id is missing", () => {
      expect(() => handler.buildArgs({ action: "rerun" } as any, ctx)).toThrow(
        "id is required for rerun",
      );
    });

    it("builds args with --failed", () => {
      const args = handler.buildArgs({ action: "rerun", id: 123, failed: true } as any, ctx);
      expect(args).toEqual(["run", "rerun", "123", "--failed"]);
    });

    it("formats fallback", () => {
      expect(
        handler.format({ stdout: "" } as any, { action: "rerun", id: 123 } as any, ctx),
      ).toBe("Rerun started for run 123.");
    });
  });
});
