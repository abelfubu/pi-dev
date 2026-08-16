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

`~/.pi/agent/pi-dev.json` and `.pi/pi-dev.json` are merged.

### codeChecks

The `codeChecks` key overrides auto-discovered commands:

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

### subagentDefaults

Use `subagentDefaults` to set a base model or layout for every subagent profile. Per-profile values in `subagents` override these defaults.

```json
{
  "subagentDefaults": {
    "model": "kimi-coding/kimi-for-coding"
  }
}
```

### subagents

The `subagents` key defines or overrides subagent profiles used by the `subagent` tool. A profile only needs a `name`, `layout` (`tab` or `pane`), and an optional `model`. Config fields override the matching built-in profile field-by-field, so you can change just the model of a default profile:

```json
{
  "subagents": {
    "coder": {
      "model": "openai:gpt-4o"
    }
  }
}
```

Or define a fully custom profile:

```json
{
  "subagents": {
    "quick": {
      "name": "quick",
      "layout": "pane"
    }
  }
}
```

Built-in profiles (`reviewer`, `coder`, `scout`, `minimal`) are used when a profile is not defined in config.

### Tool and skill scoping

Profiles can restrict what a subagent session loads, keeping its context lean:

| Field | Effect |
|-------|--------|
| `tools` | Allowlist passed as `--tools`. `subagent_notify` is always appended. |
| `excludeTools` | Denylist passed as `--exclude-tools`. |
| `skills` | Explicit skill paths; launches with `--no-skills` plus one `--skill` per entry. Empty array = no skills at all. Supports `~` and cwd-relative paths. |
| `promptTemplates` | Explicit template paths; launches with `--no-prompt-templates` plus one `--prompt-template` per entry. |

Fields left `undefined` keep pi's default discovery. Built-in defaults:

- `reviewer` / `scout` — read-only tools (`read`, `bash`, `grep`, `find`, `ls`, `subagent_notify`), no skills, no prompt templates.
- `coder` — full editing tools plus the `code_check*` tools; keeps the repo-local `check` and `tdd` skills when installed; no prompt templates.
- `minimal` — `bash`, `read`, `subagent_notify` only.

Example: give the coder a different model and add a custom skill (overriding `skills` replaces the built-in defaults, so re-add the package skills by absolute path if you want them):

```json
{
  "subagents": {
    "coder": {
      "model": "openai:gpt-4o",
      "skills": ["~/dev/pi-dev/skills/check", "~/dev/pi-dev/skills/tdd", "~/my-skills/conventional-commits"]
    }
  }
}
```

## Tools

### Herdr

| Tool | Purpose |
|------|---------|
| `herdr_handoff` | Open a new focused Herdr tab and seed a fresh interactive `pi` session with a prompt. |
| `subagent` / `Agent` | Launch a specialized subagent in a Herdr tab/pane. |
| `subagent_notify` | Notify the parent session that a subagent has finished (Unix socket, with Herdr fallback). |
| `herdr_close` | Close a Herdr pane or tab when it is no longer needed. |
| `herdr_start` | Create a pane and run any shell command with optional focus and zoom. |
| `worktrunk` | Create, list, and safely remove hook-prepared Git worktrees. |

`subagent` accepts an optional `title` parameter that sets the Herdr pane/tab label. Labels are capped at 32 characters. If omitted, a compact label is derived from the task, profile, and working-directory folder. Example: `ITA-123 fix… [coder/auth]`.

`subagent` and `herdr_handoff` launch Pi with `--approve`, so isolated worktrees load their project-local resources without blocking on an interactive trust prompt. This approval applies only to the launched session.

`worktrunk` supports `create`, `list`, and `remove`. Creation waits for approved Worktrunk lifecycle hooks, allowing `.worktreeinclude` files to select ignored local state such as `.env*`, `.eslintcache`, and `node_modules/` for copying.

Completion notification is harness-owned. A subagent may call `subagent_notify` for immediate delivery, but an `agent_settled` hook automatically creates a missing result artifact and notifies the parent if the model forgets. Each launch has a unique ID, so explicit and automatic notifications are deduplicated. Graceful early exits report a failed completion.

### Code review

| Tool | Purpose |
|------|---------|
| `tuicr_review` | Open a pinned local diff in a focused Herdr pane, read its comments, and close the owned pane. |
| `diffview_review` | Open a pinned local diff in Neovim Diffview in a focused Herdr pane. |

`tuicr_review` supports `open`, `comments`, and `close`. `open` resolves the Git merge base and HEAD to immutable commit SHAs before launching tuicr. Empty comments never imply approval.

`diffview_review` resolves the same immutable diff and opens it with `exec nvim -c "DiffviewOpen <range>"`. A `VimLeavePre` hook closes the pane on a normal Neovim exit; because Neovim replaces the review shell, manually closing the pane also terminates it.

### Jira

| Tool | Purpose |
|------|---------|
| `jira` | Jira work item operations (search, view, create, update, transition, transitions, comment, projects) |

### GitHub

| Tool | Purpose |
|------|---------|
| `gh_pr` | Pull request operations: create, list, view, checks, merge, comment, close, reopen, review, diff |
| `gh_issue` | Issue operations: create, list, view, comment, close, reopen |
| `gh_run` | Actions run operations: list, view, rerun |
| `gh_workflow` | Actions workflow operations: list, trigger |
| `gh_release` | Release operations: list, view, create |

### Code checks

| Tool | Purpose |
|------|---------|
| `code_check` | Run a single check (eslint, tsc, vitest, cargo_check, cargo_clippy, cargo_test) |
| `code_check_discover` | Detect available checks in the project |
| `code_check_parallel` | Run selected checks in parallel |

Only the checks relevant to the current project are accepted by the `code_check` tool's `name` parameter. `code_check_discover` and `code_check_parallel` are always available. `code_check_parallel` performs discovery automatically, so agents normally call it directly.

Treat successful code-check results as authoritative instead of rerunning equivalent npm, npx, or cargo commands. Raw commands are fallbacks for unsupported checks, execution failures, or additional diagnostics after a failure. Result details include the executed command and exit code.

## Skills

- `jira` — how to use the Jira tools.
- `github` — how to use the GitHub tools.
- `check` — how to run code checks efficiently.
- `tdd` — test-driven development workflow for the coder subagent.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
