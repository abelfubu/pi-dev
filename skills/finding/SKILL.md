---
name: finding
description: Use when the user wants to record a manual testing finding, add a defect to the validation checklist, or when another skill needs to capture a manual finding for the current Jira issue.
---

## Leading word: **capture**

Capture manual findings so the `/validate` skill can track them and re-prompt the agent.

## Process

1. Determine the current Jira issue key. Ask the user if it is not already known.
2. Ensure the directory `~/.pi/agent/pi-dev/validation/` exists.
3. Create or append to `~/.pi/agent/pi-dev/validation/<issue-key>.md`.
4. Add the finding in this format:

   ```md
   - [ ] <finding description> (source: manual)
   ```

5. **Completion:** The finding appears in the checklist and the updated checklist is shown to the user.

## Conventions

- Use `- [ ]` for open items and `- [x]` for resolved items.
- Keep the description actionable: what is wrong, and what would make it pass.
- If the user gives multiple findings in one prompt, add each as a separate checklist item.
