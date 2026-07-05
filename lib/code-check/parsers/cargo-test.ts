import { runCommand } from "../runner.js";
import type { CheckItem, CheckResult } from "../types.js";
import { filterByPath, parseCargoMessages } from "./cargo.js";

export async function runCargoTest(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const command = override ? override : `cargo test --message-format=json`;
  const { exitCode, stdout, stderr } = await runCommand(command, cwd);
  return parseCargoTestOutput(exitCode, stdout, stderr, path);
}

export function parseCargoTestOutput(
  exitCode: number,
  stdout: string,
  stderr: string,
  path?: string
): CheckResult {
  const text = stdout || stderr;
  const messageItems = parseCargoMessages(text);
  const testItems = parseCargoTestFailures(text);

  const items = [...messageItems, ...testItems];
  const filtered = filterByPath(items, path);

  const errors = filtered.filter((i) => i.severity === "error").length;
  const warnings = filtered.filter((i) => i.severity === "warning").length;

  if (errors === 0 && warnings === 0 && exitCode !== 0 && text.trim()) {
    return {
      tool: "cargo_test",
      pass: false,
      errors: 1,
      warnings: 0,
      items: [
        {
          message: text.trim().split("\n")[0] ?? text.trim(),
          severity: "error",
        },
      ],
      raw: text.slice(0, 2000),
    };
  }

  return {
    tool: "cargo_test",
    pass: errors === 0,
    errors,
    warnings,
    items: filtered,
    raw: text.slice(0, 2000),
  };
}

function parseCargoTestFailures(text: string): CheckItem[] {
  const items: CheckItem[] = [];
  const lines = text.split("\n");
  const failureHeaderRe = /^---- (\S+) stdout ----$/;
  const panicRe = /^thread '([^']+)' panicked at ([^:]+):(\d+):(\d+):$/;

  for (let i = 0; i < lines.length; i++) {
    const match = failureHeaderRe.exec(lines[i]);
    if (!match) continue;
    const testName = match[1];
    let file: string | undefined;
    let line: number | undefined;
    let column: number | undefined;

    for (let j = i + 1; j < lines.length && j < i + 10; j++) {
      const panicMatch = panicRe.exec(lines[j]);
      if (panicMatch) {
        file = panicMatch[2];
        line = Number(panicMatch[3]);
        column = Number(panicMatch[4]);
        break;
      }
    }

    items.push({
      file,
      line,
      column,
      message: `Test '${testName}' failed`,
      severity: "error",
    });
  }

  return items;
}
