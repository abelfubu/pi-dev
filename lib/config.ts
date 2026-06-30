import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface PiDevConfig {
  // Reserved for future per-machine / per-project configuration.
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
