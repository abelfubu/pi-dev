import type { CheckItem } from "../types.js";

export interface CargoMessage {
  reason?: string;
  message?: CargoCompilerMessage;
}

export interface CargoCompilerMessage {
  level?: string;
  message?: string;
  code?: { code?: string };
  spans?: CargoSpan[];
}

export interface CargoSpan {
  file_name?: string;
  line_start?: number;
  column_start?: number;
  is_primary?: boolean;
}

export function parseCargoMessages(text: string): CheckItem[] {
  const items: CheckItem[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let message: CargoMessage;
    try {
      message = JSON.parse(line) as CargoMessage;
    } catch {
      continue;
    }
    if (message.reason !== "compiler-message") continue;
    const compilerMessage = message.message;
    if (!compilerMessage) continue;
    const level = compilerMessage.level;
    if (level !== "error" && level !== "warning") continue;

    const primarySpan =
      compilerMessage.spans?.find((s) => s.is_primary) ?? compilerMessage.spans?.[0];
    const code = compilerMessage.code?.code
      ? `${compilerMessage.code.code}: `
      : "";
    items.push({
      file: primarySpan?.file_name,
      line: primarySpan?.line_start,
      column: primarySpan?.column_start,
      message: `${code}${compilerMessage.message ?? ""}`,
      severity: level === "error" ? "error" : "warning",
    });
  }
  return items;
}

export function filterByPath(items: CheckItem[], path?: string): CheckItem[] {
  if (!path) return items;
  const normalized = path.replace(/\/$/, "");
  return items.filter((item) => {
    if (!item.file) return true;
    if (item.file === path || item.file === normalized) return true;
    if (normalized.endsWith(".rs")) return false;
    return item.file.startsWith(`${normalized}/`);
  });
}
