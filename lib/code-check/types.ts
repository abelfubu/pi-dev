export type ToolName = "eslint" | "tsc" | "vitest" | "cargo_check" | "cargo_clippy" | "cargo_test";
export type FailureKind = "execution" | "timeout";

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
  command?: string;
  exitCode?: number;
  failureKind?: FailureKind;
}
