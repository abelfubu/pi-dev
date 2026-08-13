import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import { createWorktree, listWorktrees, removeWorktree } from "./worktrunk.js";

function respond(stdout: string, stderr = "", error: Error | null = null) {
  execFileMock.mockImplementationOnce((_command, _args, _options, callback) => {
    queueMicrotask(() => callback(error, stdout, stderr));
    return {};
  });
}

describe("worktrunk commands", () => {
  beforeEach(() => execFileMock.mockReset());

  it("creates a worktree and returns its path", async () => {
    respond('{"action":"created","branch":"feature","path":"/repo.feature"}');

    await expect(createWorktree("/repo", "feature", "main")).resolves.toEqual({
      branch: "feature",
      path: "/repo.feature",
    });
    expect(execFileMock).toHaveBeenCalledWith(
      "wt",
      ["-C", "/repo", "switch", "--create", "feature", "--base", "main", "--no-cd", "--format=json", "--yes"],
      { cwd: "/repo", encoding: "utf8" },
      expect.any(Function),
    );
  });

  it("normalizes list output", async () => {
    respond(JSON.stringify({
      items: [{
        branch: "main",
        path: "/repo",
        main: true,
        current: true,
        changes: { working_tree: { modified: true, untracked: false } },
      }],
    }));

    await expect(listWorktrees("/repo")).resolves.toEqual([{
      branch: "main",
      path: "/repo",
      main: true,
      current: true,
      modified: true,
      untracked: false,
    }]);
  });

  it("removes without force flags and waits in foreground", async () => {
    respond('[{"branch":"feature","branch_outcome":"deleted"}]');

    await removeWorktree("/repo", "feature");

    expect(execFileMock.mock.calls[0][1]).toEqual([
      "-C", "/repo", "remove", "feature", "--foreground", "--format=json", "--yes",
    ]);
  });

  it("reports a missing Worktrunk executable", async () => {
    const error = Object.assign(new Error("spawn wt ENOENT"), { code: "ENOENT" });
    respond("", "", error);

    await expect(listWorktrees("/repo")).rejects.toThrow("wt not found");
  });
});
