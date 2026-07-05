import { describe, it, expect } from "vitest";
import { parseCargoCheckOutput } from "./cargo-check.js";

function compilerMessage(
  level: string,
  message: string,
  code: string,
  file: string,
  line: number,
  column: number
) {
  return JSON.stringify({
    reason: "compiler-message",
    message: {
      level,
      message,
      code: { code },
      spans: [{ file_name: file, line_start: line, column_start: column, is_primary: true }],
    },
  });
}

describe("cargo-check", () => {
  it("returns pass when no messages", () => {
    const result = parseCargoCheckOutput(0, "", "");
    expect(result.pass).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("parses a single error", () => {
    const stdout = compilerMessage("error", "mismatched types", "E0308", "src/main.rs", 2, 9);
    const result = parseCargoCheckOutput(1, stdout, "");
    expect(result.pass).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.items[0]).toEqual({
      file: "src/main.rs",
      line: 2,
      column: 9,
      message: "E0308: mismatched types",
      severity: "error",
    });
  });

  it("parses warnings", () => {
    const stdout = compilerMessage(
      "warning",
      "unused variable",
      "unused_variables",
      "src/lib.rs",
      10,
      5
    );
    const result = parseCargoCheckOutput(0, stdout, "");
    expect(result.pass).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(1);
  });

  it("filters by path", () => {
    const stdout = [
      compilerMessage("error", "error in lib", "E0001", "src/lib.rs", 1, 1),
      compilerMessage("error", "error in main", "E0002", "src/main.rs", 2, 2),
    ].join("\n");
    const result = parseCargoCheckOutput(1, stdout, "", "src/lib.rs");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].file).toBe("src/lib.rs");
  });

  it("filters by directory prefix", () => {
    const stdout = [
      compilerMessage("error", "error in lib", "E0001", "src/lib.rs", 1, 1),
      compilerMessage("error", "error in bin", "E0002", "bin/main.rs", 2, 2),
    ].join("\n");
    const result = parseCargoCheckOutput(1, stdout, "", "src/");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].file).toBe("src/lib.rs");
  });
});
