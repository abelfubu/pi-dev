import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { FailureKind } from "./types.js";

const execAsync = promisify(exec);

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  failureKind?: FailureKind;
}

export async function runCommand(command: string, cwd: string): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
    });
    return { exitCode: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (err: any) {
    const exitCode = typeof err.code === "number" ? err.code : 1;
    const failureKind: FailureKind | undefined =
      err.killed || err.code === "ETIMEDOUT"
        ? "timeout"
        : exitCode === 126 || exitCode === 127
          ? "execution"
          : undefined;
    return {
      exitCode,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      failureKind,
    };
  }
}
