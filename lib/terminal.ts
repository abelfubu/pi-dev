import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHerdrPane, openHerdrReviewTab, runInPane } from "./herdr.js";

const execFileAsync = promisify(execFile);

export type TerminalPlatform = "rex" | "herdr" | "herdr-app";

export interface TerminalWindow {
  platform: TerminalPlatform;
  windowId?: string;
  blockId?: string;
  paneId?: string;
  tabId?: string;
  terminalId?: string;
}

function findTerminal(): TerminalPlatform | undefined {
  // Prefer the immediate host over context inherited from an outer terminal.
  if (process.env.TERM_PROGRAM === "rex") return "rex";
  if (process.env.TERM_PROGRAM?.toLowerCase() === "herdr") return "herdr";
  if (process.env.TERM_PROGRAM?.toLowerCase() === "herdr-app" || process.env.HC_TERMINAL_ID) return "herdr-app";
  if (process.env.REX_SESSION || process.env.REX_BLOCK) return "rex";
  if (process.env.HERDR_PANE_ID || process.env.HERDR_WORKSPACE_ID) return "herdr";
  return undefined;
}

export function detectTerminal(): TerminalPlatform {
  const platform = findTerminal();
  if (!platform) throw new Error("No Rex, Herdr, or Herdr app terminal context found. Open pi inside a supported terminal.");
  return platform;
}

export function terminalCallerId(): string | undefined {
  switch (findTerminal()) {
    case "rex": return process.env.REX_BLOCK || undefined;
    case "herdr": return process.env.HERDR_PANE_ID || undefined;
    case "herdr-app": return process.env.HC_TERMINAL_ID || undefined;
    default: return undefined;
  }
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
  if (platform === "herdr-app") {
    const { stdout } = await execFileAsync("herdr-app", [
      "do", "tab.new", "--name", label, "--folder", cwd,
      "--argv", JSON.stringify(["sh", "-lc", command]),
    ], { cwd, encoding: "utf8" });
    const result = JSON.parse(stdout);
    if (typeof result.tab !== "string") throw new Error("Herdr app did not return a tab ID.");
    const terminalId = process.env.HC_TERMINAL_ID;
    if (!focus && terminalId) {
      await execFileAsync("herdr-app", ["do", "agent.focus", "--terminal", terminalId], { cwd, encoding: "utf8" });
    }
    return { platform, tabId: result.tab, paneId: result.pane, terminalId: result.terminal };
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
  if (window.platform === "rex") return `Rex window ${window.windowId}`;
  return `${window.platform === "herdr-app" ? "Herdr app" : "Herdr"} tab ${window.tabId}`;
}
