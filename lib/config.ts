import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CodeCheckConfig {
  eslint?: string;
  tsc?: string;
  vitest?: string;
  cargo_check?: string;
  cargo_clippy?: string;
  cargo_test?: string;
}

export interface PiDevConfig {
  codeChecks?: CodeCheckConfig;
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
