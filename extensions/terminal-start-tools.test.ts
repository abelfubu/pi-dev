import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
const mocks = vi.hoisted(() => ({ openTerminalWindow: vi.fn() }));
vi.mock("../lib/terminal.js", () => ({
  openTerminalWindow: mocks.openTerminalWindow,
  describeTerminalWindow: () => "Rex window w1",
}));
import registerTerminalStartTools from "./terminal-start-tools.js";

function createTool() {
  let tool: any;
  registerTerminalStartTools({ registerTool: (definition: any) => { tool = definition; } } as unknown as ExtensionAPI);
  return tool;
}

beforeEach(() => {
  mocks.openTerminalWindow.mockReset().mockResolvedValue({ platform: "rex", windowId: "w1", blockId: "b1" });
});

describe("terminal_start", () => {
  it("opens a fresh viewer without focus using caller cwd", async () => {
    const tool = createTool();
    expect(tool.name).toBe("terminal_start");
    const result = await tool.execute("call", { command: "nvim plan.md" }, undefined, undefined, { cwd: "/caller" });
    expect(mocks.openTerminalWindow).toHaveBeenCalledWith("nvim plan.md", "/caller", "Plan", false);
    expect(result.content[0].text).toContain("Rex window w1");
    expect(result.details).toMatchObject({ windowId: "w1", cwd: "/caller" });
  });

  it("passes explicit cwd, label, and focus", async () => {
    await createTool().execute("call", { command: "nvim", cwd: "/repo", label: "Task", focus: true }, undefined, undefined, { cwd: "/caller" });
    expect(mocks.openTerminalWindow).toHaveBeenCalledWith("nvim", "/repo", "Task", true);
  });

  it("rejects empty commands and surfaces launch failures", async () => {
    await expect(createTool().execute("call", { command: " " })).rejects.toThrow("command is required");
    expect(mocks.openTerminalWindow).not.toHaveBeenCalled();
    mocks.openTerminalWindow.mockRejectedValue(new Error("launch failed"));
    await expect(createTool().execute("call", { command: "nvim" }, undefined, undefined, { cwd: "/caller" })).rejects.toThrow("launch failed");
  });
});
