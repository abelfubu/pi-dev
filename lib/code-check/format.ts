import type { CheckResult } from "./types.js";

export function formatCheckResult(result: CheckResult): string {
  if (result.pass) return `✅ ${result.name}: passed`;

  const summary = result.failureKind === "timeout"
    ? "timed out"
    : result.failureKind === "execution"
      ? "could not execute"
      : `failed (exit ${result.exitCode})`;
  const lines = [`❌ ${result.name}: ${summary}`];
  for (const item of result.items) lines.push(`- ${item.message}`);
  if (result.outputFile) lines.push(`- Full output: ${result.outputFile}`);
  return lines.join("\n");
}
