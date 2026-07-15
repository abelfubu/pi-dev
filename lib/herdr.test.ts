import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { createHerdrPane } from "./herdr.js";

describe("createHerdrPane", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    execFileMock.mockImplementation(
      (_file: string, args: string[], _options: unknown, callback: Function) => {
        const isTab = args[0] === "tab";
        const stdout = isTab
          ? JSON.stringify({ result: { tab: { tab_id: "w7:t2" }, root_pane: { pane_id: "w7:p2" } } })
          : JSON.stringify({ result: { pane: { pane_id: "w7:p3" } } });
        queueMicrotask(() => callback(null, stdout, ""));
        return { exitCode: 0 };
      },
    );
  });

  it("creates tabs in the parent workspace", async () => {
    await createHerdrPane("tab", "reviewer", "/repo", {
      paneId: "w7:p1",
      workspaceId: "w7",
    });

    expect(execFileMock).toHaveBeenCalledWith(
      "herdr",
      ["tab", "create", "--workspace", "w7", "--label", "reviewer", "--cwd", "/repo"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("splits the parent pane instead of the UI-focused pane", async () => {
    await createHerdrPane("pane", "scout", "/repo", {
      paneId: "w7:p1",
      workspaceId: "w7",
    });

    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      "herdr",
      ["pane", "split", "w7:p1", "--direction", "right", "--no-focus", "--cwd", "/repo"],
      expect.any(Object),
      expect.any(Function),
    );
  });
});
