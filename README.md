# @abelfubu/pi-dev

Pi extension with Jira, GitHub, and code-check tools and skills.

## Install

From git:

```bash
pi install git:github.com/abelfubu/pi-dev
```

## Shared GitHub watcher

The `github-watch` CLI and `github_watch` Pi tool share one local polling daemon for explicitly registered PRs. It persists snapshots and independent consumer acknowledgments, and queues orchestrator follow-ups for changed feedback/checks. See [setup, usage, and first-iteration limitations](docs/github-watch.md).

```bash
node cli/github-watch.mjs start
node cli/github-watch.mjs watch OWNER/REPO#742 --consumer my-orchestrator
node cli/github-watch.mjs status OWNER/REPO#742 --consumer my-orchestrator
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

`~/.pi/agent/pi-dev.json` and `.pi/pi-dev.json` are merged.

### codeChecks

The `codeChecks` key optionally replaces auto-discovery with arbitrary repository commands:

```json
{
  "codeChecks": {
    "verify": "pnpm turbo run lint typecheck test",
    "smoke": { "command": "./scripts/smoke" }
  }
}
```

Without configuration, exact `check`, `lint`, `typecheck`, and `test` scripts are discovered from the root `package.json` and run through the repository's package manager. Root Cargo projects also expose check, clippy, and test commands. Installed dependencies alone are not treated as checks.

### jira

Project-localized Jira issue types can be exposed through stable semantic aliases:

```json
{
  "jira": {
    "projects": {
      "ITA": {
        "issueTypes": {
          "story": "Historia",
          "task": "Tarea",
          "subtask": "Subtarea",
          "bug": "Error"
        }
      }
    }
  }
}
```

The `jira` create action accepts either an alias or the exact Jira issue type name. It validates the resolved name against the project's current issue types before creating the work item. `epic` and `subtask` can also be discovered from Jira's hierarchy metadata.

Search fields unsupported by ACLI, such as `parent`, are fetched transparently through follow-up work item views.

## Tools

### Delegation

Delegation is provided externally by billion-dollars' `acp_delegate`, not by this package. The orchestrator prompt uses ACP roles and completion notifications; install/configure that provider separately. Pi-dev does not launch agents, manage profiles, or deliver their results.

Migration: remove `subagentDefaults` and `subagents` from `pi-dev.json`, and remove explicit extension paths for `subagent-tools.ts` and `subagent-notify-tools.ts` from Pi configuration. The `subagent`, `subagent_notify`, and `herdr_handoff` tools have been removed. Existing global configuration and saved run artifacts are not modified by this update.

### Terminal windows (Rex and Herdr)

| Tool | Purpose |
|------|---------|
| `terminal_start` | Run a shell command in a fresh Rex window or Herdr tab, detected automatically. Defaults to no focus. |
| `herdr_close` | Close a Herdr pane or tab when it is no longer needed. |
| `herdr_start` | Run a shell command in a pane, popup, fresh workspace tab (`newTab: true`), or reusable review tab (`reviewTab: true`). |
| `worktrunk` | Create, list, and safely remove hook-prepared Git worktrees. |

`worktrunk` supports `create`, `list`, and `remove`. Creation waits for approved Worktrunk lifecycle hooks, allowing `.worktreeinclude` files to select ignored local state such as `.env*`, `.eslintcache`, and `node_modules/` for copying.

### Code review

| Tool | Purpose |
|------|---------|
| `diffview_review` | Open a pinned local diff in Neovim Diffview in a fresh Rex window or reusable Herdr review tab. |

`diffview_review` resolves the same immutable diff and opens it with `nvim -c "DiffviewOpen <range>"` in a fresh Rex window or a reusable review tab in the caller's Herdr workspace. Plan reviews use `terminal_start` with `nvim -c 'Markview splitOpen' -- '<absolute-plan-path>'`: each plan gets a fresh Rex window or Herdr tab, with editable source beside a synchronized Markdown preview. Neovim and `markview.nvim` must already be installed, with `:Markview` available at startup. Briefs follow the [plan-review guidance](docs/orchestrator/plan-review.md): a short outcome-first explanation, concrete steps, visible risks, and a small ASCII diagram when useful. Both viewers default to no focus and require caller context rather than using the currently focused session/workspace. Detection prefers `TERM_PROGRAM` (`rex` or `Herdr`), then `REX_SESSION` or Herdr's pane/workspace variables. Rex targets `REX_SESSION` explicitly and keeps windows open after the editor exits. Existing plan windows/tabs and unsaved edits are left alone. Herdr-specific tools remain available unchanged.

### Jira

| Tool | Purpose |
|------|---------|
| `jira` | Jira work item operations (search, view, create, update, transition, transitions, comment, projects) |

### GitHub

| Tool | Purpose |
|------|---------|
| `gh_pr` | Pull request operations: create, list, view, fetch comments, checks, merge, comment, close, reopen, review, diff |
| `gh_issue` | Issue operations: create, list, view, comment, close, reopen |
| `gh_run` | Actions run operations: list, view, rerun |
| `gh_workflow` | Actions workflow operations: list, trigger |
| `gh_release` | Release operations: list, view, create |

### Code checks

| Tool | Purpose |
|------|---------|
| `code_check_list` | List discovered repository-owned checks and their commands |
| `code_check` | Run selected checks sequentially, or all checks when none are selected |

Checks use repository scripts rather than inferred tool invocations, so Turbo, Nx, and other task runners remain in control of scheduling and caching. Pass or failure always comes from the command exit code. The agent receives only a concise summary and structured result. Full failing output is saved to a temporary file for inspection only when needed. Raw commands are fallbacks for unsupported checks or additional diagnostics.

## Skills

- `jira` — how to use the Jira tools.
- `github` — how to use the GitHub tools.
- `check` — how to run code checks efficiently.
- `tdd` — test-driven development workflow.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
