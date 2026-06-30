# Jira Tools Extension

A pi extension that registers custom Jira tools. It uses the Atlassian CLI (`acli jira`) for authenticated API calls and the `extended-markdown-adf-parser` package to convert between Markdown and Atlassian Document Format (ADF).

## Language

**Jira Tool**:
A custom pi tool registered by the extension. Each tool maps to one Jira operation (search, view, create, update, transition, comment, list projects).

**ACLI**:
The Atlassian CLI (`acli`). Used as the authenticated transport to Jira Cloud.
_Avoid_: acli-jira (the skill name), jira-api (the old script name).

**ADF**:
Atlassian Document Format. The JSON representation Jira uses for rich-text fields like descriptions and comments.
_Avoid_: Atlassian format, rich text.

**Markdown Bridge**:
The conversion between user-facing Markdown and ADF using the `extended-markdown-adf-parser` package.
_Avoid_: format parser, text converter.

**Default Project**:
The project key used when a tool does not receive an explicit `project`. Currently `ITA`.
_Avoid_: default board, main project.

**Work Item**:
A Jira issue/ticket. The extension uses the term acli uses (`workitem`), but the tools expose the more familiar term `issue` to the LLM.
_Avoid_: ticket, task (unless the issue type is Task).
