import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  execFile: vi.fn(), createHerdrPane: vi.fn(), openHerdrReviewTab: vi.fn(), runInPane: vi.fn(),
}));
vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  Object.assign(mocks.execFile, {
    [promisify.custom]: (...args: unknown[]) => new Promise((resolve, reject) => {
      mocks.execFile(...args, (error: Error | null, stdout: string, stderr: string) => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      });
    }),
  });
  return { execFile: mocks.execFile };
});
vi.mock("./herdr.js", () => ({
  createHerdrPane: mocks.createHerdrPane,
  openHerdrReviewTab: mocks.openHerdrReviewTab,
  runInPane: mocks.runInPane,
}));
import { detectTerminal, describeTerminalWindow, openReviewWindow, openTerminalWindow } from "./terminal.js";

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ["TERM_PROGRAM", "REX_SESSION", "HERDR_PANE_ID", "HERDR_WORKSPACE_ID"]) vi.stubEnv(key, "");
});
afterEach(() => vi.unstubAllEnvs());

function rexResult(stdout: string, error: Error | null = null) {
  mocks.execFile.mockImplementation((_file, _args, _options, callback) => {
    callback(error, stdout, "");
  });
}

describe("terminal viewers", () => {
  it("requires known caller context", () => {
    expect(() => detectTerminal()).toThrow("No Rex or Herdr terminal context");
  });

  it("prefers the immediate terminal over inherited context", () => {
    vi.stubEnv("TERM_PROGRAM", "rex");
    vi.stubEnv("HERDR_PANE_ID", "outer");
    expect(detectTerminal()).toBe("rex");
    vi.stubEnv("TERM_PROGRAM", "Herdr");
    vi.stubEnv("REX_SESSION", "outer");
    expect(detectTerminal()).toBe("herdr");
  });

  it("opens fresh unfocused Rex windows for plans and diffs in the caller session", async () => {
    vi.stubEnv("REX_SESSION", "session:caller");
    rexResult(JSON.stringify({ window_id: "window:1", block_ids: ["block:1"] }));
    const command = "nvim -c 'Markview splitOpen' -- '/tmp/a plan.md'";
    const result = await openTerminalWindow(command, "/a repo", "A plan");
    await openReviewWindow("nvim", "/a repo", "Diff", true);
    expect(mocks.execFile).toHaveBeenNthCalledWith(1, "rex", [
      "window", "new", "--session", "session:caller", "--cwd", "/a repo",
      "--focus=false", "--keep-open", "--json", "--shell=none", "A plan",
      "--", "sh", "-lc", command,
    ], { cwd: "/a repo", encoding: "utf8" }, expect.any(Function));
    expect(mocks.execFile.mock.calls[1][1]).toContain("--focus=true");
    expect(result).toEqual({ platform: "rex", windowId: "window:1", blockId: "block:1" });
    expect(describeTerminalWindow(result)).toBe("Rex window window:1");
    expect(mocks.openHerdrReviewTab).not.toHaveBeenCalled();
  });

  it("does not fall back to Herdr when Rex context is incomplete or launch fails", async () => {
    vi.stubEnv("TERM_PROGRAM", "rex");
    vi.stubEnv("HERDR_PANE_ID", "outer");
    await expect(openReviewWindow("nvim", "/repo", "Diff")).rejects.toThrow("Missing parent Rex session");
    vi.stubEnv("REX_SESSION", "session:1");
    rexResult("", new Error("rex failed"));
    await expect(openReviewWindow("nvim", "/repo", "Diff")).rejects.toThrow("rex failed");
    expect(mocks.openHerdrReviewTab).not.toHaveBeenCalled();
  });

  it.each(["not json", "{}", '{"window_id":"w","block_ids":[]}'])("rejects malformed Rex response %s", async (stdout) => {
    vi.stubEnv("REX_SESSION", "session:1");
    rexResult(stdout);
    await expect(openReviewWindow("nvim", "/repo", "Diff")).rejects.toThrow();
  });

  it("preserves Herdr's reusable Diffview tab and fresh plan tabs", async () => {
    vi.stubEnv("HERDR_PANE_ID", "p1");
    vi.stubEnv("HERDR_WORKSPACE_ID", "ws1");
    mocks.openHerdrReviewTab.mockResolvedValue({ paneId: "p2", tabId: "t2" });
    mocks.createHerdrPane.mockResolvedValue({ paneId: "p3", tabId: "t3" });
    const review = await openReviewWindow("nvim", "/repo", "Diff");
    expect(mocks.openHerdrReviewTab).toHaveBeenCalledWith("nvim", "/repo", "Diff", false);
    expect(describeTerminalWindow(review)).toBe("Herdr tab t2");
    await openTerminalWindow("nvim plan.md", "/repo", "Plan");
    expect(mocks.createHerdrPane).toHaveBeenCalledWith("tab", "Plan", "/repo", { paneId: "p1", workspaceId: "ws1" }, false);
    expect(mocks.runInPane).toHaveBeenCalledWith("p3", "nvim plan.md");
  });

  it("requires complete Herdr context and creation IDs", async () => {
    vi.stubEnv("HERDR_PANE_ID", "p1");
    await expect(openTerminalWindow("nvim", "/repo", "Plan")).rejects.toThrow("Missing parent Herdr");
    vi.stubEnv("HERDR_WORKSPACE_ID", "ws1");
    mocks.createHerdrPane.mockResolvedValue({});
    await expect(openTerminalWindow("nvim", "/repo", "Plan")).rejects.toThrow("Herdr did not return");
    expect(mocks.runInPane).not.toHaveBeenCalled();
  });
});
