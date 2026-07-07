import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerGithubTools from "../../extensions/github-tools.js";

const mockRunGh = vi.hoisted(() => vi.fn());
const mockRunGhJson = vi.hoisted(() => vi.fn());

vi.mock("./runner.js", () => ({
  runGh: mockRunGh,
  runGhJson: mockRunGhJson,
}));

function createMockApi() {
  const tools = new Map<string, any>();
  return {
    registerTool: vi.fn((config: any) => {
      tools.set(config.name, config);
    }),
    getTool: (name: string) => tools.get(name),
    tools,
  } as unknown as ExtensionAPI & { getTool: (name: string) => any; tools: Map<string, any> };
}

async function executeTool(
  api: ReturnType<typeof createMockApi>,
  name: string,
  params: Record<string, unknown>,
  ctx?: { cwd?: string },
) {
  const tool = api.getTool(name);
  if (!tool) throw new Error(`Tool ${name} not registered`);
  return tool.execute("test-id", params, undefined, undefined, ctx);
}

function lastRunGhArgs(): string[] {
  return mockRunGh.mock.calls[mockRunGh.mock.calls.length - 1][0] as string[];
}

function lastRunGhJsonArgs(): string[] {
  return mockRunGhJson.mock.calls[mockRunGhJson.mock.calls.length - 1][0] as string[];
}

