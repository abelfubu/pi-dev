import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CheckDefinition, CheckResult, FailureKind } from "./types.js";

const execAsync = promisify(exec);
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const MAX_ITEMS = 3;

export async function runCheck(check: CheckDefinition, cwd: string): Promise<CheckResult> {
  try {
    const { stdout, stderr } = await execAsync(check.command, {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return await result(check, 0, stdout ?? "", stderr ?? "");
  } catch (error: unknown) {
    const err = error as {
      code?: number | string;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
    };
    const exitCode = typeof err.code === "number" ? err.code : 1;
    const failureKind: FailureKind | undefined =
      err.killed || err.code === "ETIMEDOUT"
        ? "timeout"
        : exitCode === 126 || exitCode === 127
          ? "execution"
          : undefined;
    return await result(check, exitCode, err.stdout ?? "", err.stderr ?? "", failureKind);
  }
}

async function result(
  check: CheckDefinition,
  exitCode: number,
  stdout: string,
  stderr: string,
  failureKind?: FailureKind,
): Promise<CheckResult> {
  const output = stripAnsi([stdout, stderr].filter(Boolean).join("\n")).trim();
  const outputFile = exitCode === 0 || !output ? undefined : await saveFailureOutput(check.name, output);
  return {
    name: check.name,
    command: check.command,
    pass: exitCode === 0,
    exitCode,
    failureKind,
    items: exitCode === 0 ? [] : diagnosticLines(output, failureKind),
    outputFile,
  };
}

function diagnosticLines(raw: string, failureKind?: FailureKind): Array<{ message: string }> {
  if (failureKind === "timeout") return [{ message: "Command timed out after 120 seconds" }];
  if (!raw) return [{ message: "Command failed without output" }];

  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const diagnostic = lines.filter((line) => /\b(error|fail(?:ed|ure)?|panic)\b/i.test(line));
  const selected = diagnostic.length > 0 ? diagnostic : lines.slice(-MAX_ITEMS);
  return selected.slice(0, MAX_ITEMS).map((message) => ({ message }));
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

async function saveFailureOutput(name: string, output: string): Promise<string | undefined> {
  const safeName = name.replace(/[^a-z0-9_-]+/gi, "-");
  const path = join(tmpdir(), `pi-code-check-${safeName}-${Date.now()}.log`);
  try {
    await writeFile(path, output, "utf8");
    return path;
  } catch {
    return undefined;
  }
}
