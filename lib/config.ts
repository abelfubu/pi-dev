import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface JiraConfig {
  defaultProject?: string;
  acliPath?: string;
}

export interface PiDevConfig {
  jira?: JiraConfig;
}

export async function loadConfig(cwd: string): Promise<PiDevConfig> {
  const globalPath = join(homedir(), ".pi", "agent", "pi-dev.json");
  const projectPath = join(cwd, ".pi", "pi-dev.json");
  let config: PiDevConfig = {};

  if (existsSync(globalPath)) {
    try {
      const global = JSON.parse(await readFile(globalPath, "utf8"));
      config = { ...global };
    } catch {
      // ignore malformed global config
    }
  }

  if (existsSync(projectPath)) {
    try {
      const project = JSON.parse(await readFile(projectPath, "utf8"));
      config = { ...config, ...project };
    } catch {
      // ignore malformed project config
    }
  }

  return config;
}

export function getDefaultProject(config: PiDevConfig): string {
  return process.env.JIRA_DEFAULT_PROJECT || config.jira?.defaultProject || "ITA";
}

export function getAclPath(config: PiDevConfig): string {
  return config.jira?.acliPath || "acli";
}
