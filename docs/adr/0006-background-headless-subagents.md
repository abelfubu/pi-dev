---
status: accepted
---

# Run headless subagents in the background

Headless subagents start as background Jobs by default so the parent session becomes available immediately and users can continue prompting while delegated work runs. The launch returns a Job ID; completion is queued as a `nextTurn` custom message and announced with a notification, preserving any draft and avoiding an unsolicited agent turn. Herdr remains an explicit interactive backend. This supersedes ADR-0005.
