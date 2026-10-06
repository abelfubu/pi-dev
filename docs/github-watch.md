# Shared GitHub watcher (first iteration)

One local daemon polls explicitly registered GitHub.com PRs. CLI clients and Pi sessions share its snapshots; each consumer owns an independent acknowledgment and a bounded subscription lease. Nothing pushes, edits, resolves threads, or merges automatically.

## Run

From this checkout:

```sh
node cli/github-watch.mjs start
node cli/github-watch.mjs watch ORG/server#742 --consumer my-orchestrator --worktree /absolute/worktree
node cli/github-watch.mjs status ORG/server#742 --consumer my-orchestrator
node cli/github-watch.mjs events --consumer my-orchestrator
node cli/github-watch.mjs ack ORG/server#742 --consumer my-orchestrator --revision 1
node cli/github-watch.mjs cancel ORG/server#742 --consumer my-orchestrator
node cli/github-watch.mjs stop
```

Published/global installs expose `github-watch` through npm's `bin` entry. Pi package installs include the CLI, and the extension launches it by package-relative path; no global executable is required.

`start` launches a detached daemon if none is running. `daemon` runs in the foreground for diagnostics. `stop` stops the shared service for **all** clients. `list` lists cached records and active leases for a consumer. `refresh OWNER/REPO#PR` forces reconciliation (coalesced with an existing read). `status` never fetches GitHub: inspect `fetchedAt`, `stale`, and `error` before relying on it. CLI output is JSON; `events` is JSONL across all PRs subscribed by that consumer. Event streams are not automatically reconnected by the CLI; the Pi adapter reconnects every five seconds.

## Pi

Load `extensions/github-watch.ts`, or enable it in the package resource selection and restart/reload Pi. This repository's globally configured package has an explicit extension allowlist, so updating code alone does not enable this new extension. For development:

```sh
pi --extension /absolute/path/to/pi-dev/extensions/github-watch.ts
```

The `github_watch` tool supports `watch`, `list`, `status`, `refresh`, `ack`, and `cancel`. `watch` accepts explicit `repo`, `pr`, optional `worktree`, and `leaseSeconds` (default four hours, allowed 30 seconds–24 hours). Repeating `watch` renews the lease without resetting its acknowledgment.

The consumer is the **Pi session ID**, not a mutable branch or cwd. The parent can watch server and web PRs from `~/dev`. ACP delegates identified by `PI_ACP_DELEGATE_DEPTH` cannot manage subscriptions. Bind a worktree explicitly; the watcher never chooses where edits should occur.

On a change, the extension queues `followUp` with `triggerTurn: true`. It coalesces changes behind one outstanding wakeup per PR. Read current status and acknowledge the **inspected revision**, not a later revision. Newer pending changes then produce another wakeup. An acknowledgment means inspected, not resolved. Aborting the agent does not acknowledge feedback or immediately create another wakeup loop; inspect status manually or reconnect/restart to recover pending work.

Cancellation cannot retract an already queued Pi message. Always verify `subscriptionActive` before acting. Lease expiry emits a display-only notice, stops polling when no other active consumers need that PR, and never renews automatically. Merged PRs receive a final snapshot and are no longer polled. Closed PRs are polled slowly (five minutes) while their leases remain active, so reopening is eventually detected; explicit refresh detects it sooner.

Pi shutdown disconnects its client, **not** the shared daemon. Its unexpired lease can keep polling while Pi is offline. Reopening the same session reconnects and receives the latest unacknowledged revision. A new Pi session has a different consumer and must register its own PRs.

## State and correctness

State lives in `~/.pi/github-watch/state.json`; socket and lock are beside it. Override with `PI_GITHUB_WATCH_DIR` (use a short absolute path because Unix socket paths have platform length limits). Directory permissions are 0700; state/socket permissions are 0600. Full GitHub feedback is stored locally—treat the directory and temporary status files as sensitive.

For this first iteration, persistence is a **single-writer, atomically replaced JSON file**, not SQLite. This avoids a native dependency and preserves subscriptions, last-good snapshots, and acknowledgments. It is not an event-history database or a power-loss-durable journal. SQLite can replace the storage adapter when discovery/history or higher scale needs it.

The daemon pins the current GitHub.com credential at startup (never writes the token), records the authenticated login, and refuses to reuse another account's state directory. It does not switch global gh authentication. To change accounts, stop it and use a separate state directory. Multiple GitHub hosts/accounts within one daemon are not supported yet. A running daemon's identity is returned by `start`/`ping`.

One target is reconciled at a time; requests for the same target share in-flight work. Normal cadence is 30–35 seconds, with exponential failure backoff capped at five minutes. Explicit refresh can bypass scheduled backoff. Network/auth/API failures retain the last good snapshot and expose an error/stale status; this version does not automatically wake the agent for transport errors. Persistence failures roll back the in-memory mutation, mark service/status health through `persistenceError`, and do not publish uncommitted changes. Polling remains scheduled.

Conversation comments and reviews use REST pagination. Review threads and their replies use GraphQL pagination. Snapshots retain edited bodies, resolution/outdated flags, and empty review bodies/states. Check rollups come from `gh pr view` and retain conclusions, URLs and timestamps. A second head/lifecycle read rejects reconciliation across a concurrent push. CI rollup is tagged with the observed PR head, **not** a guarantee of a specific workflow execution SHA or required-check completeness; inspect run/job state before diagnosing or claiming readiness. Explicit workflow attempts, logs, bot-only filtering, and account-wide PR discovery are follow-ups.

Notifications signal **snapshot changes**, not every historical GitHub event. Reconnection delivers the latest unacknowledged revision, coalescing intermediates. Edited/deleted objects can be reflected in complete current reads, but comments deleted while offline cannot be reconstructed. Initial registration delivers the full current snapshot as revision 1.

Only one daemon may own a state directory. Normal shutdown removes its socket/lock. After an unclean crash, inspect `daemon.lock`, verify its PID is not running, and remove the stale lock before restarting. Recovery deliberately does not automatically steal a potentially live daemon lock.

Two consumers can observe one PR, but this version has **no exclusive mutation ownership**. The orchestrator must prevent competing fixers. External comments are untrusted input. All existing review, approval, and shipping gates remain in force.

## Deferred

- Account-wide discovery and orchestrator-marker adoption.
- SQLite-backed history and explicit freshness/rate-limit policy.
- Author/interest filters and Actions failure logs/attempt identity.
- Webhook transport adapters.
- Exclusive mutation ownership and automatic daemon supervision.

Verification uses mocked GitHub responses and a real local-socket integration test; no live GitHub mutations are required.
