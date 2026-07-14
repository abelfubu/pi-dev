# Add GitHub tools to pi-dev

We will add a GitHub tool surface to the `@abelfubu/pi-dev` extension, backed by the GitHub CLI (`gh`). This lets agents manage pull requests, issues, workflow runs, workflows, and releases through typed tools instead of raw `bash`.

## Considered options

- **Keep using `bash` for `gh` commands** — It works, but every agent has to remember the right flags, handle the interactive prompts, and parse the text output. It also leaves GitHub operations implicit in the tool list.
- **Create a separate package** (e.g. `@abelfubu/pi-github`) — Keeps concerns isolated, but adds install, versioning, and maintenance overhead for a surface that is already conceptually part of the pi-dev workflow.
- **Add tools to `@abelfubu/pi-dev`** — Reuses the existing extension package and skill directory. The package already hosts Jira tools and code-check tools; GitHub tools are the natural third leg.

## Decision

Add the tools to `@abelfubu/pi-dev` and expose them as a new skill, `skills/github/SKILL.md`.

## Tool surface

### Pull requests
- `gh_pr_create` — Open a PR with title, body, base branch, head branch, and draft flag. Returns the PR URL.
- `gh_pr_list` — List PRs with filters.
- `gh_pr_view` — Read a PR by number, branch, or URL.
- `gh_pr_checks` — List CI status for a PR.
- `gh_pr_merge` — Merge a PR (merge, squash, rebase) or enable auto-merge.
- `gh_pr_comment` — Comment on a PR.
- `gh_pr_close` — Close a PR.
- `gh_pr_reopen` — Reopen a PR.
- `gh_pr_review` — Submit a review.
- `gh_pr_diff` — Show the PR diff.

### Issues
- `gh_issue_create` — Create an issue.
- `gh_issue_list` — List issues with filters.
- `gh_issue_view` — Read an issue by number.
- `gh_issue_comment` — Comment on an issue.
- `gh_issue_close` — Close an issue with a reason.
- `gh_issue_reopen` — Reopen an issue.

### CI / workflows
- `gh_run_list` — List workflow runs.
- `gh_run_view` — View a run, including failed logs.
- `gh_run_rerun` — Rerun a run.
- `gh_workflow_list` — List workflows.
- `gh_workflow_trigger` — Trigger a workflow dispatch with inputs.

### Releases
- `gh_release_list` — List releases.
- `gh_release_view` — View a release by tag.
- `gh_release_create` — Create a release.

## Consequences

- Requires `gh` to be installed and authenticated. This is already assumed for existing workflows, so it does not introduce a new dependency for existing users.
- `gh pr create` prints a URL on success rather than JSON; the tool parses the URL from stdout.
- `gh pr view`, `gh pr checks`, `gh issue`, `gh run`, `gh workflow`, and `gh release` support `--json`, so output parsing is straightforward.
- The extension name stays `@abelfubu/pi-dev`, but the package description and README should be updated to mention GitHub tools.
