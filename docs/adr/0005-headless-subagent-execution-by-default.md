---
status: accepted
---

# Headless subagent execution by default

Subagents use awaited, isolated `pi --mode json` subprocesses by default so their final output, token usage, failures, and cancellation remain owned by the calling tool. This deliberately avoids the large parent and child context footprint of feature-rich SDK subagent extensions: pi-dev exposes one narrow delegation tool and loads only each child's explicitly configured resources. Herdr remains available as an explicit interactive backend, while detached execution, SDK sessions, RPC steering, and removal of Herdr are deferred until real workflow usage justifies their additional complexity. This supersedes ADR-0004.
