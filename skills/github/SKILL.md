---
name: github
description: Use the GitHub tools from the @abelfubu/pi-dev extension to work with pull requests, issues, workflow runs, workflows, and releases.
---

## Purpose

Use these tools for common GitHub operations: managing PRs and issues, inspecting CI runs, triggering workflows, and handling releases.

## Tools

### Pull requests

- `gh_pr_create` — create a PR from the current branch.
- `gh_pr_list` — list PRs with filters (state, label, author, etc.).
- `gh_pr_view` — read a PR by number, branch, or URL.
- `gh_pr_checks` — list CI status checks for a PR.
- `gh_pr_merge` — merge a PR (`merge`, `squash`, `rebase`) or enable auto-merge.
- `gh_pr_comment` — add a comment to a PR.
- `gh_pr_close` — close a PR with an optional comment.
- `gh_pr_reopen` — reopen a PR.
- `gh_pr_review` — submit a review (`approve`, `request-changes`, `comment`).
- `gh_pr_diff` — show the PR diff.

### Issues

- `gh_issue_create` — create an issue.
- `gh_issue_list` — list issues with filters.
- `gh_issue_view` — read an issue by number.
- `gh_issue_comment` — add a comment to an issue.
- `gh_issue_close` — close an issue with reason `completed` or `not_planned`.
- `gh_issue_reopen` — reopen an issue.

### CI / workflows

- `gh_run_list` — list workflow runs.
- `gh_run_view` — view a run; use `logFailed` to see failing logs.
- `gh_run_rerun` — rerun a run, optionally only failed jobs.
- `gh_workflow_list` — list workflows.
- `gh_workflow_trigger` — trigger a workflow dispatch with inputs.

### Releases

- `gh_release_list` — list releases.
- `gh_release_view` — view a release by tag.
- `gh_release_create` — create a release.

## Conventions

- `repo` is always `OWNER/NAME` (e.g. `abelfubu/pi-dev`).
- `body` and `notes` are Markdown and passed through to GitHub as-is.
- `label` and `reviewer` support comma-separated values.
- If `body` is omitted for `gh_pr_create`, the tool uses `--fill` to autofill the body from commits.
- `gh_pr_checks` returns exit code `8` in details when checks are still pending; this is not treated as an error.
