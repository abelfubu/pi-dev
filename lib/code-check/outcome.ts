import type { CheckResult, FailureKind } from "./types.js";
import type { RunResult } from "./runner.js";

export interface FinalizeOptions extends RunResult {
  command?: string;
  path?: string;
}

export function finalizeCheckResult(
  result: CheckResult,
  options: FinalizeOptions
): CheckResult {
  const { exitCode, stdout, stderr, command, path, failureKind } = options;
  result.exitCode = exitCode;
  result.command = command;
  result.failureKind = failureKind;

  if (exitCode === 0) return result;

  result.pass = false;
  if (result.errors === 0) {
    result.errors = 1;
    result.items.push({
      message: failureMessage(exitCode, stdout, stderr, path, failureKind),
      severity: "error",
    });
  }
  return result;
}

function failureMessage(
  exitCode: number,
  stdout: string,
  stderr: string,
  path?: string,
  failureKind?: FailureKind
): string {
  if (failureKind === "timeout") return "Check command timed out after 120 seconds";
  if (failureKind === "execution") {
    const firstLine = firstNonEmptyLine(stderr || stdout);
    return firstLine || `Check command could not be executed (exit ${exitCode})`;
  }
  if (path) return `Check command failed (exit ${exitCode}); the failure may be outside ${path}`;
  const firstLine = firstNonEmptyLine(stderr || stdout);
  return firstLine || `Check command failed with exit code ${exitCode}`;
}

function firstNonEmptyLine(text: string): string | undefined {
  return text.split("\n").find((line) => line.trim())?.trim();
}
