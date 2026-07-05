---
name: jira
description: Use when the user wants to track work in Jira — search, view, create, update, transition, or comment on issues — or when another skill needs to drive Jira operations.
---

## Leading word: **track**

The Jira tools track work items through their lifecycle: find, create, update, move, and discuss.

## Common flows

### Triage issues
1. Search: `jira_search`.
2. View: `jira_view`.
3. **Completion:** The issue details are surfaced.

### Create work
1. Confirm the project key with `jira_projects` if unknown.
2. Create: `jira_create`.
3. **Completion:** The new issue key and URL are returned.

### Move work forward
1. View the current status: `jira_view`.
2. List available transitions: `jira_transitions`.
3. Transition: `jira_transition`.
4. **Completion:** The issue is in the new status.

## Tool reference

- `jira_search` — find issues with JQL.
- `jira_view` — read one issue by key.
- `jira_create` — create a new issue.
- `jira_update` — edit summary, labels, or assignee.
- `jira_transition` — change an issue's status.
- `jira_transitions` — list available status transitions for an issue.
- `jira_comment` — add a comment.
- `jira_projects` — list projects to discover keys.

## Conventions

- Descriptions and comments are written in Markdown; the extension converts them to Atlassian Document Format (ADF).
- `project` is required when creating an issue. Always confirm it before calling `jira_create`.
- Use `@me` to assign an issue to the current user.
- If a transition fails, call `jira_transitions` to show the exact status names.
