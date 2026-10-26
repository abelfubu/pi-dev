import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHerdrPane, openHerdrReviewTab, runInPane } from "./herdr.js";

const execFileAsync = promisify(execFile);

export interface TerminalWindow {
  platform: "rex" | "herdr";
  windowId?: string;
  blockId?: string;
  paneId?: string;
  tabId?: string;
}

export function detectTerminal(): "rex" | "herdr" {
  // Prefer the immediate host over context inherited from an outer terminal.
  if (process.env.TERM_PROGRAM === "rex") return "rex";
  if (process.env.TERM_PROGRAM?.toLowerCase() === "herdr") return "herdr";
  if (process.env.REX_SESSION) return "rex";
  if (process.env.HERDR_PANE_ID || process.env.HERDR_WORKSPACE_ID) return "herdr";
  throw new Error("No Rex or Herdr terminal context found. Open pi inside Rex or Herdr.");
}

export async function openTerminalWindow(
  command: string,
  cwd: string,
  label: string,
  focus = false,
  reuseReviewTab = false,
): Promise<TerminalWindow> {
  const platform = detectTerminal();
  if (platform === "rex") {
    const session = process.env.REX_SESSION;
    if (!session) throw new Error("Missing parent Rex session context.");
    const { stdout } = await execFileAsync("rex", [
      "window", "new", "--session", session, "--cwd", cwd,
      `--focus=${focus}`, "--keep-open", "--json", "--shell=none", label,
      "--", "sh", "-lc", command,
    ], { cwd, encoding: "utf8" });
    const result = JSON.parse(stdout);
    if (typeof result.window_id !== "string" || typeof result.block_ids?.[0] !== "string") {
      throw new Error("Rex did not return window and block IDs.");
    }
    return { platform, windowId: result.window_id, blockId: result.block_ids[0] };
  }
  if (reuseReviewTab) {
    return { platform, ...await openHerdrReviewTab(command, cwd, label, focus) };
  }
  const paneId = process.env.HERDR_PANE_ID;
  const workspaceId = process.env.HERDR_WORKSPACE_ID;
  if (!paneId || !workspaceId) throw new Error("Missing parent Herdr pane or workspace context.");
  const pane = await createHerdrPane("tab", label, cwd, { paneId, workspaceId }, focus);
  if (!pane.paneId || !pane.tabId) throw new Error("Herdr did not return pane and tab IDs.");
  await runInPane(pane.paneId, command);
  return { platform, ...pane };
}

export function openReviewWindow(command: string, cwd: string, label: string, focus = false) {
  return openTerminalWindow(command, cwd, label, focus, true);
}

export function describeTerminalWindow(window: TerminalWindow): string {
  return window.platform === "rex"
    ? `Rex window ${window.windowId}`
    : `Herdr tab ${window.tabId}`;
}
