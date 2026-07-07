---
name: github
description: Use when the user wants to manage GitHub pull requests, issues, releases, workflow runs, or workflows; or when another skill needs to drive GitHub operations via the gh CLI.
---

## Leading word: **ship**

The GitHub tools move work from local to remote: open a PR, review it, merge it, and publish releases. Use them whenever the task touches the repository's public surface.

## Conventions

Hold on every run:

- `gh_pr` with `action`: create, list, view, checks, merge, comment, close, reopen, review, diff.
- `gh_issue` with `action`: create, list, view, comment, close, reopen.
- `gh_run` with `action`: list, view, rerun.
- `gh_workflow` with `action`: list, trigger.
- `gh_release` with `action`: list, view, create.
- `repo` is always `OWNER/NAME` (e.g. `abelfubu/pi-dev`).
- `body` and `notes` are Markdown and pass through to GitHub as-is.
- `label` and `reviewer` support comma-separated values.
- If `body` is omitted for `gh_pr` action `create`, the tool uses `--fill` to autofill the body from commits.
- After any mutating action, surface the resulting URL or number in the response.
- `gh_pr` action `checks` returns exit code `8` in details when checks are still pending; this is not treated as an error.

## Common flows

### Ship a change
1. Open PR: `gh_pr` with `action: create`.
2. Check CI: `gh_pr` with `action: checks`.
3. Review or comment: `gh_pr` with `action: review` / `action: comment`.
4. Merge: `gh_pr` with `action: merge`.
5. **Completion:** PR URL is returned and the branch is merged.

### Inspect CI
1. List runs: `gh_run` with `action: list`.
2. View failing logs: `gh_run` with `action: view` and `logFailed`.
3. Rerun: `gh_run` with `action: rerun`.
4. **Completion:** The run status is clear and any failing logs are surfaced.

### Triage an issue
1. Create or view: `gh_issue` with `action: create` / `action: view`.
2. Comment or close: `gh_issue` with `action: comment` / `action: close`.
3. **Completion:** The issue URL or final state is returned.

### Publish a release
1. List or view: `gh_release` with `action: list` / `action: view`.
2. Create: `gh_release` with `action: create`.
3. **Completion:** The release URL or tag is returned.

## Tool reference

### Pull requests
- `gh_pr` with `action: create` — create a PR from the current branch.
- `gh_pr` with `action: list` — list PRs with filters.
- `gh_pr` with `action: view` — read a PR by number, branch, or URL.
- `gh_pr` with `action: checks` — list CI status checks for a PR.
- `gh_pr` with `action: merge` — merge a PR (`merge`, `squash`, `rebase`) or enable auto-merge.
- `gh_pr` with `action: comment` — add a comment to a PR.
- `gh_pr` with `action: close` — close a PR with an optional comment.
- `gh_pr` with `action: reopen` — reopen a PR.
- `gh_pr` with `action: review` — submit a review (`approve`, `request-changes`, `comment`).
- `gh_pr` with `action: diff` — show the PR diff.

### Issues
- `gh_issue` with `action: create` — create an issue.
- `gh_issue` with `action: list` — list issues with filters.
- `gh_issue` with `action: view` — read an issue by number.
- `gh_issue` with `action: comment` — add a comment to an issue.
- `gh_issue` with `action: close` — close an issue with reason `completed` or `not_planned`.
- `gh_issue` with `action: reopen` — reopen an issue.

### CI / workflows
- `gh_run` with `action: list` — list workflow runs.
- `gh_run` with `action: view` — view a run; use `logFailed` to see failing logs.
- `gh_run` with `action: rerun` — rerun a run, optionally only failed jobs.
- `gh_workflow` with `action: list` — list workflows.
- `gh_workflow` with `action: trigger` — trigger a workflow dispatch with inputs.

### Releases
- `gh_release` with `action: list` — list releases.
- `gh_release` with `action: view` — view a release by tag.
- `gh_release` with `action: create` — create a release.
