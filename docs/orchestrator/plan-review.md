# Plan gate

The parent synthesizes the architecture proposal; researchers supply evidence and options, not the final decision. Keep detailed worker contracts separate from the user-facing brief.

## Review brief

Write a concise Markdown file outside every repository. Completeness, not a word quota, determines its length. Include:

1. **Change summary:** what changes, why, and expected behavior.
2. **Flow diagram:** one small ASCII diagram showing module boundaries and important dependencies.
3. **Code map:** `file → function/interface/symbol → intended change`, distinguishing modifications from additions. Important contracts may have short snippets labeled proposed, not final.
4. **Decisions to challenge:** at most 3 material choices or uncertainties, each with proposed decision, rationale, strongest alternative, and evidence that would change it. `None` requires repository evidence or an approved specification for every material choice.
5. **Delivery & safety:** slice/PR dependencies, focused checks, non-goals, risks/assumptions, and breaks with migration paths; use `None` where applicable.

Keep every material decision and break visible. If this requires a sprawling proposal, split into independently reviewable changes rather than hiding risks in worker contracts.

## Approval

Discover `herdr_start` and inspect its schema. Call it once with `command: "glow -p <absolute-plan-path>"`, a task-specific `label`, `focus: false`, and `reviewTab: true`. Quote the path safely for the shell. Reuse the review tab in the same workspace; leave it open for later Glow/Diffview reviews.

Ask the user to switch to that tab, inspect the brief, exit Glow, and return with comments or explicit approval. Exiting or silence is not approval. If the required viewer is unavailable, report the blocker; a substitute needs explicit user agreement.

Revise the same file after comments and request approval again. The first implementation writer waits for explicit approval. A material architecture, scope, behavior, or slice change stops implementation and reopens this gate; a small review-fix delta does not.

**Complete:** the current brief is explicitly approved, with no unapproved material changes before writer launch.
