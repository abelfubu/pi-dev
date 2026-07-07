---
name: jira
description: Use when the user wants to track work in Jira — search, view, create, update, transition, or comment on issues — or when another skill needs to drive Jira operations.
---

## Leading word: **track**

The Jira tools track work items through their lifecycle: find, create, update, move, and discuss.

## Common flows

### Triage issues
1. Search: `jira` with `action: search` and a JQL `jql` query.
2. View: `jira` with `action: view` and an issue `key`.
3. **Completion:** The issue details are surfaced.

### Create work
1. Confirm the project key with `jira` action `projects` if unknown.
2. Create: `jira` with `action: create`, `project`, `type`, and `summary`.
3. **Completion:** The new issue key and URL are returned.

### Move work forward
1. View the current status: `jira` with `action: view`.
2. List available transitions: `jira` with `action: transitions`.
3. Transition: `jira` with `action: transition` and `status`.
4. **Completion:** The issue is in the new status.

## Tool reference

- `jira` with `action: search` — find issues with JQL.
- `jira` with `action: view` — read one issue by key.
- `jira` with `action: create` — create a new issue.
- `jira` with `action: update` — edit summary, labels, or assignee.
- `jira` with `action: transition` — change an issue's status.
- `jira` with `action: transitions` — list available status transitions for an issue.
- `jira` with `action: comment` — add a comment.
- `jira` with `action: projects` — list projects to discover keys.

## Conventions

- Descriptions and comments are written in Markdown; the extension converts them to Atlassian Document Format (ADF).
- `project` is required when creating an issue. Always confirm it before calling `jira_create`.
- Use `@me` to assign an issue to the current user.
- If a transition fails, call `jira_transitions` to show the exact status names.
