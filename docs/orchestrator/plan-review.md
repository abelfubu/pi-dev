# Plan gate

The parent synthesizes the proposal; researchers supply evidence and options, not the final decision. Write for a human deciding whether this is the right change. Keep implementation details in separate worker contracts.

## Review brief

Write a Markdown file outside every repository. Keep it short enough to review at a glance: one outcome sentence followed by this table.

| Fix / Create | Module | Pieces affected | What changes |
|---|---|---|---|
| Fix | Invoicing | Use case, repository | Prevent duplicate invoices |
| Create | Notifications | Controller, use case | Receive delivery callbacks |

Replace the examples with the actual proposal. Name each affected module and its relevant pieces (use cases, repositories, controllers, schemas, etc.). Use one short row per coherent change; identify the repository only when needed to disambiguate modules.

Add a short **Watch out** note only for approval-critical risks, breaking changes/migrations, or decisions needing user input. Do not hide these to keep the table short.

No implementation walkthroughs, code snippets, diagrams, exhaustive file/symbol inventories, or mandatory Why/Done when sections. Provide deeper detail only when the user asks. Keep acceptance checks and implementation details in worker contracts; keep slicing, scheduling, delegate assignments, and PR bookkeeping in the orchestration ledger.

**Ready:** a reader can see what needs fixing or creating, which modules and pieces change, and any approval-critical concern at a glance.

## Approval

Discover `terminal_start` and inspect its schema. It detects Rex or Herdr from the caller's environment. Call it once with a task-specific `label`, `focus: false`, and this command (quote the absolute path safely for the shell):

```sh
nvim -c 'Markview splitOpen' -- '<absolute-plan-path>'
```

This opens editable Markdown beside a synchronized Markview preview. Create a fresh Rex window in the caller's session or Herdr tab in the caller's workspace for each plan, not a sibling pane, popup, separate session/workspace, or reused Diffview tab. Leave existing plan tabs and unsaved edits alone. Revisions belong to the same plan file and tab; ask the user to reload saved external changes rather than sending a shell command into a running editor. Neovim and `markview.nvim` must already be installed and the `:Markview` command available at startup; report a missing preview as a blocker rather than silently opening source only.

Ask the user to switch to that window/tab, review or annotate the brief, save any edits, exit Neovim, and return with comments or explicit approval. Read the file again after the user reports saved edits. Annotations, exiting, or silence are not approval. If Neovim is unavailable, report the blocker; a substitute needs explicit user agreement.

Revise the same file after comments and request approval again. The first implementation writer waits for explicit approval. A material architecture, scope, behavior, or slice change stops implementation and reopens this gate; a small review-fix delta does not.

**Complete:** the current brief is explicitly approved, with no unapproved material changes before writer launch.
