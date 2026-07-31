import { execFile } from "node:child_process";
import { resolve } from "node:path";

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TuicrSession {
  slug?: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface ReviewTarget {
  repoDir: string;
  baseSha: string;
  headSha: string;
  mergeBaseSha: string;
  revisions: string;
}

function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolveCommand, reject) => {
    execFile(command, args, { cwd, encoding: "utf8" }, (error, stdout, stderr) => {
      const code = (error as (NodeJS.ErrnoException & { code?: number }) | null)?.code;
      const exitCode = error ? (typeof code === "number" ? code : 1) : 0;
      const result = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
      };

      if (error && exitCode !== 1) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return reject(new Error(`${command} not found.`));
        }
        return reject(new Error(`${command} failed: ${result.stderr || result.stdout || error.message}`));
      }

      resolveCommand(result);
    });
  });
}

async function runRequired(command: string, args: string[], cwd: string): Promise<string> {
  const result = await runCommand(command, args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
  }
  return result.stdout;
}

export async function resolveReviewTarget(repoDir: string, baseRef: string): Promise<ReviewTarget> {
  const requestedDir = resolve(repoDir);
  const root = await runRequired("git", ["rev-parse", "--show-toplevel"], requestedDir);
  const baseSha = await runRequired("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], root);
  const headSha = await runRequired("git", ["rev-parse", "--verify", "HEAD^{commit}"], root);
  const mergeBaseSha = await runRequired("git", ["merge-base", baseSha, headSha], root);
  const diff = await runCommand("git", ["diff", "--quiet", mergeBaseSha, headSha, "--"], root);

  if (diff.exitCode === 0) {
    throw new Error(`No changes to review between ${baseRef} and HEAD.`);
  }
  if (diff.exitCode !== 1) {
    throw new Error(`git diff failed: ${diff.stderr || diff.stdout || `exit ${diff.exitCode}`}`);
  }

  return {
    repoDir: root,
    baseSha,
    headSha,
    mergeBaseSha,
    revisions: `${mergeBaseSha}..${headSha}`,
  };
}

export async function listTuicrSessions(repoDir: string): Promise<TuicrSession[]> {
  const output = await runRequired("tuicr", ["review", "list", "--repo", repoDir], repoDir);
  if (!output) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(`tuicr returned non-JSON session data: ${output.slice(0, 500)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("tuicr returned invalid session data.");
  }
  return parsed as TuicrSession[];
}

export async function readTuicrComments(repoDir: string, session: string): Promise<unknown[]> {
  const output = await runRequired(
    "tuicr",
    ["review", "comments", "--repo", repoDir, "--session", session],
    repoDir,
  );
  if (!output) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(`tuicr returned non-JSON comments: ${output.slice(0, 500)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("tuicr returned invalid comments data.");
  }
  return parsed;
}
