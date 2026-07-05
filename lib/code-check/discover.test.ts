import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverCodeChecks } from "./discover.js";

describe("discoverCodeChecks", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "code-check-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects TypeScript checks from package.json", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { eslint: "^9", typescript: "^5", vitest: "^3" } })
    );
    const { available } = await discoverCodeChecks(tempDir);
    expect(available).toContain("eslint");
    expect(available).toContain("tsc");
    expect(available).toContain("vitest");
  });

  it("detects Rust checks from Cargo.toml", async () => {
    await writeFile(join(tempDir, "Cargo.toml"), "[package]\nname = \"test\"\nversion = \"0.1.0\"\n");
    const { available } = await discoverCodeChecks(tempDir);
    expect(available).toContain("cargo_check");
    expect(available).toContain("cargo_clippy");
    expect(available).toContain("cargo_test");
  });

  it("detects mixed JS and Rust projects", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { eslint: "^9" } })
    );
    await writeFile(join(tempDir, "Cargo.toml"), "[package]\nname = \"test\"\nversion = \"0.1.0\"\n");
    const { available } = await discoverCodeChecks(tempDir);
    expect(available).toContain("eslint");
    expect(available).toContain("cargo_check");
  });
});
