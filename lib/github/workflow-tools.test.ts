import { describe, it, expect } from "vitest";
import { workflowToolConfig } from "./workflow-tools.js";

const ctx = { cwd: "/tmp/repo" };

describe("workflowToolConfig", () => {
  it("has the expected tool metadata", () => {
    expect(workflowToolConfig.name).toBe("gh_workflow");
    expect(workflowToolConfig.label).toBe("GitHub Actions Workflow");
  });

  describe("list", () => {
    const handler = workflowToolConfig.handlers.list;

    it("uses default limit and excludes --all by default", () => {
      const args = handler.buildArgs({ action: "list" } as any, ctx);
      expect(args).toEqual(["workflow", "list", "--json", "id,name,state,path", "--limit", "20"]);
    });

    it("includes --all when requested", () => {
      const args = handler.buildArgs({ action: "list", all: true, limit: 5 } as any, ctx);
      expect(args).toEqual(["workflow", "list", "--json", "id,name,state,path", "--limit", "5", "--all"]);
    });

    it("formats workflows", () => {
      const text = handler.format(
        [{ id: 1, name: "CI", state: "active", path: ".github/workflows/ci.yml" }] as any,
        { action: "list" } as any,
        ctx,
      );
      expect(text).toContain("CI");
      expect(text).toContain("active");
    });
  });

  describe("trigger", () => {
    const handler = workflowToolConfig.handlers.trigger;

    it("throws when workflow is missing", () => {
      expect(() => handler.buildArgs({ action: "trigger" } as any, ctx)).toThrow(
        "workflow is required for trigger",
      );
    });

    it("throws when ref is missing", () => {
      expect(() =>
        handler.buildArgs({ action: "trigger", workflow: "ci.yml" } as any, ctx),
      ).toThrow("ref is required for trigger");
    });

    it("builds minimal args", () => {
      const args = handler.buildArgs(
        { action: "trigger", workflow: "ci.yml", ref: "main" } as any,
        ctx,
      );
      expect(args).toEqual(["workflow", "run", "ci.yml", "--ref", "main"]);
    });

    it("splits multiple fields", () => {
      const args = handler.buildArgs(
        { action: "trigger", workflow: "ci.yml", ref: "main", field: "env=prod,debug=true" } as any,
        ctx,
      );
      expect(args).toEqual([
        "workflow",
        "run",
        "ci.yml",
        "--ref",
        "main",
        "--field",
        "env=prod",
        "--field",
        "debug=true",
      ]);
    });

    it("formats stdout fallback", () => {
      const text = handler.format(
        { stdout: "" } as any,
        { action: "trigger", workflow: "ci.yml", ref: "main" } as any,
        ctx,
      );
      expect(text).toBe("Triggered workflow ci.yml on main.");
    });
  });
});
