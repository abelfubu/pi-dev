import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runCheck } from "./runner.js";

describe("runCheck", () => {
  it("uses the command exit code as the outcome", async () => {
    const result = await runCheck(
      { name: "verify", command: "printf 'all good'; exit 2", source: "config" },
      process.cwd(),
    );

    expect(result.pass).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.command).toBe("printf 'all good'; exit 2");
    expect(result).not.toHaveProperty("raw");
    expect(await readFile(result.outputFile!, "utf8")).toBe("all good");
  });

  it("returns concise failure diagnostics", async () => {
    const result = await runCheck(
      { name: "test", command: "printf 'header\\nError: broken\\nnoise\\n'; exit 1", source: "config" },
      process.cwd(),
    );

    expect(result.items).toEqual([{ message: "Error: broken" }]);
  });
});
