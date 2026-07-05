import { runCommand } from "../runner.js";
import type { CheckResult } from "../types.js";
import { filterByPath, parseCargoMessages } from "./cargo.js";

export async function runCargoClippy(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const command = override ? override : `cargo clippy --message-format=json`;
  const { exitCode, stdout, stderr } = await runCommand(command, cwd);
  return parseCargoClippyOutput(exitCode, stdout, stderr, path);
}

export function parseCargoClippyOutput(
  exitCode: number,
  stdout: string,
  stderr: string,
  path?: string
): CheckResult {
  const items = parseCargoMessages(stdout);
  const filtered = filterByPath(items, path);
  const errors = filtered.filter((i) => i.severity === "error").length;
  const warnings = filtered.filter((i) => i.severity === "warning").length;

  return {
    tool: "cargo_clippy",
    pass: errors === 0,
    errors,
    warnings,
    items: filtered,
    raw: (stderr || stdout).slice(0, 2000),
  };
}
