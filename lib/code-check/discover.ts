import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import type { ToolName } from "./types.js";

export interface DiscoverResult {
  available: ToolName[];
  overrides: Record<ToolName, string | undefined>;
}

export async function discoverCodeChecks(cwd: string): Promise<DiscoverResult> {
  const config = await loadConfig(cwd);
  const overrides: Record<ToolName, string | undefined> = {
    eslint: config.codeChecks?.eslint,
    tsc: config.codeChecks?.tsc,
    vitest: config.codeChecks?.vitest,
  };

  const pkg = await readPackageJson(cwd);
  const deps = pkg ? collectDeps(pkg) : new Set<string>();

  const available: ToolName[] = [];
  if (overrides.eslint || deps.has("eslint")) available.push("eslint");
  if (overrides.tsc || deps.has("typescript") || existsSync(join(cwd, "tsconfig.json"))) available.push("tsc");
  if (overrides.vitest || deps.has("vitest")) available.push("vitest");

  return { available, overrides };
}

async function readPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return null;
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function collectDeps(pkg: Record<string, unknown>): Set<string> {
  const deps = new Set<string>();
  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    const section = pkg[key];
    if (section && typeof section === "object") {
      for (const name of Object.keys(section as Record<string, unknown>)) {
        deps.add(name);
      }
    }
  }
  return deps;
}
