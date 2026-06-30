import type { CheckResult } from "./types.js";

export function formatCheckResult(result: CheckResult, maxPreview = 3): string {
  if (result.pass) {
    return `✅ ${result.tool}: passed`;
  }

  const lines: string[] = [`❌ ${result.tool}: ${result.errors} error${result.errors === 1 ? "" : "s"}`];
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
