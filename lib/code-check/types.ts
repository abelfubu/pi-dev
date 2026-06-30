export type ToolName = "eslint" | "tsc" | "vitest";

export interface CheckItem {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  severity?: "error" | "warning";
}

export interface CheckResult {
  tool: ToolName;
  pass: boolean;
  errors: number;
  warnings: number;
  items: CheckItem[];
  raw?: string;
}
