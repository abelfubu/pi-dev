---
name: check
description: Use when the user wants to run code checks (eslint, tsc, vitest) efficiently, verify a change before committing, or when another skill needs a concise check summary.
---

## Leading word: **verify**

Run checks to verify local changes without wasting tokens. The `code_check_*` tools are faster and return smaller outputs than raw `bash`.

## Process

1. **Discover once.** At the start of a coding task, call `code_check_discover` to see which tools are available.
2. **Run after edits.** After any batch of code changes that could affect types, lint, or tests, call `code_check_parallel` with the available tools.
3. **Single checks.** If you only need one check, use `code_check_eslint`, `code_check_tsc`, or `code_check_vitest`.
4. **Show only summaries.** Do not print full command output to the user; the tool already returns a concise summary.
5. **Completion:** The summary is shown and any failures are surfaced with the tool name, error count, and the first three error messages.

## Conventions

- Pass `path` to scope `eslint` and `vitest`. `tsc` always runs project-wide and filters results by the given path.
- If all checks pass, output is one line per tool.
- If checks fail, output shows the tool name, error count, and the first three error messages.
- A project can override the command for each tool in `.pi/pi-dev.json`:

  ```json
  {
    "codeChecks": {
      "eslint": "npm run lint:strict",
      "vitest": "npm run test:unit",
      "tsc": "npm run typecheck"
    }
  }
  ```

  The override command is run as-is; it should produce output that the tool can parse, or the result will be a raw text summary.
