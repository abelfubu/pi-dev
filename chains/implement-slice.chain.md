---
name: implement-slice
description: |
  Implement and review one vertical slice: scout, code, review, and apply
  accepted fixes. Stops before shipping; the parent orchestrator should ask
  for human approval, then run ship-slice.
---

# Implement and review one vertical slice

## 1. Scout the slice

- agent: slice-ship.scout
- task: |
    Read the Jira issue for this slice and inspect the relevant code,
    tests, and docs. Summarize the scope, existing patterns, risks, and
    dependencies.
  output: "{chain_dir}/slice-context.md"

## 2. Implement the slice

- agent: slice-ship.worker
- task: |
    Implement the vertical slice described in the Jira issue and the
    context from {previous}.

    Follow project conventions, add or update tests, run validation
    (eslint, tsc, vitest), and fix issues.

    Return a handoff with:
    - changed files
    - what was implemented and what was left undone
    - commands run with exit codes
    - validation evidence
    - surprises or decisions needing parent approval
  output: "{chain_dir}/implementation.md"
  acceptance:
    level: checked
    evidence:
      - changed-files
      - tests-added
      - commands-run

## 3. Review the slice

- agent: slice-ship.reviewer
- task: |
    Review the current diff for correctness, regressions, tests/validation
    quality, simplicity, and maintainability. Inspect changed files directly;
    do not rely on the worker's reasoning. Provide evidence-backed findings
    with file and line references.
  output: "{chain_dir}/review.md"

## 4. Apply accepted fixes

- agent: slice-ship.worker
- task: |
    Apply only the review findings worth doing now from {previous}.
    Preserve the approved scope. Ask before making product, architecture,
    or scope changes. Run focused validation and summarize what changed.
  output: "{chain_dir}/fixes.md"

## 5. Hand off for approval

- agent: slice-ship.delegate
- task: |
    The slice is implemented and reviewed. Do NOT open a PR or update Jira
    yet. Instead, produce a concise handoff summary for the parent
    orchestrator and human reviewer that includes:

    - Jira issue key and summary
    - what was implemented
    - changed files
    - validation results
    - remaining review findings (if any)
    - a clear statement that the slice is ready for human approval before
      shipping

    The parent will run ship-slice after approval.
  output: "{chain_dir}/ready-for-approval.md"
