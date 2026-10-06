import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import register from "./github-tools.js";

function setup() {
  const handlers = new Map<string, Function>();
  const registerTool = vi.fn();
  register({ on: (name: string, handler: Function) => handlers.set(name, handler), registerTool } as unknown as ExtensionAPI);
  return { call: handlers.get("tool_call")!, registerTool };
}

beforeEach(() => { vi.stubEnv("PI_ACP_DELEGATE_DEPTH", ""); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("GitHub shipping guards", () => {
  it("preserves all GitHub tools", () => {
    const { registerTool } = setup();
    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      "gh_pr", "gh_issue", "gh_run", "gh_workflow", "gh_release",
    ]);
  });

  it("blocks direct PR creation for the parent and delegates", () => {
    const { call } = setup();
    const event = { toolName: "bash", input: { command: "gh pr create --title Test" } };
    expect(call(event)?.block).toBe(true);
    vi.stubEnv("PI_ACP_DELEGATE_DEPTH", "1");
    expect(call(event)?.block).toBe(true);
  });

  it("blocks git push in ACP delegates", () => {
    vi.stubEnv("PI_ACP_DELEGATE_DEPTH", "1");
    const { call } = setup();
    expect(call({ toolName: "bash", input: { command: "git push origin feature" } })).toEqual({
      block: true,
      reason: "Subagents cannot push branches. The parent orchestrator owns shipping.",
    });
  });

  it("leaves parent pushes and read-only delegate commands unchanged", () => {
    const { call } = setup();
    expect(call({ toolName: "bash", input: { command: "git push origin feature" } })).toBeUndefined();
    vi.stubEnv("PI_ACP_DELEGATE_DEPTH", "1");
    expect(call({ toolName: "bash", input: { command: "git status" } })).toBeUndefined();
  });
});
