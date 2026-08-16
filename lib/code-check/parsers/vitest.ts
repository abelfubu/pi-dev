import { access, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { finalizeCheckResult } from "../outcome.js";
import { runCommand, type RunResult } from "../runner.js";
import type { CheckItem, CheckResult } from "../types.js";

export async function resolveVitestTarget(cwd: string, path?: string): Promise<string | undefined> {
  if (!path || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) return path;

  const extension = extname(path);
  if (!extension) return path;

  const candidate = join(dirname(path), `${basename(path, extension)}.test${extension}`);
  try {
    await access(resolve(cwd, candidate));
    return candidate;
  } catch {
    return undefined;
  }
}

export async function runVitest(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const targetPath = await resolveVitestTarget(cwd, path);
  const target = targetPath ? JSON.stringify(targetPath) : "";
  let outputFile: string | undefined;
  let command: string;

  if (override) {
    command = `${override}${target ? ` ${target}` : ""}`;
  } else {
    outputFile = join(tmpdir(), `vitest-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    command = `npx vitest run ${target} --reporter=json --outputFile=${JSON.stringify(outputFile)}`;
  }

  const run = await runCommand(command, cwd);

  const result = await parseVitestOutput(outputFile, run, command, path);
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
  run: RunResult,
  command: string,
  path?: string
): Promise<CheckResult> {
  const { stdout, stderr } = run;
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
    return rawResult(run, command, path);
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
    return finalizeCheckResult(
      {
        tool: "vitest",
        pass: errors === 0,
        errors,
        warnings: 0,
        items,
      },
      { ...run, command, path }
    );
  } catch {
    return rawResult(run, command, path);
  }
}

function rawResult(run: RunResult, command: string, path?: string): CheckResult {
  const { exitCode, stdout, stderr } = run;
  const text = stderr || stdout;
  return finalizeCheckResult(
    {
      tool: "vitest",
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
