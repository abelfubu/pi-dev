import { finalizeCheckResult } from "../outcome.js";
import { runCommand } from "../runner.js";
import type { CheckResult } from "../types.js";
import { filterByPath, parseCargoMessages } from "./cargo.js";

export async function runCargoCheck(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const command = override ? override : `cargo check --message-format=json`;
  const run = await runCommand(command, cwd);
  const result = parseCargoCheckOutput(run.exitCode, run.stdout, run.stderr, path);
  result.command = command;
  result.failureKind = run.failureKind;
  return result;
}

export function parseCargoCheckOutput(
  exitCode: number,
  stdout: string,
  stderr: string,
  path?: string
): CheckResult {
  const items = parseCargoMessages(stdout);
  const filtered = filterByPath(items, path);
  const errors = filtered.filter((i) => i.severity === "error").length;
  const warnings = filtered.filter((i) => i.severity === "warning").length;

  return finalizeCheckResult(
    {
      tool: "cargo_check",
      pass: errors === 0,
      errors,
      warnings,
      items: filtered,
      raw: (stderr || stdout).slice(0, 2000),
    },
    { exitCode, stdout, stderr, path }
  );
}
