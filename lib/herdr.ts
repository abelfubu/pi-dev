import { execFile } from "node:child_process";

export interface HerdrResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface HerdrPane {
  paneId?: string;
  tabId?: string;
}

export async function runHerdr(args: string[], cwd?: string): Promise<HerdrResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "herdr",
      args,
      { encoding: "utf8", cwd },
      (err, stdout, stderr) => {
        const code = child.exitCode ?? (err ? 1 : 0);
        if (err && code !== 0) {
          const detail = stderr.trim() || stdout.trim() || err.message;
          if (
            err.message.includes("ENOENT") ||
            (err as NodeJS.ErrnoException).code === "ENOENT"
          ) {
            return reject(
              new Error(
                "herdr not found. Make sure you are running inside a Herdr-managed pane.",
              ),
            );
          }
          return reject(new Error(`herdr failed: ${detail}`));
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
      },
    );
  });
}

export async function runHerdrJson<T = unknown>(
  args: string[],
  cwd?: string,
): Promise<T> {
  const result = await runHerdr(args, cwd);
  if (!result.stdout) return {} as T;
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(`herdr returned non-JSON: ${result.stdout.slice(0, 500)}`);
  }
}

export function shellQuote(arg: string): string {
  if (!/[^a-zA-Z0-9._~:\/-]/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function parseHerdrPaneIds(result: unknown): HerdrPane {
  const r = result as any;
  return {
    tabId: r?.result?.tab?.tab_id as string | undefined,
    paneId: (r?.result?.root_pane?.pane_id ?? r?.result?.pane?.pane_id) as
      | string
      | undefined,
  };
}

export async function createHerdrPane(
  layout: "tab" | "pane",
  label: string,
  cwd?: string,
): Promise<HerdrPane> {
  if (layout === "tab") {
    const tabResult = await runHerdrJson([
      "tab",
      "create",
      "--label",
      label,
      ...(cwd ? ["--cwd", cwd] : []),
    ]);
    return parseHerdrPaneIds(tabResult);
  }

  const splitResult = await runHerdrJson([
    "pane",
    "split",
    "--current",
    "--direction",
    "right",
    "--no-focus",
    ...(cwd ? ["--cwd", cwd] : []),
  ]);
  const { paneId } = parseHerdrPaneIds(splitResult);
  if (paneId) {
    await runHerdr(["pane", "rename", paneId, label]);
  }
  return { paneId };
}

export async function runInPane(paneId: string, command: string): Promise<void> {
  await runHerdr(["pane", "run", paneId, command]);
}

export async function notifyPane(paneId: string, message: string): Promise<void> {
  await runInPane(paneId, message);
}
