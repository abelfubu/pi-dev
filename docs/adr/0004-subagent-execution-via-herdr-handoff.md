# Subagent execution via Herdr handoff

The `subagent` tool is registered by this extension and routes every subagent invocation into an interactive Herdr tab or pane instead of a headless `pi` subprocess. Subagents are configured through named profiles that define model and layout, and they report results by writing an artifact file and notifying the parent pane.

## Why

- `pi` core has no built-in subagent tool; skills like `code-review` assume one exists.
- The user wants subagent work to be visible and inspectable inside Herdr, not hidden in background processes.

## Decision

1. This extension registers the canonical `subagent` tool.
2. Every `subagent` call launches an interactive `pi` session in a new Herdr tab or pane.
3. A `profile` parameter selects a named configuration that defines model and layout (tab vs pane). Profiles can be defined or overridden in `~/.pi/agent/pi-dev.json` under the `subagents` key; built-in profiles (`reviewer`, `coder`, `scout`, `minimal`) are used as defaults.
4. A minimal profile only needs `name`, `layout`, and an optional `model`.
5. The parent passes its Herdr pane ID, a result file path, and a notify socket path to the subagent. The result file is created in a temporary directory managed by `os.tmpdir()`/`fs.mkdtemp()`.
6. The subagent writes its final result to the result file and uses the `subagent_notify` tool to notify the parent session. Notification prefers a Unix socket via `SUBAGENT_NOTIFY_SOCKET`, falling back to Herdr pane notification if the socket is unavailable.
7. Every subagent is created in the invoking parent's Herdr workspace. Tab profiles pass the parent's workspace ID explicitly; pane profiles split the parent's pane explicitly. Neither path relies on the workspace or pane currently focused in the Herdr UI.
8. No extra global token caps are enforced.

## Consequences

- Subagent work is visible and debuggable in Herdr.
- Changing the focused Herdr workspace cannot redirect a subagent away from its parent.
- The parent session must wait for or be notified of completion; it cannot synchronously `await` the result.
- Once collected, the parent should close the subagent pane/tab with `herdr_close` to keep the workspace tidy.
- Skills and prompts that mention subagents will naturally route through this tool once it is registered.
