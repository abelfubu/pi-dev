import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "../runner.js";
import type { CheckItem, CheckResult, ToolName } from "../types.js";

export async function runVitest(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const target = path ? JSON.stringify(path) : "";
  let outputFile: string | undefined;
  let command: string;

  if (override) {
    command = `${override}${target ? ` ${target}` : ""}`;
  } else {
    outputFile = join(tmpdir(), `vitest-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    command = `npx vitest run ${target} --reporter=json --outputFile=${JSON.stringify(outputFile)}`;
  }

  const { exitCode, stdout, stderr } = await runCommand(command, cwd);

  const result = await parseVitestOutput(outputFile, stdout, stderr, exitCode);
  if (outputFile) {
    try {
      await unlink(outputFile);
    } catch {
      // ignore
    }
  }
  return result;
}

async function parseVitestOutput(
  outputFile: string | undefined,
  stdout: string,
  stderr: string,
  exitCode: number
): Promise<CheckResult> {
  let raw: string | undefined;
  try {
    if (outputFile) {
      raw = await readFile(outputFile, "utf8");
    } else {
      raw = stdout || stderr;
    }
  } catch {
    raw = stdout || stderr;
  }

  if (!raw) {
    return rawResult("vitest", exitCode, stdout, stderr);
  }

  try {
    const report = JSON.parse(raw);
    const items: CheckItem[] = [];
    const testResults = Array.isArray(report.testResults) ? report.testResults : [];
    for (const suite of testResults) {
      const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];
      for (const assertion of assertions) {
        if (assertion.status === "failed") {
          items.push({
            file: suite.name,
            line: assertion.location?.line,
            column: assertion.location?.column,
            message: String(assertion.failureMessages?.[0] ?? assertion.title ?? "failed"),
            severity: "error",
          });
        }
      }
    }

    const errors = items.filter((i) => i.severity === "error").length;
    return {
      tool: "vitest",
      pass: errors === 0,
      errors,
      warnings: 0,
      items,
    };
  } catch {
    return rawResult("vitest", exitCode, stdout, stderr);
  }
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
    items: text ? [{ message: text.split("\n")[0] ?? text }] : [],
    raw: text.slice(0, 2000),
  };
}
