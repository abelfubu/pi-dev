---
name: finding
description: Add a manual finding to the validation checklist for the current Jira issue.
---

## Purpose

Capture a manual testing finding so the `/validate` skill can track it and re-prompt the agent.

## Process

1. Determine the current Jira issue key. Ask the user if it is not already known.
2. Ensure the directory `~/.pi/agent/pi-dev/validation/` exists.
3. Create or append to `~/.pi/agent/pi-dev/validation/<issue-key>.md`.
4. Add the finding in this format:

   ```md
   - [ ] <finding description> (source: manual)
   ```

5. Confirm the finding was added and show the updated checklist.

## Conventions

- Use `- [ ]` for open items and `- [x]` for resolved items.
- Keep the description actionable: what is wrong, and what would make it pass.
- If the user gives multiple findings in one prompt, add each as a separate checklist item.
