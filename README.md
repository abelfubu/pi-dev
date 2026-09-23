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

### subagentDefaults

Use `subagentDefaults` to set execution defaults for every profile. Headless execution is the default. Per-profile values and tool-call overrides take precedence.

```json
{
  "subagentDefaults": {
    "backend": "headless",
    "model": "kimi-coding/kimi-for-coding",
    "thinking": "medium",
    "maxConcurrency": 4
  }
}
```

### subagents

The `subagents` key defines or overrides profiles used by the `subagent` tool. Config fields override matching built-in fields individually. Use `backend: "herdr"` when a profile should remain interactive; `layout` only applies to that backend:

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
      "backend": "herdr",
      "layout": "pane",
      "thinking": "low"
    }
  }
}
```

Built-in profiles (`reviewer`, `coder`, `scout`, `minimal`) are used when a profile is not defined in config.

### Tool and skill scoping

Profiles can restrict what a subagent session loads, keeping its context lean:

| Field | Effect |
|-------|--------|
| `backend` | `headless` (default) or `herdr`. |
| `model` | Model override passed through `--model`. |
| `thinking` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`. |
| `timeoutMs` | Optional execution timeout; disabled when omitted. |
| `tools` | Tool allowlist passed through `--tools`. |
| `excludeTools` | Tool denylist passed through `--exclude-tools`. |
| `extensions` | Explicit extension paths. Headless runs disable extension discovery. |
| `skills` | Explicit skill paths. Headless runs disable skill discovery. |
| `promptTemplates` | Explicit prompt-template paths. Headless runs disable template discovery. |

Headless runs also use `--no-session`. They return a Job ID immediately, notify on completion, and queue the final assistant response for delivery with the next user Prompt. Built-in defaults:

- `reviewer` / `scout` — read-only tools (`read`, `bash`, `grep`, `find`, `ls`, `subagent_notify`), no skills, no prompt templates.
- `coder` — editing tools plus the `code_check*` tools and the package's `check` skill; no prompt templates.
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

### Delegation

| Tool | Purpose |
|------|---------|
| `subagent` | Start a scoped background headless subagent, or launch one in Herdr when explicitly requested. |

`subagent` starts an isolated `pi --mode json -p` subprocess and returns a Job ID immediately. While jobs run, the TUI displays per-job model, thinking level, turns, input/output/cache-read tokens, and cost (updated after each completed assistant turn). The harness captures final output and token usage and shows a completion notification. The Subagent Result triggers an agent follow-up (or queues one after an active turn) without submitting or replacing any editor draft. It also aborts active Jobs on session shutdown, limits concurrent runs, serializes writers sharing a working directory, caps model-visible output at 50 KB, and persists failed JSONL transcripts for seven days under `~/.pi/agent/pi-dev/subagent-runs/`.

Every `coder` launch requires an `implementationPlan` containing the change intent plus concrete modifications and additions. Modification/addition entries identify files and relevant interfaces, functions, or symbols. The plan is rendered before the coder task.

Pass `backend: "herdr"` for interactive inspection in a pane or tab. Its optional `title` sets the pane/tab label; otherwise a compact label is derived from the task, profile, and working directory. Herdr launches retain the result-artifact and notification protocol.

### Herdr

| Tool | Purpose |
|------|---------|
| `herdr_handoff` | Open a new focused Herdr tab and seed a fresh interactive `pi` session with a prompt. |
| `subagent_notify` | Notify the parent session that a Herdr subagent has finished (Unix socket, with Herdr fallback). |
| `herdr_close` | Close a Herdr pane or tab when it is no longer needed. |
| `herdr_start` | Create a pane or full-screen popup and run any shell command with optional focus, zoom, or popup. |
| `worktrunk` | Create, list, and safely remove hook-prepared Git worktrees. |

`worktrunk` supports `create`, `list`, and `remove`. Creation waits for approved Worktrunk lifecycle hooks, allowing `.worktreeinclude` files to select ignored local state such as `.env*`, `.eslintcache`, and `node_modules/` for copying.

Completion notification is harness-owned. A subagent may call `subagent_notify` for immediate delivery, but an `agent_settled` hook automatically creates a missing result artifact and notifies the parent if the model forgets. Each launch has a unique ID, so explicit and automatic notifications are deduplicated. Graceful early exits report a failed completion.

### Code review

| Tool | Purpose |
|------|---------|
| `diffview_review` | Open a pinned local diff in Neovim Diffview in a focused full-screen Herdr popup. |

`diffview_review` resolves the same immutable diff and opens it with `exec nvim -c "DiffviewOpen <range>"` in a focused full-screen Herdr popup via the `herdr-popup` plugin. The popup closes automatically when Neovim exits.

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
- `tdd` — test-driven development workflow for the coder subagent.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
