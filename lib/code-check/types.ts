export type CheckSource = "config" | "package.json" | "cargo";
export type FailureKind = "execution" | "timeout";

export interface CheckDefinition {
  name: string;
  command: string;
  source: CheckSource;
}

export interface CheckItem {
  message: string;
}

export interface CheckResult {
  name: string;
  command: string;
  pass: boolean;
  exitCode: number;
  items: CheckItem[];
  outputFile?: string;
  failureKind?: FailureKind;
}
