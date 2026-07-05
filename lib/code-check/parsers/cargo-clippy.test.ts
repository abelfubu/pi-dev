import { describe, it, expect } from "vitest";
import { parseCargoClippyOutput } from "./cargo-clippy.js";

function clippyMessage(
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

describe("cargo-clippy", () => {
  it("returns pass when no messages", () => {
    const result = parseCargoClippyOutput(0, "", "");
    expect(result.pass).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("parses a clippy lint warning", () => {
    const stdout = clippyMessage(
      "warning",
      "useless conversion to the same type",
      "clippy::useless_conversion",
      "src/lib.rs",
      5,
      1
    );
    const result = parseCargoClippyOutput(0, stdout, "");
    expect(result.pass).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(1);
    expect(result.items[0].message).toBe(
      "clippy::useless_conversion: useless conversion to the same type"
    );
  });

  it("treats errors as failures", () => {
    const stdout = clippyMessage(
      "error",
      "denied lint triggered",
      "clippy::unwrap_used",
      "src/lib.rs",
      8,
      3
    );
    const result = parseCargoClippyOutput(1, stdout, "");
    expect(result.pass).toBe(false);
    expect(result.errors).toBe(1);
  });

  it("filters by path", () => {
    const stdout = [
      clippyMessage("warning", "in lib", "clippy::todo", "src/lib.rs", 1, 1),
      clippyMessage("warning", "in main", "clippy::todo", "src/main.rs", 2, 2),
    ].join("\n");
    const result = parseCargoClippyOutput(0, stdout, "", "src/main.rs");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].file).toBe("src/main.rs");
  });
});
