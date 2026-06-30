import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
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
    return {
      exitCode: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}
