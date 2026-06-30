import { runCommand } from "../runner.js";
import type { CheckItem, CheckResult, ToolName } from "../types.js";

export async function runEslint(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const target = path ? JSON.stringify(path) : ".";
  const command = override
    ? `${override}${path ? ` ${target}` : ""}`
    : `npx eslint ${target} --format json`;

  const { exitCode, stdout, stderr } = await runCommand(command, cwd);

  let results: unknown[] = [];
  try {
    results = JSON.parse(stdout);
  } catch {
    // If override produced non-JSON, fall back to raw text.
  }

  if (!Array.isArray(results)) {
    return rawResult("eslint", exitCode, stdout, stderr);
  }

  const items: CheckItem[] = [];
  for (const fileResult of results) {
    const file = (fileResult as any).filePath as string | undefined;
    const messages = (fileResult as any).messages as any[] | undefined;
    for (const m of messages ?? []) {
      items.push({
        file,
        line: typeof m.line === "number" ? m.line : undefined,
        column: typeof m.column === "number" ? m.column : undefined,
        message: String(m.message ?? ""),
        severity: m.severity === 2 ? "error" : "warning",
      });
    }
  }

  const errors = items.filter((i) => i.severity === "error").length;
  const warnings = items.filter((i) => i.severity === "warning").length;
  return {
    tool: "eslint",
    pass: errors === 0,
    errors,
    warnings,
    items,
  };
}

function rawResult(
  tool: ToolName,
  exitCode: number,
  stdout: string,
  stderr: string
): CheckResult {
  const text = stderr || stdout;
  return {
    tool,
    pass: exitCode === 0,
    errors: exitCode === 0 ? 0 : 1,
    warnings: 0,
    items: text
      ? [{ message: text.split("\n")[0] ?? text }]
      : [],
    raw: text.slice(0, 2000),
  };
}
