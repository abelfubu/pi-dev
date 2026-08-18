import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerExtension from "./code-check-tools.js";

interface ToolDef {
  name: string;
  execute: (...args: any[]) => Promise<any>;
}

type MockPi = ExtensionAPI & { tools: ToolDef[] };

function createMockPi(): MockPi {
  const tools: ToolDef[] = [];
  return {
    tools,
    registerTool(def: ToolDef) {
      tools.push(def);
    },
  } as unknown as MockPi;
}

async function createTempDir(): Promise<string> {
  const dir = join(tmpdir(), `pi-dev-code-check-test-${Date.now()}-${Math.random()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("code-check-tools extension", () => {
  let originalCwd: string;
  let originalHome: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalHome = process.env.HOME;
    tmpDir = await createTempDir();
    process.env.HOME = tmpDir;
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.chdir(originalCwd);
  });

  it("always registers only the generic list and run tools", async () => {
    const pi = createMockPi();
    await registerExtension(pi);

    expect(pi.tools.map((tool) => tool.name).sort()).toEqual(["code_check", "code_check_list"]);
  });

  it("lists zero-config package scripts", async () => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ scripts: { typecheck: "turbo run typecheck" } }));
    const pi = createMockPi();
    await registerExtension(pi);
    const tool = pi.tools.find((candidate) => candidate.name === "code_check_list")!;

    const result = await tool.execute("id", {}, undefined, undefined, { cwd: tmpDir });

    expect(result.content[0].text).toContain("typecheck: npm run typecheck");
  });

  it("rejects unknown checks", async () => {
    await writeFile(join(tmpDir, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }));
    const pi = createMockPi();
    await registerExtension(pi);
    const tool = pi.tools.find((candidate) => candidate.name === "code_check")!;

    const result = await tool.execute("id", { names: ["lint"] }, undefined, undefined, { cwd: tmpDir });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown code checks: lint");
  });
});
