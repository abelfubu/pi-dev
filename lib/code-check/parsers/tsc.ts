import { runCommand } from "../runner.js";
import type { CheckItem, CheckResult, ToolName } from "../types.js";

const TS_ERROR_RE = /^(.+?)(?:\((\d+),(\d+)\):|:(\d+):(\d+) -)\s+error\s+(\w+):\s+(.+)$/;

export async function runTsc(
  cwd: string,
  path?: string,
  override?: string
): Promise<CheckResult> {
  const command = override
    ? `${override}${path ? ` ${JSON.stringify(path)}` : ""}`
    : `npx tsc --noEmit --pretty false`;

  const { exitCode, stdout, stderr } = await runCommand(command, cwd);
  const text = stdout || stderr;

  if (exitCode === 0) {
    return { tool: "tsc", pass: true, errors: 0, warnings: 0, items: [] };
  }

  const items: CheckItem[] = [];
  for (const line of text.split("\n")) {
    const match = TS_ERROR_RE.exec(line);
    if (match) {
      items.push({
        file: match[1],
        line: Number(match[2] || match[4]),
        column: Number(match[3] || match[5]),
        message: `TS${match[6]}: ${match[7]}`,
        severity: "error",
      });
    } else if (line.startsWith("error ")) {
      items.push({ message: line, severity: "error" });
    }
  }

  if (items.length === 0 && text.trim()) {
    items.push({ message: text.trim().split("\n")[0] ?? text.trim(), severity: "error" });
  }

  const filtered = path
    ? items.filter(
        (i) =>
          i.file && (i.file === path || i.file.startsWith(path.replace(/\/$/, "") + "/"))
      )
    : items;

  const errors = filtered.filter((i) => i.severity === "error").length;
  return {
    tool: "tsc",
    pass: errors === 0,
    errors,
    warnings: 0,
    items: filtered,
    raw: text.slice(0, 2000),
  };
}
