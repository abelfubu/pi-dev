import { finalizeCheckResult } from "../outcome.js";
import { runCommand } from "../runner.js";
import type { CheckItem, CheckResult } from "../types.js";

export async function runEslint(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const target = path ? JSON.stringify(path) : ".";
  const command = override
    ? `${override}${path ? ` ${target}` : ""}`
    : `npx eslint ${target} --format json`;

  const run = await runCommand(command, cwd);
  const { exitCode, stdout, stderr } = run;

  let results: unknown[] = [];
  try {
    results = JSON.parse(stdout);
  } catch {
    // If override produced non-JSON, fall back to raw text.
  }

  if (!Array.isArray(results)) {
    const text = stderr || stdout;
    return finalizeCheckResult(
      {
        tool: "eslint",
        pass: exitCode === 0,
        errors: exitCode === 0 ? 0 : 1,
        warnings: 0,
        items: text
          ? [{ message: text.split("\n")[0] ?? text, severity: exitCode === 0 ? undefined : "error" }]
          : [],
        raw: text.slice(0, 2000),
      },
      { ...run, command, path }
    );
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
  return finalizeCheckResult(
    {
      tool: "eslint",
      pass: errors === 0,
      errors,
      warnings,
      items,
    },
    { ...run, command, path }
  );
}
