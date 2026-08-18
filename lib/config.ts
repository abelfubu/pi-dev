import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type SubagentLayout = "tab" | "pane";

export interface SubagentDefaultsConfig {
  model?: string;
  layout?: SubagentLayout;
  /** Auto-close the subagent Herdr pane when it reports done. Default: true. */
  autoClosePane?: boolean;
}

export interface SubagentProfileConfig {
  name?: string;
  layout?: SubagentLayout;
  model?: string;
  /** Allowlist of tools passed to the subagent via `--tools`. `subagent_notify` is always appended. */
  tools?: string[];
  /** Tools disabled via `--exclude-tools`. */
  excludeTools?: string[];
  /** Explicit skill paths. When present, the subagent launches with `--no-skills` plus one `--skill` per entry (empty array = no skills). */
  skills?: string[];
  /** Explicit prompt template paths. When present, the subagent launches with `--no-prompt-templates` plus one `--prompt-template` per entry. */
  promptTemplates?: string[];
}

export interface CodeCheckCommandConfig {
  command: string;
}

export type CodeCheckConfig = Record<string, string | CodeCheckCommandConfig>;

export interface PiDevConfig {
  codeChecks?: CodeCheckConfig;
  subagentDefaults?: SubagentDefaultsConfig;
  subagents?: Record<string, SubagentProfileConfig>;
  [key: string]: unknown;
}

export async function loadConfig(cwd: string): Promise<PiDevConfig> {
  const globalPath = join(homedir(), ".pi", "agent", "pi-dev.json");
  const projectPath = join(cwd, ".pi", "pi-dev.json");
  let config: PiDevConfig = {};

  if (existsSync(globalPath)) {
    try {
      config = JSON.parse(await readFile(globalPath, "utf8"));
    } catch {
      // ignore malformed global config
    }
  }

  if (existsSync(projectPath)) {
    try {
      config = { ...config, ...JSON.parse(await readFile(projectPath, "utf8")) };
    } catch {
      // ignore malformed project config
    }
  }

  return config;
}
