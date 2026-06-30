# Jira Tools Extension

A pi extension that registers custom Jira tools. It uses the Atlassian CLI (`acli jira`) for authenticated API calls and the `extended-markdown-adf-parser` package to convert between Markdown and Atlassian Document Format (ADF).

## Validation

**Validation Pipeline**:
The process of reviewing agent work, collecting findings, and re-prompting the agent until the work is accepted.
_Avoid_: quality gate, review loop.

**Validation Checklist**:
A tracked list of findings from automated review and manual testing, used to decide when agent work is complete.
_Avoid_: bug list, todo list.

**Finding**:
A specific problem identified during validation, either from automated review or from manual testing.
_Avoid_: issue, bug, defect.

**Pass**:
The state when the validation checklist contains no open findings and the work is accepted.
_Avoid_: done, approved.

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

**Project Key**:
The uppercase prefix of a Jira issue key that identifies the project, e.g. `ITA` in `ITA-133`.
_Avoid_: default board, main project.

**Work Item**:
A Jira issue/ticket. The extension uses the term acli uses (`workitem`), but the tools expose the more familiar term `issue` to the LLM.
_Avoid_: ticket, task (unless the issue type is Task).
