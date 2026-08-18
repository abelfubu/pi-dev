import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverCodeChecks } from "./discover.js";

describe("discoverCodeChecks", () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "code-check-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers repository-owned package scripts", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({
      packageManager: "pnpm@10.0.0",
      scripts: {
        lint: "turbo run lint",
        typecheck: "turbo run typecheck",
        test: "turbo run test",
        build: "turbo run build",
      },
    }));

    const { checks } = await discoverCodeChecks(tempDir);

    expect(checks).toEqual([
      { name: "lint", command: "pnpm run lint", source: "package.json" },
      { name: "typecheck", command: "pnpm run typecheck", source: "package.json" },
      { name: "test", command: "pnpm run test", source: "package.json" },
    ]);
  });

  it("does not infer commands from installed dependencies", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({
      devDependencies: { eslint: "^9", typescript: "^5", vitest: "^3" },
    }));

    expect((await discoverCodeChecks(tempDir)).checks).toEqual([]);
  });

  it("detects the package manager from its lockfile", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { check: "turbo run check" } }));
    await writeFile(join(tempDir, "yarn.lock"), "");

    expect((await discoverCodeChecks(tempDir)).checks[0]?.command).toBe("yarn run check");
  });

  it("uses configured arbitrary commands instead of auto-discovery", async () => {
    await mkdir(join(tempDir, ".pi"));
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }));
    await writeFile(join(tempDir, ".pi", "pi-dev.json"), JSON.stringify({
      codeChecks: {
        verify: { command: "make verify" },
        smoke: "./scripts/smoke",
      },
    }));

    expect((await discoverCodeChecks(tempDir)).checks).toEqual([
      { name: "verify", command: "make verify", source: "config" },
      { name: "smoke", command: "./scripts/smoke", source: "config" },
    ]);
  });

  it("discovers Cargo commands", async () => {
    await writeFile(join(tempDir, "Cargo.toml"), "[package]\nname = \"test\"\nversion = \"0.1.0\"\n");

    expect((await discoverCodeChecks(tempDir)).checks.map((check) => check.name)).toEqual([
      "cargo-check",
      "cargo-clippy",
      "cargo-test",
    ]);
  });
});
