import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: execFileMock }));
import { openHerdrReviewTab } from "./herdr.js";

describe("openHerdrReviewTab", () => {
  let tabs: { tab_id: string; label: string }[];
  beforeEach(() => {
    vi.stubEnv("HERDR_PANE_ID", "w7:p1");
    vi.stubEnv("HERDR_WORKSPACE_ID", "w7");
    tabs = [];
    execFileMock.mockReset();
    execFileMock.mockImplementation((_file: string, args: string[], _options: unknown, callback: Function) => {
      let result: unknown = {};
      if (args[0] === "tab" && args[1] === "list") result = { tabs };
      if (args[0] === "tab" && args[1] === "create") {
        const tab = { tab_id: `t${tabs.length}`, label: args[args.indexOf("--label") + 1] };
        tabs.push(tab);
        result = { tab, root_pane: { pane_id: `p${tab.tab_id}` } };
      }
      if (args[0] === "pane" && args[1] === "list") result = { panes: tabs.map(tab => ({ tab_id: tab.tab_id, pane_id: `p${tab.tab_id}` })) };
      queueMicrotask(() => callback(null, JSON.stringify({ result }), ""));
      return { exitCode: 0 };
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("creates an unfocused tab in the caller workspace and reuses it across viewers", async () => {
    const first = await openHerdrReviewTab("glow -p plan.md", "/repo", "Task");
    const second = await openHerdrReviewTab("nvim", "/other repo", "Diffview");
    expect(second).toEqual(first);
    const args = execFileMock.mock.calls.map(call => call[1]);
    expect(args.filter(args => args[0] === "tab" && args[1] === "create")).toEqual([
      ["tab", "create", "--workspace", "w7", "--no-focus", "--label", "Review · Task · w7:p1", "--cwd", "/repo"],
    ]);
    expect(args).toContainEqual(["pane", "run", "pt0", "cd '/other repo' && nvim"]);
  });

  it("keeps simultaneous orchestrators separate", async () => {
    const first = await openHerdrReviewTab("glow", "/repo", "Task");
    vi.stubEnv("HERDR_PANE_ID", "w7:p2");
    const second = await openHerdrReviewTab("glow", "/repo", "Task");
    expect(second.tabId).not.toBe(first.tabId);
  });

  it("recreates a manually closed tab", async () => {
    await openHerdrReviewTab("glow", "/repo");
    tabs = [];
    await openHerdrReviewTab("nvim", "/repo");
    expect(execFileMock.mock.calls.filter(call => call[1][1] === "create")).toHaveLength(2);
  });

  it("only focuses a reused tab on explicit request", async () => {
    await openHerdrReviewTab("glow", "/repo");
    await openHerdrReviewTab("nvim", "/repo", "Task", true);
    expect(execFileMock.mock.calls.map(call => call[1])).toContainEqual(["tab", "focus", "t0"]);
  });

  it("fails without caller context rather than using the focused workspace", async () => {
    vi.stubEnv("HERDR_WORKSPACE_ID", "");
    await expect(openHerdrReviewTab("glow", "/repo")).rejects.toThrow("Missing parent Herdr pane or workspace context.");
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
