# Delivery

## Checkout isolation

Reuse the normal checkout for sequential work on one branch. If it contains WIP or another branch needs concurrent work, discover `worktrunk` and use `action: create` with the primary repository path, feature branch, and pinned base. Use the returned path as `REPO_DIR` and every delegate's `cwd`; retain the primary path for cleanup. Use Worktrunk rather than raw `git worktree` commands.

Creation runs configured lifecycle hooks before returning. Repositories needing ignored local state should commit a `.worktreeinclude` selecting required entries; configured hooks own copying. If required state is absent after successful hooks, stop and ask. Keep secret contents out of discovery, copying, printing, and manual validation.

Worktrees isolate files, not Git refs: preserve branches used by other worktrees. Pin `REPO_DIR`, `BASE_REF`, `HEAD_BRANCH`, and `REPO` after checkout selection; use explicit coordinates throughout.

## PR boundaries

One PR covers one concern, summarizable in one sentence. Aim for 10–20 changed files; **40 changed files is the hard maximum**. Above 40, split before opening. Count the entire PR diff, not each slice independently.

Plan a sequence of independently mergeable deliveries before implementing a multi-concern feature. Prefer small coherent PRs (for example, domain invariants and tests, then persistence, then wiring) only when each intermediate merge keeps the base branch valid and does not introduce unnecessary speculative code. A delivery may contain multiple implementation slices; review each slice with the human before moving on. Present proposed PR boundaries and merge dependencies at the plan gate. Do not batch multiple independently shippable deliveries into one PR merely for convenience.

Split by subsystem, behavior, or mechanical versus behavioral change. Large generated/mechanical changes belong in dedicated PRs. Breaking changes get their own PR with migration notes rather than unrelated refactors.

Within one repository, deliver sequentially. Dependent follow-on work waits for merge; this workflow does not create stacked open PR chains. Independent repositories deliver concurrently.

## Human-first slice review

After focused checks for EVERY completed implementation slice, open `diffview_review` on its exact change range and request explicit human approval. Do this BEFORE launching any automated review or implementing the next slice. If the user requests changes, repair and present the updated diff again. Closing the viewer, silence, and passing tests never count as approval. For a multi-slice delivery, obtain approval of the complete fixed-base delivery diff before shipping as well; do not assume earlier slice approvals cover new integration changes.

## Automated review

High-risk changes require the global `code-review` skill against the PR's fixed base: security-sensitive behavior, persisted-data migrations, breaking contracts/public APIs, or material cross-cutting changes. Load it in the parent and embed its Standards and Spec axis instructions and fixed base directly into two parallel read-only reviewer tasks. Children need self-contained instructions, not a request to run the orchestration skill.

Both axes pass only when no unresolved actionable blocking findings remain: documented-standard violations, spec gaps, incorrect behavior, or other blockers. Delegate repairs, require focused checks, and rerun affected review. Resolve findings rather than silently waiving them to ship.

Docs/prompts, comments, formatting, typo fixes, and proven no-behavior mechanical renames may be exempt. Routine scoped behavior, API, or dependency changes may also be exempt when focused checks and direct diff inspection provide sufficient confidence. Record the risk assessment and exemption reason; repository-mandated reviews still apply. When uncertain, review.

## Exact-diff human gate

Discover `diffview_review`; call with explicit `repoDir: REPO_DIR` and the appropriate fixed `baseRef` for the slice or delivery. It opens an immutable merge-base-to-HEAD range in the reusable Neovim review tab without stealing focus. Record the reviewed HEAD SHA and range. Human review precedes automated review; final aggregate approval must cover the entire delivery diff.

Ask the user to switch to the tab, review the exact diff, exit Neovim, and return with comments or explicit approval. The user manages the viewer and pastes comments into the conversation; leave the review tab open and do not inspect its session for approval or comments.

For comments, delegate scoped repairs and rerun affected checks, then open a fresh human diff review BEFORE any applicable automated review. Automated review fixes also invalidate human approval and require a new human diff review; rerun only affected automated axes unless the scope materially changes. Before delivery, confirm HEAD still equals the approved SHA and the working tree is clean.

## Final Copilot CLI gate

After human-first and risk-selected automated reviews, and before creating each PR, run a single independent Copilot CLI review of the complete fixed-base delivery diff using `copilot -p "/review ..."` with a prompt that identifies the base/head and asks for actionable bugs, regressions, security, and maintainability issues rather than stylistic noise. Confirm the installed CLI supports the invocation; do not assume the CLI's working-directory defaults select the correct diff. Resolve blocking findings with scoped worker changes, affected checks, and renewed human Diffview approval. Avoid automatic repeat Copilot review loops; rerun only if fixes materially change review scope. If unavailable or failing, stop and report the blocker instead of silently skipping this gate.

## Ship

PR delivery requires explicit authorization and the approved diff. Local delivery stops at a report of commits/checks and retained work.

1. Inspect clean status, PR file count, single concern, check evidence, completed final Copilot gate, and unchanged approved SHA. Run missing mandatory/risk-selected checks; reuse unchanged evidence and successful required hooks.
2. Check open PRs by `@me` using `gh_pr action: list`, explicit `repo: REPO`, and enough pagination to account for this orchestrator's PRs. Lane ownership uses `PI_ORCHESTRATOR_ID`, falling back to `HERDR_PANE_ID`, and the hidden `<!-- pi-orchestrator: <id> -->` body marker. At most one open authored PR per repository **for this orchestrator**, including drafts. Check during planning and immediately before creation. If an owned PR exists, report its URL and stop new-PR creation; intentional adoption follows the follow-up reference. If identity/ownership is unclear, stop and clarify.
3. Push with `git -C <REPO_DIR> push -u origin <HEAD_BRANCH>`.
4. Create the PR exactly once through `gh_pr`, passing explicit `repo: REPO`, `head: HEAD_BRANCH`, `base: BASE_REF`, and title/body plus applicable metadata. Surface the first error; do not retry from another directory or bypass the preflight with raw `gh pr create`.
5. Read `docs/orchestrator/pr-follow-up.md` in this package and subscribe using `github_watch action: watch` with explicit repo, actual PR number, and `worktree: REPO_DIR`. Report the URL and actual monitoring status. Unavailable/failed monitoring must be reported as inactive.

The parent alone pushes and mutates PRs. Delegate restrictions and inactive tools are not a substitute for that ownership rule. No automatic merge follows from green checks.

## Cleanup

Retain feature worktrees while their PRs are open. Remove only after merge or explicit abandonment, after agents using the checkout have stopped, status is clean, and commits are pushed or explicitly disposable.

Use `worktrunk action: remove` with the retained primary repository path and feature branch. Respect refusals for dirty/unmerged work; never use force removal, raw `git worktree remove`, or `git branch -D` to bypass them. Preserve the primary worktree. Report retained work and blockers rather than hiding WIP.
