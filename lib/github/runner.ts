import { execFile } from "node:child_process";

export interface GhResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runGh(args: string[], cwd?: string): Promise<GhResult> {
  return new Promise((resolve, reject) => {
    const child = execFile("gh", args, { encoding: "utf8", cwd }, (err, stdout, stderr) => {
      const code = child.exitCode ?? (err ? 1 : 0);

      // gh pr checks uses exit code 8 when checks are pending; we still want the output.
      if (err && code !== 8) {
        const detail = stderr.trim() || stdout.trim() || err.message;
        if (
          err.message.includes("ENOENT") ||
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return reject(
            new Error(
              "gh not found. Install the GitHub CLI: https://cli.github.com",
            ),
          );
        }
        return reject(new Error(`gh failed: ${detail}`));
      }

      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
    });
  });
}

export async function runGhJson(
  args: string[],
  cwd?: string,
): Promise<unknown> {
  const result = await runGh(args, cwd);
  if (!result.stdout) return {};
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`gh returned non-JSON: ${result.stdout.slice(0, 500)}`);
  }
}
