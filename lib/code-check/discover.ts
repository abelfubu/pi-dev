import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, type CodeCheckCommandConfig } from "../config.js";
import type { CheckDefinition } from "./types.js";

const KNOWN_PACKAGE_SCRIPTS = ["check", "lint", "typecheck", "test"] as const;

export interface DiscoverResult {
  checks: CheckDefinition[];
}

export async function discoverCodeChecks(cwd: string): Promise<DiscoverResult> {
  const config = await loadConfig(cwd);
  const configured = config.codeChecks;
  if (configured && Object.keys(configured).length > 0) {
    return {
      checks: Object.entries(configured).flatMap(([name, value]) => {
        const command = configuredCommand(value);
        return command ? [{ name, command, source: "config" as const }] : [];
      }),
    };
  }

  const checks: CheckDefinition[] = [];
  const pkg = await readPackageJson(cwd);
  if (pkg) {
    const scripts = isRecord(pkg.scripts) ? pkg.scripts : {};
    const run = packageScriptRunner(cwd, pkg);
    for (const name of KNOWN_PACKAGE_SCRIPTS) {
      if (typeof scripts[name] === "string") {
        checks.push({ name, command: `${run} ${name}`, source: "package.json" });
      }
    }
  }

  if (existsSync(join(cwd, "Cargo.toml"))) {
    checks.push(
      { name: "cargo-check", command: "cargo check --all-targets", source: "cargo" },
      { name: "cargo-clippy", command: "cargo clippy --all-targets", source: "cargo" },
      { name: "cargo-test", command: "cargo test --all-targets", source: "cargo" },
    );
  }

  return { checks };
}

function configuredCommand(value: CodeCheckCommandConfig | string): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  return value?.command?.trim() || undefined;
}

async function readPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function packageScriptRunner(cwd: string, pkg: Record<string, unknown>): string {
  const declared = typeof pkg.packageManager === "string"
    ? pkg.packageManager.split("@")[0]
    : undefined;

  if (declared === "pnpm" || existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm run";
  if (declared === "yarn" || existsSync(join(cwd, "yarn.lock"))) return "yarn run";
  if (declared === "bun" || existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) {
    return "bun run";
  }
  return "npm run";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
