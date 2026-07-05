import type { CheckResult, ToolName } from "./types.js";

const toolLabels: Record<ToolName, string> = {
  eslint: "eslint",
  tsc: "tsc",
  vitest: "vitest",
  cargo_check: "cargo check",
  cargo_clippy: "cargo clippy",
  cargo_test: "cargo test",
};

export function formatCheckResult(result: CheckResult, maxPreview = 3): string {
  const label = toolLabels[result.tool];
  if (result.pass) {
    return `✅ ${label}: passed`;
  }

  const lines: string[] = [`❌ ${label}: ${result.errors} error${result.errors === 1 ? "" : "s"}`];
  const errorItems = result.items.filter((i) => i.severity === "error");

  for (let i = 0; i < Math.min(maxPreview, errorItems.length); i++) {
    const item = errorItems[i];
    const location = item.file ? `${item.file}${item.line ? `:${item.line}` : ""}` : "";
    lines.push(`- ${location ? `${location} ` : ""}${item.message}`);
  }

  if (errorItems.length > maxPreview) {
    lines.push(`- … (${errorItems.length - maxPreview} more)`);
  }

  return lines.join("\n");
}
