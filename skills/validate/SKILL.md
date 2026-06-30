---
name: validate
description: Run the validation pipeline for the current Jira issue — collect /review and manual findings, re-prompt the agent with open items, and update Jira on pass.
---

## Purpose

Close the loop between `/review`, manual testing, and the agent. Produces a local validation checklist and re-prompts the agent with open findings until the work passes.

## Prerequisites

- A current Jira issue key.
- The `/review` skill is available.
- Jira tools from the @abelfubu/pi-dev extension are available.

## Process

### 1. Pin the issue

Determine the current Jira issue key. Ask the user if it is not already known.

### 2. Create or read the checklist

Path: `~/.pi/agent/pi-dev/validation/<issue-key>.md`

Ensure the directory exists. If the file exists, read it. If not, create it with this header:

```md
# Validation Checklist: <issue-key>

```

### 3. Capture automated findings

Run the `/review` skill against the current branch or work. Parse its output and append each finding to the checklist as:

```md
- [ ] <finding description> (source: review)
```

If the checklist already contains review findings from this run, do not duplicate them.

### 4. Show the checklist and wait

Present the current checklist to the user. Then ask them to either:

- Add manual findings with `/finding <description>` or by editing the checklist file directly.
- Say `check` when ready for you to re-prompt the agent with open items.
- Say `pass` when all items are resolved and you should update Jira.

### 5. Re-prompt with open items

If the user says `check` and there are open items, generate a focused prompt for the agent that includes only the open findings. Do not include resolved items.

### 6. Loop

After the agent responds, update the checklist: mark any addressed items as resolved (`- [x]`) and add any new review findings. Then return to step 4.

### 7. Pass

If the user says `pass` and the checklist has no open items:

1. Use `jira_comment` to add a summary comment on the issue.
2. Ask the user which transition to apply, then use `jira_transition` to move the issue to that status.
3. Delete the checklist file — it has served its purpose.

## Conventions

- Checklist items use `- [ ]` for open and `- [x]` for resolved.
- Each item must include a source: `(source: review)` or `(source: manual)`.
- Do not update Jira until the user explicitly says `pass`.
- Keep re-prompts focused on the open findings; do not re-explain the whole issue.
