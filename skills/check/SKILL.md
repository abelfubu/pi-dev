---
name: check
description: Use when the user wants to run code checks (eslint, tsc, vitest, cargo) efficiently, verify a change before committing, or when another skill needs a concise check summary.
---

## Leading word: **verify**

Run checks to verify local changes without wasting tokens. The `code_check_*` tools are faster and return smaller outputs than raw `bash`.

## Process

1. **Discover once.** At the start of a coding task, call `code_check_discover` to see which tools are available.
2. **Run after edits.** After any batch of code changes that could affect types, lint, or tests, call `code_check_parallel` with the available tools.
3. **Single checks.** If you only need one check, use `code_check_eslint`, `code_check_tsc`, `code_check_vitest`, `code_check_cargo_check`, `code_check_cargo_clippy`, or `code_check_cargo_test`.
4. **Show only summaries.** Do not print full command output to the user; the tool already returns a concise summary.
5. **Completion:** The summary is shown and any failures are surfaced with the tool name, error count, and the first three error messages.

## Conventions

- Pass `path` to scope the check. TypeScript tools (`eslint`, `tsc`, `vitest`) run project-wide and filter results by the given path. Rust tools (`cargo_check`, `cargo_clippy`, `cargo_test`) also run project-wide and filter results by the given path.
- If all checks pass, output is one line per tool.
- If checks fail, output shows the tool name, error count, and the first three error messages.
- A project can override the command for each tool in `.pi/pi-dev.json`:

  ```json
  {
    "codeChecks": {
      "eslint": "npm run lint:strict",
      "vitest": "npm run test:unit",
      "tsc": "npm run typecheck",
      "cargo_check": "cargo check --all-targets --message-format=json",
      "cargo_clippy": "cargo clippy --all-targets --message-format=json",
      "cargo_test": "cargo test --all-targets --message-format=json"
    }
  }
  ```

  The override command is run as-is; it should produce output that the tool can parse, or the result will be a raw text summary.
