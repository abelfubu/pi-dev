---
status: accepted
---

# Run headless subagents in the background

Headless subagents start as background Jobs by default so the parent session becomes available immediately and users can continue prompting while delegated work runs. The launch returns a Job ID and completion is announced with a notification. When the editor is empty, completion is appended as a custom message immediately with `triggerTurn: false`; when the editor contains a draft, completion is queued as a `nextTurn` custom message. This preserves drafts, avoids unsolicited agent turns, and does not require an extra user prompt merely to reveal an already-completed Job. Herdr remains an explicit interactive backend. This supersedes ADR-0005.
