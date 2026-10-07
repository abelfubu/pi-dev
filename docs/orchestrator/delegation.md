# Delegation

## Slice contracts

Read repository instructions before drafting a task. Every delegate receives:

- Absolute checkout path, also passed as `cwd`; relevant exact file paths and specification/evidence.
- One bounded objective, up to 3 acceptance criteria, dependencies, and explicit non-goals.
- Known breaking changes, affected consumers, migration path, and verification expectations.
- The checkpoint and result contract below. File paths belong in task text; there is no attachments field.

Worker tasks additionally carry an implementation plan:

- **Intent:** why the change exists and the required behavior.
- **Modifications:** each existing file, relevant interfaces/functions/symbols, and intended change.
- **Additions:** each new file, interfaces/functions/symbols, and purpose.

A review-fix task carries only the repair delta. Include this remote-mutation guardrail verbatim:

> Do not run git push. Do not create, update, close, merge, or comment on a PR. Stop after local commits and checks.

Workers follow test-first red-green development, using the `tdd` skill when available. Docs/config/prompt-only work may be test-exempt; record the exemption. Applicable repository checks still apply. Commit only completed, green implementation slices.

## Roles and scheduling

- `researcher`: read-only exploration, flow maps, proposed boundaries.
- `planner`: read-only options and implementation plans; the parent owns the final plan.
- `oracle`: read-only trade-off advice.
- `worker`: implementation and focused checks; the only implementation writer.
- `reviewer`: read-only findings with file:line citations.

One writer per checkout. Read-only work may share it, but review/check evidence must describe a stable revision: if a writer changes the inspected files, refresh affected evidence. Different repositories can run writers concurrently. A waiting PR in one lane does not idle another.

Within a repository, the default is sequential implementation and delivery. Read-only preparation for the next PR can proceed while the current PR is open. Exceptional local pre-implementation requires a separate worktree, stays unpushed/unreviewed, and is rebased and reverified after the prior PR merges. It does not permit a second open authored PR for this orchestrator.

## Async results and recovery

Use `async: true`. Record the returned `runId`; read the result file upon completion notification. Use `acp_delegate_wait` only to intentionally block for a required result. A timeout leaves the run active: continue independent work and await notification rather than retrying or redispatching.

The harness captures completion; the delegate returns its report as its final message rather than writing a separate result artifact. A failed notification is not verified completion. Read its excerpt, partial reply, activity log, and checkout state before recovery.

Use `resumeFrom` for failed/cancelled runs when their prior work is worth retaining. For a successful partial checkpoint, dispatch a fresh continuation with the checkpoint and current checkout state embedded. Resliced work always receives a fresh bounded contract. Cancel only runs no longer wanted; account for every dispatched run before reporting completion.

## Checkpoints

Design slices to fit comfortably in a delegate's context. Where context telemetry is available, target below 35%; at 50%, stop implementation and checkpoint. Without telemetry, use the observable scope bounds rather than guessing percentages.

Checkpoint and reslice when work expands past 8 implementation files, exceeds 3 independent behaviors, or combines implementation with broad regression repair. Research, implementation, repair, broad verification, and review are separate slices.

A checkpoint reports:

- Completed behavior and changed files.
- Branch/commit and `git status`.
- Focused checks already run, their results, and exact failing tests/errors.
- Remaining work in bounded slices; blockers, assumptions, and breaking changes.

Preserve incomplete work in the working tree and label it partial. Release the writer lock only after the run has stopped.

## Check evidence

Workers own the smallest focused lint/type/test checks that prove the slice. Use repository-owned `code_check` tooling where supported; honor mandatory global/repository checks. Raw commands are for unsupported checks, tool execution failures, or missing failure diagnostics.

Record command, result, and revision/working-tree state. Reuse passing evidence when relevant files and inputs are unchanged and no failure casts doubt on it. Extra checks serve missing coverage, changed inputs, failure isolation, or CI reproduction—not a ritual second verification delegate.

Public contracts, persisted data, cross-cutting changes, and breaks justify broader unit/integration coverage. Full E2E requires repository policy or concrete risk. Reliable required CI can supply broader coverage, but pending CI is not green evidence.

Before PR delivery, inspect clean status, single-concern diff, file count, and evidence across slices; run missing required checks only. Successful required Husky/pre-push/lint-staged hooks count as evidence. Push normally; `--no-verify` requires equivalent explicit checks or user authorization for a known unrelated hook failure, with the reason recorded.
