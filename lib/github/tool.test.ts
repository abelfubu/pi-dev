import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerGhActionTool, type GhActionToolConfig } from "./tool.js";

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

function createConfig() {
  return {
    name: "gh_sample",
    label: "Sample",
    description: "Sample tool",
    parameters: Type.Object({
      action: Type.String(),
      repo: Type.Optional(Type.String()),
      value: Type.Optional(Type.String()),
    }),
    handlers: {
      text: {
        runType: "text" as const,
        buildArgs: (params: { value?: string }) => ["sample", "text", params.value ?? "default"],
        format: (result: unknown) => String((result as { stdout: string }).stdout),
      },
      json: {
        runType: "json" as const,
        buildArgs: () => ["sample", "json"],
        format: (result: unknown) => JSON.stringify(result),
      },
      error: {
        runType: "text" as const,
        buildArgs: () => ["sample", "error"],
        format: () => "should not reach",
      },
    },
  };
}

describe("registerGhActionTool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("registers a tool with the provided config", () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());

    expect(api.tools.has("gh_sample")).toBe(true);
    const tool = api.getTool("gh_sample");
    expect(tool.label).toBe("Sample");
    expect(tool.description).toBe("Sample tool");
  });

  it("dispatches to the handler matching params.action", async () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());
    mockRunGh.mockResolvedValueOnce({ stdout: "text output", stderr: "", exitCode: 0 });

    const result = await executeTool(api, "gh_sample", { action: "text", value: "hello" });
    expect(mockRunGh).toHaveBeenCalledWith(["sample", "text", "hello"], process.cwd());
    expect(result.content[0].text).toBe("text output");
    expect(result.details).toEqual({});
  });

  it("uses runGhJson for runType: json handlers", async () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());
    mockRunGhJson.mockResolvedValueOnce({ ok: true });

    const result = await executeTool(api, "gh_sample", { action: "json" });
    expect(mockRunGhJson).toHaveBeenCalledWith(["sample", "json"], process.cwd());
    expect(result.content[0].text).toBe('{"ok":true}');
  });

  it("resolves cwd from ctx.cwd when provided", async () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());
    mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await executeTool(api, "gh_sample", { action: "text" }, { cwd: "/tmp/repo" });
    expect(mockRunGh).toHaveBeenCalledWith(["sample", "text", "default"], "/tmp/repo");
  });

  it("injects --repo when params.repo is present", async () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());
    mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

    await executeTool(api, "gh_sample", { action: "text", repo: "owner/repo" });
    expect(mockRunGh).toHaveBeenCalledWith(
      ["sample", "text", "default", "--repo", "owner/repo"],
      process.cwd(),
    );
  });

  it("passes exitCode to format for text handlers", async () => {
    const api = createMockApi();
    registerGhActionTool(api, {
      name: "gh_exit",
      label: "Exit",
      description: "Exit tool",
      parameters: Type.Object({ action: Type.String() }),
      handlers: {
        check: {
          runType: "text",
          buildArgs: () => ["exit"],
          format: (result) => String((result as { exitCode: number }).exitCode),
        },
      },
    });
    mockRunGh.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 8 });

    const result = await executeTool(api, "gh_exit", { action: "check" });
    expect(result.content[0].text).toBe("8");
  });

  it("returns isError: true when execution throws", async () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());
    mockRunGh.mockRejectedValueOnce(new Error("boom"));

    const result = await executeTool(api, "gh_sample", { action: "error" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("boom");
  });

  it("returns isError: true for unknown actions", async () => {
    const api = createMockApi();
    registerGhActionTool(api, createConfig());

    const result = await executeTool(api, "gh_sample", { action: "unknown" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unknown");
  });
});
