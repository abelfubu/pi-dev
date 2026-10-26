# Plan gate

The parent synthesizes the proposal; researchers supply evidence and options, not the final decision. Write for a human deciding whether this is the right change. Keep implementation details in separate worker contracts.

## Review brief

Write a Markdown file outside every repository. Aim for **200–350 words**, fewer for small changes. The reader should understand the outcome, approach, and main trade-off in about a minute.

Lead with the user-visible result, then use this shape:

- **Why:** the problem and what will be better, in 1–2 sentences.
- **What changes:** 3–5 short numbered steps, each describing a concrete change and its purpose. Mention a file or component only when it helps locate the change; keep symbol inventories and code snippets in worker contracts.
- **Watch out:** material risks, assumptions, breaking changes with migration paths, and decisions needing input. For a meaningful trade-off, state the recommendation and why it beats the strongest alternative. Omit this section when there is nothing material to flag.
- **Done when:** 1–3 observable outcomes and the focused checks that prove them. Include a short scope boundary when adjacent work might be expected.

Use plain language and short sentences. Explain necessary technical terms where they first appear. Describe how behavior changes rather than listing implementation chores. Keep scheduling, delegate assignments, and PR bookkeeping in the orchestration ledger.

Add **one small ASCII diagram** when a flow, boundary, or before/after is easier to see than explain. Use a fenced `text` block, roughly 3–6 labeled nodes, and lines narrow enough for a terminal. It must be readable directly in Neovim without a renderer. Skip diagrams that only repeat the steps.

Keep every material decision and break in the brief, even if it exceeds the target length. If the proposal is still hard to scan, split it into independently reviewable changes and state their dependencies. Supporting details may live in linked notes; approval-critical information stays in the brief.

**Ready:** a reader can say what changes, why, what could go wrong, and how success will be checked without opening implementation notes.

## Approval

Discover `terminal_start` and inspect its schema. It detects Rex or Herdr from the caller's environment. Call it once with a task-specific `label`, `focus: false`, and this command (quote the absolute path safely for the shell):

```sh
nvim -c 'Markview splitOpen' -- '<absolute-plan-path>'
```

This opens editable Markdown beside a synchronized Markview preview. Create a fresh Rex window in the caller's session or Herdr tab in the caller's workspace for each plan, not a sibling pane, popup, separate session/workspace, or reused Diffview tab. Leave existing plan tabs and unsaved edits alone. Revisions belong to the same plan file and tab; ask the user to reload saved external changes rather than sending a shell command into a running editor. Neovim and `markview.nvim` must already be installed and the `:Markview` command available at startup; report a missing preview as a blocker rather than silently opening source only.

Ask the user to switch to that window/tab, review or annotate the brief, save any edits, exit Neovim, and return with comments or explicit approval. Read the file again after the user reports saved edits. Annotations, exiting, or silence are not approval. If Neovim is unavailable, report the blocker; a substitute needs explicit user agreement.

Revise the same file after comments and request approval again. The first implementation writer waits for explicit approval. A material architecture, scope, behavior, or slice change stops implementation and reopens this gate; a small review-fix delta does not.

**Complete:** the current brief is explicitly approved, with no unapproved material changes before writer launch.
