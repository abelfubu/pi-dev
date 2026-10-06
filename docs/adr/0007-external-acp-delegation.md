---
status: accepted
---

# Delegate through the external ACP provider

Delegation is owned by billion-dollars' `acp_delegate`, which is already used by the orchestrator. Remove pi-dev's unused headless and Herdr subagent launchers, profiles, and completion protocol rather than maintain a second execution harness. Keep GitHub/Jira tools, the watcher, code checks, Worktrunk, and Herdr terminal/review tools; parent-only shipping and subscription guards identify ACP delegates through `PI_ACP_DELEGATE_DEPTH`. This supersedes ADR-0006; ADR-0004 and ADR-0005 remain historical decisions.
