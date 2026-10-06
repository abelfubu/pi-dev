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

export interface HerdrParentContext {
  paneId: string;
  workspaceId: string;
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
  parent?: HerdrParentContext,
  focus = false,
): Promise<HerdrPane> {
  if (layout === "tab") {
    const tabResult = await runHerdrJson([
      "tab",
      "create",
      ...(parent ? ["--workspace", parent.workspaceId] : []),
      focus ? "--focus" : "--no-focus",
      "--label",
      label,
      ...(cwd ? ["--cwd", cwd] : []),
    ]);
    return parseHerdrPaneIds(tabResult);
  }

  const splitResult = await runHerdrJson([
    "pane",
    "split",
    ...(parent ? [parent.paneId] : ["--current"]),
    "--direction",
    "right",
    focus ? "--focus" : "--no-focus",
    ...(cwd ? ["--cwd", cwd] : []),
  ]);
  const { paneId } = parseHerdrPaneIds(splitResult);
  if (paneId) {
    await runHerdr(["pane", "rename", paneId, label]);
  }
  return { paneId };
}

/** Reuse the caller's review tab, even after extension reloads or focus changes. */
export async function openHerdrReviewTab(
  command: string,
  cwd: string,
  label = "Review",
  focus = false,
): Promise<HerdrPane> {
  const paneId = process.env.HERDR_PANE_ID;
  const workspaceId = process.env.HERDR_WORKSPACE_ID;
  if (!paneId || !workspaceId) {
    throw new Error("Missing parent Herdr pane or workspace context.");
  }
  const suffix = ` · ${paneId}`;
  const tabs = await runHerdrJson<{
    result: { tabs: { tab_id: string; label: string }[] };
  }>(["tab", "list", "--workspace", workspaceId]);
  const tab = tabs.result.tabs.find((tab) => tab.label.endsWith(suffix));
  let pane: HerdrPane;
  if (tab) {
    const panes = await runHerdrJson<{
      result: { panes: { pane_id: string; tab_id: string }[] };
    }>(["pane", "list", "--workspace", workspaceId]);
    const existing = panes.result.panes.find((pane) => pane.tab_id === tab.tab_id);
    if (!existing) throw new Error("Herdr review tab has no pane.");
    pane = { tabId: tab.tab_id, paneId: existing.pane_id };
    if (focus) await runHerdr(["tab", "focus", tab.tab_id]);
  } else {
    pane = await createHerdrPane(
      "tab", `Review · ${label}${suffix}`, cwd, { paneId, workspaceId }, focus,
    );
  }
  if (!pane.paneId) throw new Error("Herdr did not return a pane ID.");
  // Leave the shell alive so Glow and Diffview can share the tab in turn.
  await runInPane(pane.paneId, `cd ${shellQuote(cwd)} && ${command}`);
  return pane;
}

export interface HerdrPopupOptions {
  width?: string;
  height?: string;
  focus?: boolean;
}

export async function openHerdrPopup(
  command: string,
  cwd: string,
  options: HerdrPopupOptions = {},
): Promise<void> {
  await runHerdr([
    "plugin",
    "pane",
    "open",
    "--plugin",
    "herdr-popup",
    "--entrypoint",
    "popup",
    "--placement",
    "popup",
    "--width",
    options.width ?? "100%",
    "--height",
    options.height ?? "100%",
    options.focus ?? true ? "--focus" : "--no-focus",
    "--env",
    `HERDR_POPUP_CMD=${command}`,
    "--env",
    `HERDR_POPUP_CWD=${cwd}`,
  ]);
}

export async function runInPane(paneId: string, command: string): Promise<void> {
  await runHerdr(["pane", "run", paneId, command]);
}

export async function zoomHerdrPane(paneId: string, zoomed: boolean): Promise<void> {
  await runHerdr(["pane", "zoom", "--pane", paneId, zoomed ? "--on" : "--off"]);
}

export async function closeHerdrPane(paneId: string): Promise<void> {
  await runHerdr(["pane", "close", paneId]);
}

export async function closeHerdrTab(tabId: string): Promise<void> {
  await runHerdr(["tab", "close", tabId]);
}
