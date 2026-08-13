import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  createWorktree: vi.fn(),
  listWorktrees: vi.fn(),
  removeWorktree: vi.fn(),
}));
vi.mock("../lib/worktrunk.js", () => mocks);

import registerWorktrunkTools from "./worktrunk-tools.js";

function createApi() {
  let tool: any;
  return {
    registerTool: vi.fn((definition: any) => { tool = definition; }),
    getTool: () => tool,
  } as unknown as ExtensionAPI & { getTool: () => any };
}

async function execute(api: ReturnType<typeof createApi>, params: Record<string, unknown>) {
  return api.getTool().execute("call-1", params);
}

describe("worktrunk tool", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.createWorktree.mockResolvedValue({ branch: "feature", path: "/repo.feature" });
    mocks.listWorktrees.mockResolvedValue([{ branch: "main", path: "/repo", main: true }]);
    mocks.removeWorktree.mockResolvedValue([{ branch: "feature", branch_outcome: "deleted" }]);
  });

  it("creates and reports a hook-prepared worktree", async () => {
    const api = createApi();
    registerWorktrunkTools(api);

    const result = await execute(api, {
      action: "create",
      repoDir: "/repo",
      branch: "feature",
      baseRef: "main",
    });

    expect(mocks.createWorktree).toHaveBeenCalledWith("/repo", "feature", "main");
    expect(result.content[0].text).toContain("Lifecycle hooks completed");
    expect(result.details.path).toBe("/repo.feature");
  });

  it("lists worktrees", async () => {
    const api = createApi();
    registerWorktrunkTools(api);

    const result = await execute(api, { action: "list", repoDir: "/repo" });

    expect(result.details.worktrees).toHaveLength(1);
  });

  it("removes a worktree by branch", async () => {
    const api = createApi();
    registerWorktrunkTools(api);

    await execute(api, { action: "remove", repoDir: "/repo", branch: "feature" });

    expect(mocks.removeWorktree).toHaveBeenCalledWith("/repo", "feature");
  });
});
