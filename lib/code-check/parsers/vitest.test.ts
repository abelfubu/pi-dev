import { describe, expect, it } from "vitest";
import { resolveVitestTarget } from "./vitest.js";

describe("resolveVitestTarget", () => {
  it("uses a sibling test file when given a source file", async () => {
    await expect(resolveVitestTarget(process.cwd(), "extensions/diffview-tools.ts")).resolves.toBe(
      "extensions/diffview-tools.test.ts",
    );
  });

  it("keeps an explicit test file", async () => {
    await expect(
      resolveVitestTarget(process.cwd(), "extensions/diffview-tools.test.ts"),
    ).resolves.toBe("extensions/diffview-tools.test.ts");
  });

  it("runs the full suite when the source has no sibling test", async () => {
    await expect(resolveVitestTarget(process.cwd(), "extensions/does-not-exist.ts")).resolves.toBe(
      undefined,
    );
  });

  it("keeps directories as targets", async () => {
    await expect(resolveVitestTarget(process.cwd(), "extensions")).resolves.toBe("extensions");
  });
});
