---
name: check
description: Use when the user wants to run code checks efficiently, verify a change before committing, or when another skill needs a concise check summary.
---

## Leading word: **verify**

Run repository-owned verification commands without wasting tokens. The tools summarize output while preserving the command exit code as the authoritative outcome.

## Process

1. **Inspect when needed.** Call `code_check_list` when you need to see the available repository checks.
2. **Run directly.** Call `code_check`; omit `names` to run every discovered check sequentially, or select only relevant names.
3. **Run after edits.** Verify changes that could affect types, lint, or tests.
4. **No duplicate checks.** Do not rerun a successful equivalent command.
5. **Raw fallback.** Use raw commands only for unsupported checks, execution failures, or diagnostics omitted by a failing summary.
6. **Show only summaries.** Do not print full command output to the user.

## Discovery

Without configuration, checks come only from repository-owned commands:

- Exact `check`, `lint`, `typecheck`, and `test` scripts in the root `package.json`.
- Cargo checks when a root `Cargo.toml` exists.

Installed dependencies alone never imply a valid check. Package scripts are run through the package manager declared by `packageManager` or identified by its lockfile. This supports Turbo and other task runners because the repository script remains in control.

`.pi/pi-dev.json` is optional. Use it only to replace auto-discovery with arbitrary named commands:

```json
{
  "codeChecks": {
    "verify": "pnpm turbo run lint typecheck test",
    "smoke": { "command": "./scripts/smoke" }
  }
}
```

Paths are never appended to commands and diagnostics never turn a non-zero exit into a pass.
