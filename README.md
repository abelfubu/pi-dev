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

## Tools

### Herdr

| Tool | Purpose |
|------|---------|
| `herdr_handoff` | Open a new focused Herdr tab and seed a fresh interactive `pi` session with a prompt. |
| `subagent` / `Agent` | Launch a specialized subagent in a Herdr tab/pane. |
| `subagent_notify` | Notify the parent session that a subagent has finished (Unix socket, with Herdr fallback). |
| `herdr_close` | Close a Herdr pane or tab when it is no longer needed. |

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

Only the checks relevant to the current project are accepted by the `code_check` tool's `name` parameter. `code_check_discover` and `code_check_parallel` are always available.

## Skills

- `jira` — how to use the Jira tools.
- `github` — how to use the GitHub tools.
- `check` — how to run code checks efficiently.
- `ast-grep` — when to use ast_grep for structural code searches.
- `tdd` — test-driven development workflow for the coder subagent.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
