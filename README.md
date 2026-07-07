# @abelfubu/pi-dev

Pi extension with Jira, GitHub, and code-check tools and skills.

## Install

From git:

```bash
pi install git:github.com/abelfubu/pi-dev
```

## Requirements

- [Atlassian CLI (`acli`)](https://developer.atlassian.com/cloud/acli/guides/install-acli/) installed and authenticated:
  ```bash
  acli auth login
  ```
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated:
  ```bash
  gh auth login
  ```
- Node 20+.

## Config

`~/.pi/agent/pi-dev.json` and `.pi/pi-dev.json` are merged. The `codeChecks` key overrides auto-discovered commands:

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

## Tools

### Jira

| Tool | Purpose |
|------|---------|
| `jira_search` | Search issues with JQL |
| `jira_view` | View an issue by key |
| `jira_create` | Create an issue |
| `jira_update` | Edit summary, labels, assignee |
| `jira_transition` | Transition an issue |
| `jira_transitions` | List available transitions |
| `jira_comment` | Add a comment |
| `jira_projects` | List projects |

### GitHub

| Tool | Purpose |
|------|---------|
| `gh_pr_create` | Create a pull request |
| `gh_pr_list` | List pull requests |
| `gh_pr_view` | View a pull request |
| `gh_pr_checks` | Show CI status checks for a pull request |
| `gh_pr_merge` | Merge a pull request |
| `gh_pr_comment` | Comment on a pull request |
| `gh_pr_close` | Close a pull request |
| `gh_pr_reopen` | Reopen a pull request |
| `gh_pr_review` | Submit a review on a pull request |
| `gh_pr_diff` | Show a pull request diff |
| `gh_issue_create` | Create an issue |
| `gh_issue_list` | List issues |
| `gh_issue_view` | View an issue |
| `gh_issue_comment` | Comment on an issue |
| `gh_issue_close` | Close an issue |
| `gh_issue_reopen` | Reopen an issue |
| `gh_run_list` | List workflow runs |
| `gh_run_view` | View a workflow run (including failed logs) |
| `gh_run_rerun` | Rerun a workflow run |
| `gh_workflow_list` | List workflows |
| `gh_workflow_trigger` | Trigger a workflow dispatch |
| `gh_release_list` | List releases |
| `gh_release_view` | View a release |
| `gh_release_create` | Create a release |

### Code checks

| Tool | Purpose |
|------|---------|
| `code_check_discover` | Detect available checks in the project |
| `code_check_eslint` | Run ESLint and summarize errors |
| `code_check_tsc` | Run `tsc --noEmit` and summarize errors |
| `code_check_vitest` | Run Vitest and summarize failures |
| `code_check_cargo_check` | Run `cargo check` and summarize compilation errors |
| `code_check_cargo_clippy` | Run `cargo clippy` and summarize warnings/errors |
| `code_check_cargo_test` | Run `cargo test` and summarize test failures |
| `code_check_parallel` | Run selected checks in parallel |

Only the checks relevant to the current project are registered as individual tools (`code_check_eslint`, `code_check_tsc`, `code_check_vitest`, `code_check_cargo_check`, `code_check_cargo_clippy`, `code_check_cargo_test`). `code_check_discover` and `code_check_parallel` are always available.

## Skills

- `jira` — how to use the Jira tools.
- `github` — how to use the GitHub tools.
- `check` — how to run code checks efficiently.
- `ast-grep` — when to use ast_grep for structural code searches.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
