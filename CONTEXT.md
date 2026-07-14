# Pi-Dev Extension

A pi extension that registers custom tools for Jira, GitHub, and local code checks.

## Code Checks

**Code Check**:
A command that verifies the current codebase locally, such as a type check, linter, or test suite.
_Avoid_: validation, quality gate

**Code Check List**:
The ordered set of code checks configured for a project.
_Avoid_: validation commands, build pipeline

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

## GitHub Tools

**GitHub CLI**:
The `gh` command-line tool. Used as the authenticated transport for GitHub operations.
_Avoid_: gh cli, GitHub command line.

**Pull Request**:
A request to merge a head branch into a base branch on GitHub. The tools expose the abbreviation `PR` to the LLM, but the canonical term is `Pull Request`.
_Avoid_: merge request.

**Issue**:
A GitHub issue used to track bugs, features, or tasks.
_Avoid_: ticket, work item.

**Workflow Run**:
A single execution of a GitHub Actions workflow.
_Avoid_: action run, CI run.

**Workflow**:
A GitHub Actions workflow definition stored in `.github/workflows/`.
_Avoid_: action, pipeline.

**Release**:
A published GitHub release associated with a tag.
_Avoid_: version, tag (unless referring to the git tag).

**Head Branch**:
The branch containing the changes to be merged.
_Avoid_: feature branch, source branch.

**Base Branch**:
The branch into which the changes will be merged.
_Avoid_: target branch, destination branch.

**Repository**:
A GitHub repository, identified by `OWNER/NAME`.
_Avoid_: repo, project (reserved for Jira).

**Draft**:
A pull request that is not yet ready for review.
_Avoid_: WIP.

**Status Check**:
A CI status or check result reported on a pull request.
_Avoid_: check (reserved for Code Check).

**Ship**:
To publish a completed slice of work by opening a GitHub pull request and updating the related Jira issue.
_Avoid_: release, deploy.

## Delegation

**Subagent**:
A scoped `pi` session with a restricted tool/skill set, launched to handle a slice of work independently. The canonical unit of delegation in this extension.
_Avoid_: handoff, spawn, worker.

**Handoff**:
The action of delegating a slice to a subagent by opening a new Herdr tab/pane and seeding it with a prompt. Performed by the `herdr_handoff` tool.
_Avoid_: subagent, spawn.

**Slice**:
A self-contained unit of work handed off to a new Herdr tab.
_Avoid_: task, feature, ticket.

**Herdr Tab**:
A new subcontext inside the current Herdr workspace, used as the target for a handoff.
_Avoid_: pane, window, workspace.

**Subagent Profile**:
A named configuration that defines which skills, tools, model, and Herdr layout a subagent loads. Profiles can be defined or overridden in `~/.pi/agent/pi-dev.json` under the `subagents` key; built-in profiles (`reviewer`, `coder`, `scout`, `minimal`) are used as defaults. Used to keep the subagent's context small and specialized.
_Avoid_: agent template, role, specialization.

**Prompt**:
The markdown instructions passed to a new interactive `pi` session as part of a handoff.
_Avoid_: message, request, instruction.

I just made some fake change
