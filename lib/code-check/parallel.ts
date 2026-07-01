import { discoverCodeChecks } from "./discover.js";
import { runEslint } from "./parsers/eslint.js";
import { runTsc } from "./parsers/tsc.js";
import { runVitest } from "./parsers/vitest.js";
import type { CheckResult, ToolName } from "./types.js";

const runners: Record<ToolName, (cwd: string, path?: string, override?: string) => Promise<CheckResult>> = {
  eslint: runEslint,
  tsc: runTsc,
  vitest: runVitest,
};

export interface ParallelOptions {
  cwd: string;
  path?: string;
  tools?: ToolName[];
}

export async function runParallelChecks(options: ParallelOptions): Promise<CheckResult[]> {
  const { cwd, path } = options;
  let tools = options.tools;

  let discovery = await discoverCodeChecks(cwd);

  if (!tools || tools.length === 0) {
    tools = discovery.available;
  }

  const { overrides } = discovery;
  const results = await Promise.all(
    tools.map((tool) => runners[tool](cwd, path, overrides[tool]))
  );
  return results;
}
