---
name: implement-slice
description: |
  Implement one vertical slice of a feature: code, review, fix, open PR,
  and update Jira. Intended to be invoked once per slice by the parent
  orchestrator.
---

# Implement one vertical slice

## 1. Scout the slice

- agent: scout
- task: |
    Read the Jira issue for this slice and inspect the relevant code,
    tests, and docs. Summarize the scope, existing patterns, and any
    risks or dependencies.
  output: "{chain_dir}/slice-context.md"

## 2. Implement the slice

- agent: worker
- task: |
    Implement the vertical slice described in the Jira issue and the
    context from {previous}.

    Follow the project conventions, add or update tests, and run the
    relevant validation commands.

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

- agent: reviewer
- task: |
    Review the current diff for correctness, regressions, and
    maintainability. Inspect changed files directly; do not rely on the
    worker's reasoning. Provide evidence-backed findings with file and
    line references.
  context: fresh
  output: "{chain_dir}/review.md"

## 4. Apply accepted fixes

- agent: worker
- task: |
    Apply only the review findings worth doing now from {previous}.
    Preserve the approved scope. Ask before making product, architecture,
    or scope changes. Run focused validation and summarize what changed.
  output: "{chain_dir}/fixes.md"

## 5. Open PR and update Jira

- agent: delegate
- task: |
    The slice is now implemented and reviewed. Open a GitHub PR with a
    clear title and description referencing the Jira issue, then update
    the Jira issue status and add a comment linking to the PR.
  output: "{chain_dir}/slice-result.md"
