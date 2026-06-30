---
name: jira
description: Use the Jira tools from the @abelfubu/pi-dev extension to search, view, create, update, transition, and comment on Jira issues.
---

## Purpose

Use these tools when the user wants to interact with Jira: finding tickets, reading details, creating work, updating fields, moving tickets through a workflow, or adding comments.

## Tools

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
- The default project is `ITA` unless another is configured or passed.
- Use `@me` to assign an issue to the current user.
- Always confirm the project key before creating if the user did not specify one.
- If a transition fails, call `jira_transitions` to show the exact status names.
