---
name: github
description: Use when the user wants to manage GitHub pull requests, issues, releases, workflow runs, or workflows; or when another skill needs to drive GitHub operations via the gh CLI.
---

## Leading word: **ship**

The GitHub tools move work from local to remote: open a PR, review it, merge it, and publish releases. Use them whenever the task touches the repository's public surface.

## Conventions

Hold on every run:

- `repo` is always `OWNER/NAME` (e.g. `abelfubu/pi-dev`).
- `body` and `notes` are Markdown and pass through to GitHub as-is.
- `label` and `reviewer` support comma-separated values.
- If `body` is omitted for `gh_pr_create`, the tool uses `--fill` to autofill the body from commits.
- After any mutating tool, surface the resulting URL or number in the response.
- `gh_pr_checks` returns exit code `8` in details when checks are still pending; this is not treated as an error.

## Common flows

### Ship a change
1. Open PR: `gh_pr_create`.
2. Check CI: `gh_pr_checks`.
3. Review or comment: `gh_pr_review` / `gh_pr_comment`.
4. Merge: `gh_pr_merge`.
5. **Completion:** PR URL is returned and the branch is merged.

### Inspect CI
1. List runs: `gh_run_list`.
2. View failing logs: `gh_run_view` with `logFailed`.
3. Rerun: `gh_run_rerun`.
4. **Completion:** The run status is clear and any failing logs are surfaced.

### Triage an issue
1. Create or view: `gh_issue_create` / `gh_issue_view`.
2. Comment or close: `gh_issue_comment` / `gh_issue_close`.
3. **Completion:** The issue URL or final state is returned.

### Publish a release
1. List or view: `gh_release_list` / `gh_release_view`.
2. Create: `gh_release_create`.
3. **Completion:** The release URL or tag is returned.

## Tool reference

### Pull requests
- `gh_pr_create` — create a PR from the current branch.
- `gh_pr_list` — list PRs with filters.
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
