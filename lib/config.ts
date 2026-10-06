import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CodeCheckCommandConfig {
  command: string;
}

export type CodeCheckConfig = Record<string, string | CodeCheckCommandConfig>;

export interface JiraProjectConfig {
  /** Stable aliases mapped to the project-localized Jira issue type names. */
  issueTypes?: Record<string, string>;
}

export interface JiraConfig {
  projects?: Record<string, JiraProjectConfig>;
}

export interface PiDevConfig {
  codeChecks?: CodeCheckConfig;
  jira?: JiraConfig;
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
