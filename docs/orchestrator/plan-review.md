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

Run `md-viewer` directly through `bash` in the parent orchestrator's terminal context (quote the absolute path safely for the shell):

```sh
md-viewer open '<absolute-plan-path>'
```

`md-viewer` manages the preview layout: the first preview opens to the right of the caller as a vertical split in the same Rex tab, without taking focus. Later previews open below the newest preview; an already shown file reuses its preview. Do not launch it through `terminal_start`, a delegate, a new window/tab, or another split: that would change the caller context or create an extra pane. Do not use Neovim/Markview or the Diffview tab for plan reviews.

Keep revisions in the same plan file. After substantially revising it, run `md-viewer open --replace '<absolute-plan-path>'` from the same orchestrator pane to update its last preview rather than create another pane. Leave unrelated previews alone. Always include the absolute plan path in the reply.

Ask the user to review the preview beside the orchestrator and return with comments or explicit approval. No editor exit is required. Read the file again after the user reports saved external edits. Annotations, closing the preview, or silence are not approval. If `md-viewer` fails or `md-viewer`/Rex is unavailable, report the blocker and the plan path; do not retry, install anything, or silently substitute another viewer. Continue discussion in chat, but implementation still waits for explicit approval; a substitute viewer needs explicit user agreement.

Revise the same file after comments and request approval again. The first implementation writer waits for explicit approval. A material architecture, scope, behavior, or slice change stops implementation and reopens this gate; a small review-fix delta does not.

**Complete:** the current brief is explicitly approved, with no unapproved material changes before writer launch.
