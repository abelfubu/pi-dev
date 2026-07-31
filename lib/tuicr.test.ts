import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import {
  listTuicrSessions,
  readTuicrComments,
  resolveReviewTarget,
} from "./tuicr.js";

function respond(stdout = "", stderr = "", exitCode = 0) {
  execFileMock.mockImplementationOnce(
    (_command: string, _args: string[], _options: unknown, callback: Function) => {
      const error = exitCode === 0 ? null : Object.assign(new Error(stderr || "failed"), { code: exitCode });
      queueMicrotask(() => callback(error, stdout, stderr));
      return {};
    },
  );
}

describe("resolveReviewTarget", () => {
  beforeEach(() => execFileMock.mockReset());

  it("pins the merge base and HEAD into an immutable range", async () => {
    respond("/repo");
    respond("base-sha");
    respond("head-sha");
    respond("merge-sha");
    respond("", "", 1);

    await expect(resolveReviewTarget("/repo/subdir", "main")).resolves.toEqual({
      repoDir: "/repo",
      baseSha: "base-sha",
      headSha: "head-sha",
      mergeBaseSha: "merge-sha",
      revisions: "merge-sha..head-sha",
    });

    expect(execFileMock).toHaveBeenNthCalledWith(
      5,
      "git",
      ["diff","--quiet","merge-sha","head-sha","--"],
      { cwd: "/repo", encoding: "utf8" },
      expect.any(Function),
    );
  });

  it("rejects an empty diff", async () => {
    respond("/repo");
    respond("base-sha");
    respond("head-sha");
    respond("merge-sha");
    respond();

    await expect(resolveReviewTarget("/repo", "main")).rejects.toThrow("No changes to review");
  });
});

describe("tuicr session commands", () => {
  beforeEach(() => execFileMock.mockReset());

  it("lists sessions for an explicit repository", async () => {
    respond('[{"slug":"local-1","active":true}]');

    await expect(listTuicrSessions("/repo")).resolves.toEqual([
      { slug: "local-1", active: true },
    ]);
    expect(execFileMock).toHaveBeenCalledWith(
      "tuicr",
      ["review","list","--repo","/repo"],
      { cwd: "/repo", encoding: "utf8" },
      expect.any(Function),
    );
  });

  it("reads comments from the pinned session", async () => {
    respond('[{"id":"comment-1","content":"Fix this"}]');

    await expect(readTuicrComments("/repo", "local-1")).resolves.toEqual([
      { id: "comment-1", content: "Fix this" },
    ]);
    expect(execFileMock).toHaveBeenCalledWith(
      "tuicr",
      ["review","comments","--repo","/repo","--session","local-1"],
      { cwd: "/repo", encoding: "utf8" },
      expect.any(Function),
    );
  });

  it("rejects malformed JSON", async () => {
    respond("not-json");
    await expect(listTuicrSessions("/repo")).rejects.toThrow("non-JSON session data");
  });
});
