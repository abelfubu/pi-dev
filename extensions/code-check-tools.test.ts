import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerExtension from "./code-check-tools.js";

interface ToolDef {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: unknown;
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

  it("registers only Node checks in a TypeScript/Node project", async () => {
    await writeFile(
      join(tmpDir, "package.json"),
      JSON.stringify({ devDependencies: { typescript: "^5", vitest: "^2" } })
    );
    await writeFile(join(tmpDir, "tsconfig.json"), "{}");

    const pi = createMockPi();
    await registerExtension(pi);
    const names = pi.tools.map((t: ToolDef) => t.name).sort();

    expect(names).toContain("code_check");
    expect(names).toContain("code_check_discover");
    expect(names).toContain("code_check_parallel");
    expect(names).not.toContain("code_check_cargo_check");
    expect(names).not.toContain("code_check_cargo_clippy");
    expect(names).not.toContain("code_check_cargo_test");
  });

  it("registers only Rust checks in a Cargo project", async () => {
    await writeFile(
      join(tmpDir, "Cargo.toml"),
      "[package]\nname = \"x\"\nversion = \"0.1.0\"\n"
    );

    const pi = createMockPi();
    await registerExtension(pi);
    const names = pi.tools.map((t: ToolDef) => t.name).sort();

    expect(names).toContain("code_check");
    expect(names).toContain("code_check_discover");
    expect(names).toContain("code_check_parallel");
    expect(names).not.toContain("code_check_tsc");
    expect(names).not.toContain("code_check_vitest");
    expect(names).not.toContain("code_check_eslint");
  });

  it("registers no individual checks when the project has no recognized checks", async () => {
    const pi = createMockPi();
    await registerExtension(pi);
    const names = pi.tools.map((t: ToolDef) => t.name).sort();

    expect(names).toEqual(["code_check_discover", "code_check_parallel"]);
  });
});
