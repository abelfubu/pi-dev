---
name: ship-slice
description: |
  Ship an already-implemented and approved vertical slice: open a GitHub PR
  and update Jira. This should only run after human approval.
---

# Ship one vertical slice

## 1. Open GitHub PR and update Jira

- agent: slice-ship.delegate
- task: |
    The slice has been approved. Open a GitHub PR with a clear title and
    description referencing the Jira issue, then update the Jira issue
    status and add a comment linking to the PR.

    Report:
    - PR URL
    - Jira issue key and new status
    - any blockers or failures
  output: "{chain_dir}/slice-shipped.md"
