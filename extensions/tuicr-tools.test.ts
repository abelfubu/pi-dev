import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  closeHerdrPane: vi.fn(),
  createHerdrPane: vi.fn(),
  runInPane: vi.fn(),
  zoomHerdrPane: vi.fn(),
  listTuicrSessions: vi.fn(),
  readTuicrComments: vi.fn(),
  resolveReviewTarget: vi.fn(),
}));

vi.mock("node:crypto", () => ({ randomUUID: () => "review-1" }));
vi.mock("../lib/herdr.js", () => ({
  closeHerdrPane: mocks.closeHerdrPane,
  createHerdrPane: mocks.createHerdrPane,
  runInPane: mocks.runInPane,
  shellQuote: (value: string) => `'${value}'`,
  zoomHerdrPane: mocks.zoomHerdrPane,
}));
vi.mock("../lib/tuicr.js", () => ({
  listTuicrSessions: mocks.listTuicrSessions,
  readTuicrComments: mocks.readTuicrComments,
  resolveReviewTarget: mocks.resolveReviewTarget,
}));

import registerTuicrTools, { selectReviewSession } from "./tuicr-tools.js";

function createApi() {
  let tool: any;
  return {
    registerTool: vi.fn((definition: any) => {
      tool = definition;
    }),
    getTool: () => tool,
  } as unknown as ExtensionAPI & { getTool: () => any };
}

async function execute(api: ReturnType<typeof createApi>, params: Record<string, unknown>) {
  return api.getTool().execute("call-1", params, undefined, undefined, { cwd: "/caller" });
}

describe("selectReviewSession", () => {
  it("prefers the single active session", () => {
    expect(
      selectReviewSession(
        [
          { slug: "old", active: false },
          { slug: "current", active: true },
        ],
        new Set(["old"]),
      ),
    ).toBe("current");
  });

  it("selects one session created after launch", () => {
    expect(
      selectReviewSession(
        [{ slug: "old" }, { slug: "new" }],
        new Set(["old"]),
      ),
    ).toBe("new");
  });

  it("rejects ambiguous active sessions", () => {
    expect(() =>
      selectReviewSession(
        [
          { slug: "one", active: true },
          { slug: "two", active: true },
        ],
        new Set(),
      ),
    ).toThrow("Multiple active tuicr sessions");
  });
});

describe("tuicr_review tool", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.closeHerdrPane.mockResolvedValue(undefined);
    mocks.runInPane.mockResolvedValue(undefined);
    mocks.zoomHerdrPane.mockResolvedValue(undefined);
    mocks.resolveReviewTarget.mockResolvedValue({
      repoDir: "/repo",
      baseSha: "base-sha",
      headSha: "head-sha",
      mergeBaseSha: "merge-sha",
      revisions: "merge-sha..head-sha",
    });
    mocks.createHerdrPane.mockResolvedValue({ paneId: "pane-1" });
    mocks.listTuicrSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: "local-session", active: true }]);
    mocks.readTuicrComments.mockResolvedValue([]);
  });

  it("opens a focused, zoomed pane on an immutable revision range", async () => {
    const api = createApi();
    registerTuicrTools(api);

    const result = await execute(api, {
      action: "open",
      repoDir: "/repo",
      baseRef: "main",
    });

    expect(mocks.resolveReviewTarget).toHaveBeenCalledWith("/repo", "main");
    expect(mocks.createHerdrPane).toHaveBeenCalledWith(
      "pane",
      "tuicr review",
      "/repo",
      undefined,
      true,
    );
    expect(mocks.zoomHerdrPane).toHaveBeenCalledWith("pane-1", true);
    expect(mocks.runInPane).toHaveBeenCalledWith(
      "pane-1",
      "tuicr -r 'merge-sha..head-sha' --no-update-check",
    );
    expect(result.content[0].text).toContain("review-1");
    expect(result.content[0].text).toContain("explicit user approval");
  });

  it("reads comments and keeps empty comments distinct from approval", async () => {
    const api = createApi();
    registerTuicrTools(api);
    await execute(api, { action: "open", repoDir: "/repo", baseRef: "main" });

    const result = await execute(api, { action: "comments", reviewId: "review-1" });

    expect(mocks.readTuicrComments).toHaveBeenCalledWith("/repo", "local-session");
    expect(result.content[0].text).toContain("not approval");
  });

  it("closes only a pane owned by a known review", async () => {
    const api = createApi();
    registerTuicrTools(api);
    await execute(api, { action: "open", repoDir: "/repo", baseRef: "main" });

    await execute(api, { action: "close", reviewId: "review-1" });
    expect(mocks.closeHerdrPane).toHaveBeenCalledWith("pane-1");

    await expect(execute(api, { action: "close", reviewId: "review-1" })).rejects.toThrow(
      "Unknown or expired",
    );
  });

  it("cleans up the pane when launch fails", async () => {
    const api = createApi();
    registerTuicrTools(api);
    mocks.runInPane.mockRejectedValueOnce(new Error("launch failed"));

    await expect(
      execute(api, { action: "open", repoDir: "/repo", baseRef: "main" }),
    ).rejects.toThrow("launch failed");
    expect(mocks.closeHerdrPane).toHaveBeenCalledWith("pane-1");
  });

  it("rejects opening beside an existing active review", async () => {
    const api = createApi();
    registerTuicrTools(api);
    mocks.listTuicrSessions.mockReset();
    mocks.listTuicrSessions.mockResolvedValue([{ slug: "already-open", active: true }]);

    await expect(
      execute(api, { action: "open", repoDir: "/repo", baseRef: "main" }),
    ).rejects.toThrow("already active");
    expect(mocks.createHerdrPane).not.toHaveBeenCalled();
  });
});