describe("github-tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("registers all expected GitHub tools", () => {
    const api = createMockApi();
    registerGithubTools(api);

    const expected = ["gh_pr", "gh_issue", "gh_run", "gh_workflow", "gh_release"];

    for (const name of expected) {
      expect(api.tools.has(name), `expected ${name} to be registered`).toBe(true);
    }
  });

  describe("PR tools", () => {
    it("creates a PR with title and body", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({
        stdout: "https://github.com/owner/repo/pull/42",
        stderr: "",
        exitCode: 0,
      });

      const result = await executeTool(api, "gh_pr", {
        action: "create",
        title: "Test PR",
        body: "Test body",
        label: "bug,enhancement",
        reviewer: "alice,bob",
      });

      expect(lastRunGhArgs()).toEqual([
        "pr", "create", "--title", "Test PR", "--body", "Test body",
        "--label", "bug", "--label", "enhancement",
        "--reviewer", "alice", "--reviewer", "bob",
      ]);
      expect(result.content[0].text).toContain("https://github.com/owner/repo/pull/42");
    });

    it("lists PRs with filters", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce([]);

      await executeTool(api, "gh_pr", {
        action: "list",
        state: "closed",
        label: "bug",
        limit: 5,
        repo: "owner/repo",
      });

      expect(lastRunGhJsonArgs()).toEqual([
        "pr", "list", "--json", "number,title,state,author,isDraft,headRefName,baseRefName",
        "--state", "closed", "--limit", "5", "--label", "bug", "--repo", "owner/repo",
      ]);
    });

    it("views a PR by number", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce({
        number: 42,
        title: "Test PR",
      });

      await executeTool(api, "gh_pr", { action: "view", number: 42 });
      expect(lastRunGhJsonArgs()).toContain("pr");
      expect(lastRunGhJsonArgs()).toContain("view");
      expect(lastRunGhJsonArgs()).toContain("42");
    });

    it("checks PR status", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "ci", state: "SUCCESS", bucket: "pass" }]),
        stderr: "",
        exitCode: 0,
      });

      await executeTool(api, "gh_pr", { action: "checks", number: 42, required: true });
      expect(lastRunGhArgs()).toContain("--required");
      expect(lastRunGhArgs()).toContain("42");
    });

    it("merges a PR with squash and branch deletion", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_pr", { action: "merge", number: 42, method: "squash", deleteBranch: true });
      expect(lastRunGhArgs()).toEqual([
        "pr", "merge", "42", "--squash", "--delete-branch",
      ]);
    });

    it("defaults PR merge method to merge", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_pr", { action: "merge", number: 42 });
      expect(lastRunGhArgs()).toEqual(["pr", "merge", "42", "--merge"]);
    });

    it("comments on a PR", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_pr", { action: "comment", number: 42, body: "LGTM" });
      expect(lastRunGhArgs()).toEqual(["pr", "comment", "42", "--body", "LGTM"]);
    });

    it("closes a PR with a comment", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_pr", { action: "close", number: 42, comment: "Closing" });
      expect(lastRunGhArgs()).toContain("close");
      expect(lastRunGhArgs()).toContain("--comment");
      expect(lastRunGhArgs()).toContain("Closing");
    });

    it("reopens a PR", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_pr", { action: "reopen", number: 42 });
      expect(lastRunGhArgs()).toEqual(["pr", "reopen", "42"]);
    });

    it("submits a PR review", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_pr", {
        action: "review",
        number: 42,
        reviewAction: "approve",
        body: "LGTM",
      });
      expect(lastRunGhArgs()).toEqual(["pr", "review", "42", "--approve", "--body", "LGTM"]);
    });

    it("shows a PR diff", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "diff output", stderr: "", exitCode: 0 });

      const result = await executeTool(api, "gh_pr", { action: "diff", number: 42 });
      expect(lastRunGhArgs()).toEqual(["pr", "diff", "42"]);
      expect(result.content[0].text).toBe("diff output");
    });
  });

  describe("Issue tools", () => {
    it("creates an issue", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({
        stdout: "https://github.com/owner/repo/issues/1",
        stderr: "",
        exitCode: 0,
      });

      await executeTool(api, "gh_issue", {
        action: "create",
        title: "Bug",
        body: "Details",
        label: "bug",
        assignee: "alice",
      });

      expect(lastRunGhArgs()).toEqual([
        "issue", "create", "--title", "Bug", "--body", "Details", "--label", "bug", "--assignee", "alice",
      ]);
    });

    it("lists issues", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce([]);

      await executeTool(api, "gh_issue", { action: "list", state: "all", limit: 10 });
      expect(lastRunGhJsonArgs()).toContain("issue");
      expect(lastRunGhJsonArgs()).toContain("list");
      expect(lastRunGhJsonArgs()).toContain("--state");
      expect(lastRunGhJsonArgs()).toContain("all");
    });

    it("views an issue", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce({ number: 1, title: "Bug" });

      await executeTool(api, "gh_issue", { action: "view", number: 1 });
      expect(lastRunGhJsonArgs()).toContain("issue");
      expect(lastRunGhJsonArgs()).toContain("view");
      expect(lastRunGhJsonArgs()).toContain("1");
    });

    it("comments on an issue", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_issue", { action: "comment", number: 1, body: "Thanks" });
      expect(lastRunGhArgs()).toEqual(["issue", "comment", "1", "--body", "Thanks"]);
    });

    it("closes an issue with reason", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_issue", { action: "close", number: 1, reason: "not_planned" });
      expect(lastRunGhArgs()).toContain("close");
      expect(lastRunGhArgs()).toContain("not_planned");
    });

    it("reopens an issue", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_issue", { action: "reopen", number: 1 });
      expect(lastRunGhArgs()).toEqual(["issue", "reopen", "1"]);
    });
  });

  describe("Run and workflow tools", () => {
    it("lists runs with filters", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce([]);

      await executeTool(api, "gh_run", { action: "list", workflow: "ci.yml", branch: "main", status: "failure" });
      expect(lastRunGhJsonArgs()).toContain("run");
      expect(lastRunGhJsonArgs()).toContain("list");
      expect(lastRunGhJsonArgs()).toContain("--workflow");
      expect(lastRunGhJsonArgs()).toContain("ci.yml");
    });

    it("views a run", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce({ databaseId: 123 });

      await executeTool(api, "gh_run", { action: "view", id: 123 });
      expect(lastRunGhJsonArgs()).toContain("run");
      expect(lastRunGhJsonArgs()).toContain("view");
      expect(lastRunGhJsonArgs()).toContain("123");
    });

    it("shows failed logs for a run", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "error log", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_run", { action: "view", id: 123, logFailed: true });
      expect(lastRunGhArgs()).toContain("--log-failed");
    });

    it("reruns a run", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_run", { action: "rerun", id: 123, failed: true });
      expect(lastRunGhArgs()).toEqual(["run", "rerun", "123", "--failed"]);
    });

    it("lists workflows", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce([]);

      await executeTool(api, "gh_workflow", { action: "list", all: true });
      expect(lastRunGhJsonArgs()).toContain("workflow");
      expect(lastRunGhJsonArgs()).toContain("list");
      expect(lastRunGhJsonArgs()).toContain("--all");
    });

    it("triggers a workflow", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      await executeTool(api, "gh_workflow", { action: "trigger", workflow: "deploy.yml", ref: "main", field: "env=prod" });
      expect(lastRunGhArgs()).toContain("workflow");
      expect(lastRunGhArgs()).toContain("run");
      expect(lastRunGhArgs()).toContain("deploy.yml");
      expect(lastRunGhArgs()).toContain("--field");
      expect(lastRunGhArgs()).toContain("env=prod");
    });
  });

  describe("Release tools", () => {
    it("lists releases", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce([]);

      await executeTool(api, "gh_release", { action: "list", excludeDrafts: true });
      expect(lastRunGhJsonArgs()).toContain("release");
      expect(lastRunGhJsonArgs()).toContain("list");
      expect(lastRunGhJsonArgs()).toContain("--exclude-drafts");
    });

    it("views a release", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGhJson.mockResolvedValueOnce({ tagName: "v1.0.0" });

      await executeTool(api, "gh_release", { action: "view", tag: "v1.0.0" });
      expect(lastRunGhJsonArgs()).toContain("release");
      expect(lastRunGhJsonArgs()).toContain("view");
      expect(lastRunGhJsonArgs()).toContain("v1.0.0");
    });

    it("creates a release", async () => {
      const api = createMockApi();
      registerGithubTools(api);
      mockRunGh.mockResolvedValueOnce({
        stdout: "https://github.com/owner/repo/releases/tag/v1.0.0",
        stderr: "",
        exitCode: 0,
      });

      await executeTool(api, "gh_release", { action: "create", tag: "v1.0.0", title: "Release", draft: true });
      expect(lastRunGhArgs()).toContain("release");
      expect(lastRunGhArgs()).toContain("create");
      expect(lastRunGhArgs()).toContain("v1.0.0");
      expect(lastRunGhArgs()).toContain("--draft");
    });
  });
});
