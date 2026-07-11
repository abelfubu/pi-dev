# Subagent execution via Herdr handoff

The `subagent` tool is registered by this extension and routes every subagent invocation into an interactive Herdr tab or pane instead of a headless `pi` subprocess. Subagents are configured through named profiles that restrict tools and skills, and they report results by writing an artifact file and notifying the parent pane.

## Why

- `pi` core has no built-in subagent tool; skills like `code-review` assume one exists.
- The `pi-subagents` package is declared as an optional peer dependency but is not currently installed, and its headless, synchronous model does not match the existing `herdr_handoff` workflow.
- The user wants subagent work to be visible and inspectable inside Herdr, not hidden in background processes.
- Restricting each subagent to a small tool/skill set saves tokens and keeps the agent focused.

## Decision

1. This extension registers the canonical `subagent` tool.
2. Every `subagent` call launches an interactive `pi` session in a new Herdr tab or pane.
3. A `profile` parameter selects a named configuration that defines allowed tools, loaded skills, model, and layout (tab vs pane).
4. The parent passes its Herdr pane ID and a result file path to the subagent.
5. The subagent writes its final result to the result file and uses a `subagent_done` tool to notify the parent pane via `herdr pane run`.
6. No extra global token caps are enforced beyond the tool/skill restrictions declared in each profile.

## Consequences

- Subagent work is visible and debuggable in Herdr.
- The parent session must wait for or be notified of completion; it cannot synchronously `await` the result.
- Skills and prompts that mention subagents will naturally route through this tool once it is registered.
- Profiles must be kept small to preserve the token-saving goal.
