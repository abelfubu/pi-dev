import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  createHerdrPane: vi.fn(),
  runInPane: vi.fn(),
  zoomHerdrPane: vi.fn(),
  resolveReviewTarget: vi.fn(),
}));

vi.mock("../lib/herdr.js", () => ({
  createHerdrPane: mocks.createHerdrPane,
  runInPane: mocks.runInPane,
  shellQuote: (value: string) => `'${value}'`,
  zoomHerdrPane: mocks.zoomHerdrPane,
}));
vi.mock("../lib/tuicr.js", () => ({
  resolveReviewTarget: mocks.resolveReviewTarget,
}));

import registerDiffviewTools from "./diffview-tools.js";

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

describe("diffview_review tool", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.resolveReviewTarget.mockResolvedValue({
      repoDir: "/repo",
      baseSha: "base-sha",
      headSha: "head-sha",
      mergeBaseSha: "merge-sha",
      revisions: "merge-sha..head-sha",
    });
    mocks.createHerdrPane.mockResolvedValue({ paneId: "pane-1" });
    mocks.zoomHerdrPane.mockResolvedValue(undefined);
    mocks.runInPane.mockResolvedValue(undefined);
  });

  it("opens a focused, zoomed Neovim Diffview pane on an immutable revision range", async () => {
    const api = createApi();
    registerDiffviewTools(api);

    const result = await execute(api, { repoDir: "/repo", baseRef: "main" });

    expect(api.getTool().name).toBe("diffview_review");
    expect(mocks.resolveReviewTarget).toHaveBeenCalledWith("/repo", "main");
    expect(mocks.createHerdrPane).toHaveBeenCalledWith(
      "pane",
      "diffview review",
      "/repo",
      undefined,
      true,
    );
    expect(mocks.zoomHerdrPane).toHaveBeenCalledWith("pane-1", true);
    expect(mocks.runInPane).toHaveBeenCalledWith(
      "pane-1",
      "nvim -c 'DiffviewOpen merge-sha..head-sha'; herdr pane close --current",
    );
    expect(result.content[0].text).toContain("Pinned diff: merge-sha..head-sha");
    expect(result.content[0].text).toContain("close automatically");
  });

  it("does not close the pane when Neovim launch fails", async () => {
    const api = createApi();
    registerDiffviewTools(api);
    mocks.runInPane.mockRejectedValueOnce(new Error("launch failed"));

    await expect(execute(api, { repoDir: "/repo", baseRef: "main" })).rejects.toThrow(
      "launch failed",
    );
  });
});
