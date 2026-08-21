import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  openHerdrPopup: vi.fn(),
  resolveReviewTarget: vi.fn(),
}));

vi.mock("../lib/herdr.js", () => ({
  openHerdrPopup: mocks.openHerdrPopup,
  shellQuote: (value: string) => `'${value}'`,
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
    mocks.openHerdrPopup.mockResolvedValue(undefined);
  });

  it("opens a focused 90% Neovim Diffview popup on an immutable revision range", async () => {
    const api = createApi();
    registerDiffviewTools(api);

    const result = await execute(api, { repoDir: "/repo", baseRef: "main" });

    expect(api.getTool().name).toBe("diffview_review");
    expect(mocks.resolveReviewTarget).toHaveBeenCalledWith("/repo", "main");
    expect(mocks.openHerdrPopup).toHaveBeenCalledWith(
      "nvim -c 'DiffviewOpen merge-sha..head-sha'",
      "/repo",
      { width: "90%", height: "90%", focus: true },
    );
    expect(result.content[0].text).toContain("Pinned diff: merge-sha..head-sha");
    expect(result.content[0].text).toContain("popup closes when Neovim exits");
  });

  it("surfaces popup launch failures", async () => {
    const api = createApi();
    registerDiffviewTools(api);
    mocks.openHerdrPopup.mockRejectedValueOnce(new Error("launch failed"));

    await expect(execute(api, { repoDir: "/repo", baseRef: "main" })).rejects.toThrow(
      "launch failed",
    );
  });
});
