---
name: grill-with-docs
description: |
  Read a Jira user story, run a domain-modeling grilling session, update
  CONTEXT.md and docs/adr as needed, and produce a clean PRD document.
---

# Grill a user story with docs

## 1. Read the user story and existing context

- agent: slice-ship.scout
- task: |
    Read the Jira user story key provided by the parent. Also read the
    existing CONTEXT.md and any docs/adr files. Summarize the user story,
    existing domain terms, and known architectural decisions.
  output: "{chain_dir}/us-and-context.md"

## 2. Grill and document

- agent: slice-ship.worker
- task: |
    Run a grilling session on the user story from {previous} using the
    domain-modeling skill principles:

    - Challenge fuzzy or overloaded terms against the glossary in CONTEXT.md
    - Propose precise canonical terms and update CONTEXT.md inline
    - Invent concrete edge-case scenarios to stress-test boundaries
    - Cross-check the user's claims with the actual code when relevant
    - Create ADRs in docs/adr/ only when a decision is hard to reverse,
      surprising without context, and the result of a real trade-off

    As you go, produce a clean PRD document at {chain_dir}/prd.md that
    includes:
    - goals and non-goals
    - user-facing acceptance criteria
    - technical approach and key files
    - proposed vertical slices (one per end-to-end deliverable)
    - risks and open questions
    - glossary of resolved terms
    - references to any ADRs created

    Return a handoff with:
    - files created or updated (CONTEXT.md, docs/adr/*.md, PRD path)
    - key decisions made
    - unresolved questions that need human input
  output: "{chain_dir}/prd.md"
