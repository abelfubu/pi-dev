---
name: prepare-slices
description: |
  Take an existing PRD (e.g. produced by /grilling), upload it to the Jira
  user story, slice the plan into vertical slices, and create child Jira
  issues. The parent orchestrator provides the PRD path and the Jira US key.
---

# Prepare slices for a user story

## 1. Read the Jira user story and PRD

- agent: slice-ship.scout
- task: |
    Read the Jira user story key from the task. Also read the PRD file path
    provided by the parent (or use the default project PRD location if
    omitted). Summarize the user story, the PRD goals, acceptance criteria,
    and the proposed vertical slices.
  output: "{chain_dir}/us-and-prd.md"

## 2. Synthesize a clean PRD document

- agent: slice-ship.worker
- task: |
    Take the raw grilling output and notes from {previous} and synthesize
    a clean, concise PRD document suitable for uploading to Jira. Include:

    - goals and non-goals
    - user-facing acceptance criteria
    - technical approach and key files
    - vertical slices (one per end-to-end deliverable)
    - risks and open questions

    Write the clean PRD to {chain_dir}/prd.md.
  output: "{chain_dir}/prd.md"

## 3. Upload PRD to Jira

- agent: slice-ship.delegate
- task: |
    Read the PRD from {previous} and update the Jira user story description
    with the PRD content. Preserve existing fields. Report the updated issue
    key and confirmation.
  output: "{chain_dir}/jira-prd.md"

## 4. Slice into vertical child issues

- agent: slice-ship.delegate
- task: |
    Read the PRD from {previous} and use the /to-issues skill (or equivalent
    issue-creation workflow) to create vertical-slice child Jira issues
    under the parent user story. Each child issue should represent one
    end-to-end vertical slice.

    Return a handoff with:
    - parent Jira issue key
    - list of child slice issue keys and summaries in execution order
    - any slices that could not be created and why
  output: "{chain_dir}/slices.md"

## 5. Final handoff

- agent: slice-ship.delegate
- task: |
    Synthesize the outputs from {previous} into a compact final handoff for
    the parent orchestrator. Include:

    - parent Jira issue key
    - PRD location
    - child slice issue keys and summaries (in execution order)
    - any blockers or open questions

    Do not edit project files or Jira beyond what previous steps already did.
  output: "{chain_dir}/ready-for-implementation.md"
