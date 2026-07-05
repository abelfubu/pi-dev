import { describe, it, expect } from "vitest";
import { parseCargoTestOutput } from "./cargo-test.js";

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

describe("cargo-test", () => {
  it("returns pass when all tests pass", () => {
    const stdout = "test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out";
    const result = parseCargoTestOutput(0, stdout, "");
    expect(result.pass).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it("parses a failed test with panic location", () => {
    const stdout = [
      "running 1 test",
      "test tests::it_fails ... FAILED",
      "",
      "failures:",
      "",
      "---- tests::it_fails stdout ----",
      "thread 'tests::it_fails' panicked at src/lib.rs:15:5:",
      "assertion failed",
      "",
      "failures:",
      "    tests::it_fails",
      "",
      "test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out",
    ].join("\n");
    const result = parseCargoTestOutput(1, stdout, "");
    expect(result.pass).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.items[0]).toEqual({
      file: "src/lib.rs",
      line: 15,
      column: 5,
      message: "Test 'tests::it_fails' failed",
      severity: "error",
    });
  });

  it("parses a compiler error from cargo test output", () => {
    const stdout = compilerMessage("error", "mismatched types", "E0308", "src/main.rs", 2, 9);
    const result = parseCargoTestOutput(1, stdout, "");
    expect(result.errors).toBe(1);
    expect(result.items[0].message).toBe("E0308: mismatched types");
  });

  it("falls back to raw text on unknown failure", () => {
    const stdout = "cargo is not installed";
    const result = parseCargoTestOutput(1, stdout, "");
    expect(result.pass).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.items[0].message).toBe("cargo is not installed");
  });

  it("filters test failures by path", () => {
    const stdout = [
      "---- tests::lib_test stdout ----",
      "thread 'tests::lib_test' panicked at src/lib.rs:15:5:",
      "---- tests::main_test stdout ----",
      "thread 'tests::main_test' panicked at src/main.rs:20:10:",
      "test result: FAILED. 0 passed; 2 failed; 0 ignored; 0 measured; 0 filtered out",
    ].join("\n");
    const result = parseCargoTestOutput(1, stdout, "", "src/lib.rs");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].file).toBe("src/lib.rs");
  });
});
