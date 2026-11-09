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

### Terminal windows (Rex, Herdr, Herdr app, and Herdr core)

| Tool | Purpose |
|------|---------|
| `terminal_start` | Run a shell command in a fresh Rex window, Herdr/Herdr app tab, or attachable Herdr core terminal when no app window is running. Defaults to no focus. |
| `herdr_close` | Close a Herdr pane or tab when it is no longer needed. |
| `herdr_start` | Run a shell command in a pane, popup, fresh workspace tab (`newTab: true`), or reusable review tab (`reviewTab: true`). |
| `worktrunk` | Create, list, and safely remove hook-prepared Git worktrees. |

`worktrunk` supports `create`, `list`, and `remove`. Creation waits for approved Worktrunk lifecycle hooks, allowing `.worktreeinclude` files to select ignored local state such as `.env*`, `.eslintcache`, and `node_modules/` for copying.

### Code review

| Tool | Purpose |
|------|---------|
| `diffview_review` | Open a pinned local diff in Neovim Diffview in a fresh Rex window, Herdr app tab, reusable Herdr review tab, or attachable Herdr core terminal. |

`diffview_review` resolves the same immutable diff and opens it with `nvim -c "DiffviewOpen <range>"` in a fresh Rex window, a fresh Herdr app tab, or a reusable review tab in the caller's Herdr workspace. In Herdr core context (`HC_TERMINAL_ID` is set), it probes `herdr-app ls` first. If no app window is running (common over SSH), it starts the editor with `hc run --bg` and returns the `hc attach <terminal>` command. Herdr app review tabs restore focus to the caller unless `focus: true` is requested.

Plan reviews use the host's Markdown viewer directly from the parent orchestrator pane. In Herdr core context (`HC_TERMINAL_ID` is set), first check `herdr-app ls`. With a running app window, run `"${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods/markdown-panel/md-review" --no-wait '<absolute-plan-path>'`; the Markdown mod opens or reuses its window and reloads the same file on later runs. Without an app window, report the plan path and review in chat because the mod cannot display it. In Rex, run `md-viewer open '<absolute-plan-path>'`; its first preview opens as a vertical split beside the caller without taking focus, and revisions use `md-viewer open --replace '<absolute-plan-path>'`. Do not wrap either viewer in `terminal_start` or open another window/tab. Viewer failures are reported with the plan path rather than silently using another viewer. Briefs follow the [plan-review guidance](docs/orchestrator/plan-review.md): one outcome sentence, a concise change table, and approval-critical risks.

The shared `lib/terminal.ts` abstraction owns host detection, caller identity, and opening/describing viewer windows or tabs. Detection prefers `TERM_PROGRAM` (`rex`, `Herdr`, or `herdr-app`), then Herdr core's `HC_TERMINAL_ID`, Rex's session/block variables, or Herdr's pane/workspace variables. `HC_TERMINAL_ID` alone does not prove an app window is running. PR ownership uses the detected host's caller identity (`HC_TERMINAL_ID`, `REX_BLOCK`, or `HERDR_PANE_ID`), unless overridden by a non-empty `PI_ORCHESTRATOR_ID`. Rex targets `REX_SESSION` explicitly and keeps windows open after the editor exits. Unrelated plan previews are left alone. Herdr-specific tools remain available unchanged.

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
