import { execFile } from "node:child_process";
import { resolve } from "node:path";

interface WorktrunkResult {
  stdout: string;
  stderr: string;
}

export interface WorktreeInfo {
  branch: string;
  path: string;
  current?: boolean;
  main?: boolean;
  modified?: boolean;
  untracked?: boolean;
}

function runWorktrunk(args: string[], cwd: string): Promise<WorktrunkResult> {
  return new Promise((resolveRun, reject) => {
    execFile("wt", ["-C", cwd, ...args], { cwd, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return reject(new Error("wt not found. Install Worktrunk from https://worktrunk.dev/."));
        }
        return reject(new Error(`wt failed: ${stderr.trim() || stdout.trim() || error.message}`));
      }
      resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`wt returned non-JSON output: ${output.slice(0, 500)}`);
  }
}

export async function createWorktree(
  repoDir: string,
  branch: string,
  baseRef: string,
): Promise<WorktreeInfo> {
  const cwd = resolve(repoDir);
  const result = await runWorktrunk(
    ["switch", "--create", branch, "--base", baseRef, "--no-cd", "--format=json", "--yes"],
    cwd,
  );
  const parsed = parseJson(result.stdout) as { branch?: unknown; path?: unknown };
  if (typeof parsed.branch !== "string" || typeof parsed.path !== "string") {
    throw new Error("wt returned invalid create data.");
  }
  return { branch: parsed.branch, path: parsed.path };
}

export async function listWorktrees(repoDir: string): Promise<WorktreeInfo[]> {
  const cwd = resolve(repoDir);
  const result = await runWorktrunk(["list", "--format=json"], cwd);
  const parsed = parseJson(result.stdout) as {
    items?: Array<{
      branch?: unknown;
      path?: unknown;
      main?: unknown;
      current?: unknown;
      changes?: { working_tree?: { modified?: unknown; untracked?: unknown } };
    }>;
  };
  if (!Array.isArray(parsed.items)) throw new Error("wt returned invalid list data.");

  return parsed.items.flatMap((item) => {
    if (typeof item.branch !== "string" || typeof item.path !== "string") return [];
    return [{
      branch: item.branch,
      path: item.path,
      main: item.main === true,
      current: item.current === true,
      modified: item.changes?.working_tree?.modified === true,
      untracked: item.changes?.working_tree?.untracked === true,
    }];
  });
}

export async function removeWorktree(repoDir: string, branch: string): Promise<unknown> {
  const cwd = resolve(repoDir);
  const result = await runWorktrunk(
    ["remove", branch, "--foreground", "--format=json", "--yes"],
    cwd,
  );
  return parseJson(result.stdout);
}
