import { describe, expect, it } from "vitest";
import { formatCheckResult } from "./format.js";
import { finalizeCheckResult } from "./outcome.js";
import type { CheckResult } from "./types.js";

function passingResult(): CheckResult {
  return { tool: "tsc", pass: true, errors: 0, warnings: 0, items: [] };
}

describe("finalizeCheckResult", () => {
  it("never turns a non-zero exit into a pass after path filtering", () => {
    const result = finalizeCheckResult(passingResult(), {
      exitCode: 2,
      stdout: "src/other.ts(1,1): error TS1: broken",
      stderr: "",
      path: "src/target.ts",
      command: "npx tsc --noEmit --pretty false",
    });

    expect(result.pass).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.items[0]?.message).toContain("outside src/target.ts");
    expect(result.command).toBe("npx tsc --noEmit --pretty false");
    expect(result.exitCode).toBe(2);
  });

  it("preserves a successful result", () => {
    const result = finalizeCheckResult(passingResult(), {
      exitCode: 0,
      stdout: "",
      stderr: "",
      command: "npm run typecheck",
    });

    expect(result.pass).toBe(true);
    expect(result.command).toBe("npm run typecheck");
    expect(result.exitCode).toBe(0);
  });

  it("surfaces execution failures distinctly", () => {
    const result = finalizeCheckResult(passingResult(), {
      exitCode: 127,
      stdout: "",
      stderr: "tool: command not found",
      failureKind: "execution",
    });

    expect(result.pass).toBe(false);
    expect(result.failureKind).toBe("execution");
    expect(formatCheckResult(result)).toContain("could not execute");
  });

  it("surfaces timeouts distinctly", () => {
    const result = finalizeCheckResult(passingResult(), {
      exitCode: 1,
      stdout: "",
      stderr: "",
      failureKind: "timeout",
    });

    expect(result.pass).toBe(false);
    expect(result.items[0]?.message).toContain("timed out");
    expect(formatCheckResult(result)).toContain("timed out");
  });
});
