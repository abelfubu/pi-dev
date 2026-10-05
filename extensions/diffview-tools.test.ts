import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  openHerdrReviewTab: vi.fn(),
  resolveReviewTarget: vi.fn(),
}));
vi.mock("../lib/herdr.js", () => ({
  openHerdrReviewTab: mocks.openHerdrReviewTab,
  shellQuote: (value: string) => `'${value}'`,
}));
vi.mock("../lib/tuicr.js", () => ({ resolveReviewTarget: mocks.resolveReviewTarget }));
import registerDiffviewTools from "./diffview-tools.js";

function createTool() {
  let tool: any;
  registerDiffviewTools({ registerTool: (definition: any) => { tool = definition; } } as unknown as ExtensionAPI);
  return tool;
}

describe("diffview_review tool", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.resolveReviewTarget.mockResolvedValue({
      repoDir: "/repo", baseSha: "base-sha", headSha: "head-sha",
      mergeBaseSha: "merge-sha", revisions: "merge-sha..head-sha",
    });
    mocks.openHerdrReviewTab.mockResolvedValue({ paneId: "p2", tabId: "t2" });
  });

  it("opens an immutable diff in the reusable review tab without focus", async () => {
    const result = await createTool().execute("call", { repoDir: "/repo", baseRef: "main" });
    expect(mocks.resolveReviewTarget).toHaveBeenCalledWith("/repo", "main");
    expect(mocks.openHerdrReviewTab).toHaveBeenCalledWith(
      "nvim -c 'DiffviewOpen merge-sha..head-sha'", "/repo", "Diffview", false,
    );
    expect(result.details).toMatchObject({ paneId: "p2", tabId: "t2", mergeBaseSha: "merge-sha", headSha: "head-sha" });
    expect(result.content[0].text).toContain("Pinned diff: merge-sha..head-sha");
    expect(result.content[0].text).toContain("tab remains available");
  });

  it("supports a task label and explicit focus", async () => {
    await createTool().execute("call", { repoDir: "/repo", baseRef: "main", label: "Task", focus: true });
    expect(mocks.openHerdrReviewTab).toHaveBeenCalledWith(expect.any(String), "/repo", "Task", true);
  });

  it("surfaces launch failures", async () => {
    mocks.openHerdrReviewTab.mockRejectedValueOnce(new Error("launch failed"));
    await expect(createTool().execute("call", { repoDir: "/repo", baseRef: "main" })).rejects.toThrow("launch failed");
  });
});
