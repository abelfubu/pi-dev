# Subagent execution via Herdr handoff

The `subagent` tool is registered by this extension and routes every subagent invocation into an interactive Herdr tab or pane instead of a headless `pi` subprocess. Subagents are configured through named profiles that define model and layout, and they report results by writing an artifact file and notifying the parent pane.

## Why

- `pi` core has no built-in subagent tool; skills like `code-review` assume one exists.
- The user wants subagent work to be visible and inspectable inside Herdr, not hidden in background processes.

## Decision

1. This extension registers the canonical `subagent` tool.
2. Every `subagent` call launches an interactive `pi` session in a new Herdr tab or pane.
3. A `profile` parameter selects a named configuration that defines model, layout (tab vs pane), and optional tool/skill scoping. Profiles can be defined or overridden in `~/.pi/agent/pi-dev.json` under the `subagents` key; built-in profiles (`reviewer`, `coder`, `scout`, `minimal`) are used as defaults.
4. A minimal profile only needs `name`, `layout`, and an optional `model`. Optional `tools`/`excludeTools` map to `--tools`/`--exclude-tools`; `skills` and `promptTemplates` disable discovery (`--no-skills`/`--no-prompt-templates`) and load only the listed paths. Scoping keeps subagent contexts lean and prevents subagents from spawning further subagents. `subagent_notify` is always appended to a `tools` allowlist so the completion protocol cannot be broken by configuration.
5. The Herdr tab/pane label is derived from the task automatically (issue key, task headline, profile, and working directory), or can be overridden with a `title` parameter.
6. The parent passes its Herdr pane ID, a result file path, a unique launch ID, and a notify socket path to the subagent. The result file is created in a temporary directory managed by `os.tmpdir()`/`fs.mkdtemp()`.
7. The subagent writes its final result to the result file and may use `subagent_notify` for immediate delivery. Notification prefers a Unix socket via `SUBAGENT_NOTIFY_SOCKET`, falling back to Herdr pane notification if the socket is unavailable.
8. Completion does not depend on the model remembering the tool call. On `agent_settled`, the extension creates a missing artifact from the latest assistant response and automatically notifies the parent. Graceful exits before settlement emit a failed notification.
9. Explicit and automatic notifications carry the launch ID. The parent acknowledges duplicate delivery without injecting a second completion message.
10. Every subagent is created in the invoking parent's Herdr workspace. Tab profiles pass the parent's workspace ID explicitly; pane profiles split the parent's pane explicitly. Neither path relies on the workspace or pane currently focused in the Herdr UI.
11. No extra global token caps are enforced.

## Consequences

- Subagent work is visible and debuggable in Herdr.
- Changing the focused Herdr workspace cannot redirect a subagent away from its parent.
- The parent session cannot synchronously `await` the result, but settled subagents notify it automatically.
- Once collected, the parent should close the subagent pane/tab with `herdr_close` to keep the workspace tidy.
- Skills and prompts that mention subagents will naturally route through this tool once it is registered.
- Built-in profiles are read-only by default (`reviewer`, `scout`) or editing-scoped (`coder`); the allowlist excludes `subagent`/`Agent`/`herdr_handoff`, so nesting is impossible unless a profile explicitly opts back in by leaving `tools` undefined.
