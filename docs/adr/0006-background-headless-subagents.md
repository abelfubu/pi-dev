---
status: accepted
---

# Run headless subagents in the background

Headless subagents start as background Jobs by default so the parent session becomes available immediately and users can continue prompting while delegated work runs. The launch returns a Job ID and completion is announced with a notification. Completion triggers an agent follow-up using `triggerTurn: true` and `deliverAs: "followUp"` (queued after an active turn if needed). Custom-message delivery does not submit or replace editor drafts, and the parent agent consumes a finished Job without waiting for an extra user prompt. Herdr remains an explicit interactive backend. This supersedes ADR-0005.
