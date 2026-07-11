# Scout Report: `grill-with-docs` in `abelfubu/pi-dev`

## TL;DR

`grill-with-docs` does **not** exist yet in this repository. There is a one-line stub skill installed globally (`~/.pi/agent/skills/grill-with-docs/SKILL.md`), and there is a known workflow from another project (`/story` → `/grilling` → `/to-prd`) that uses it. The most likely goal is to promote that stub into a first-class `pi-dev` package capability: a `grill-with-docs` skill (possibly paired with `domain-modeling`), a `/grilling` prompt template, and documentation updates.

## 1. What I searched

| Search | Result |
|--------|--------|
| Code search for `grill` / `grill-with-docs` / `grilling` in `/Users/abelfubu/dev/pi-dev` | No matches |
| Git history: `git log --all --grep=grill -i` | No matches |
| Branches containing `grill` | None (`main`, `feat/github-tools-suite`) |
| GitHub issues/PRs for `grill` in `abelfubu/pi-dev` | No matches |
| Pi core docs (`~/.local/share/.../pi-coding-agent`) for `grill` | No matches |
| Global/user skill dirs (`~/.pi/agent/skills`, `~/.agents/skills`) | Found `grill-with-docs/SKILL.md` stub and related session history |

## 2. Relevant repository structure

The package is a `pi` extension (`@abelfubu/pi-dev`). It already ships skills, prompts, chains, and subagent profiles:

```
pi-dev/
├── package.json              # pi manifest: extensions, skills, prompts, subagents
├── README.md                 # public usage docs
├── CONTEXT.md                # domain glossary (no grilling terms yet)
├── docs/adr/                 # architectural decisions (4 ADRs, none about grilling)
├── skills/
│   ├── ast-grep/SKILL.md
│   ├── check/SKILL.md
│   ├── github/SKILL.md
│   └── jira/SKILL.md
├── prompts/
│   └── orchestrator.md       # only existing prompt template
├── chains/
│   ├── implement-slice.chain.md
│   └── ship-slice.chain.md
├── agents/
│   ├── slice-ship.scout.md
│   ├── slice-ship.worker.md
│   ├── slice-ship.reviewer.md
│   └── slice-ship.delegate.md
├── lib/                      # TypeScript helpers + tests
└── extensions/               # tool registration (Jira, GitHub, Herdr, code-check)
```

### How a new skill/prompt would fit

- `skills/` directories containing `SKILL.md` are auto-discovered per the [Agent Skills standard](https://agentskills.io/specification).
- `prompts/*.md` files become `/name` commands; filename minus `.md` is the command name.
- `chains/*.chain.md` and `agents/*.md` are used by the Herdr subagent tools in `extensions/herdr-tools.ts`.
- `package.json` already lists `skills`, `prompts`, and `subagents` in the `pi` manifest, so new files are picked up without manifest changes.

## 3. Existing documentation about grilling

Inside the repo:

- **README.md**: lists the four current skills (`jira`, `github`, `check`, `ast-grep`) and two chains (`implement-slice`, `ship-slice`). No mention of `grill-with-docs`.
- **CONTEXT.md**: defines terms like *Subagent*, *Slice*, *Handoff*, *Validation Pipeline*. No grilling/domain-modeling terms.
- **docs/adr/**: ADRs 1–4 cover Jira transport, local validation, GitHub PR tools, and subagent execution via Herdr. No grilling ADR.

Outside the repo (context for the goal):

- `~/.pi/agent/skills/grill-with-docs/SKILL.md` and `~/.agents/skills/grill-with-docs/SKILL.md` (a symlink) are identical stubs:

  ```yaml
  ---
  name: grill-with-docs
  description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
  disable-model-invocation: true
  ---

  Run a `/grilling` session, using the `/domain-modeling` skill.
  ```

- `~/.agents/skills/domain-modeling/SKILL.md` is a full skill that defines how to challenge terms, write `CONTEXT.md`, and offer ADRs. It also ships `ADR-FORMAT.md` and `CONTEXT-FORMAT.md`. This is the dependency the stub references.
- Session history shows `grill-with-docs` being used in a real workflow: `/story <Jira-key>` → `/grilling` → `/to-prd`. In that project the missing `/grilling` prompt was created as `.pi/prompts/grilling.md`.

## 4. Existing implementation

- **In `pi-dev`**: zero implementation. No skill, no prompt, no chain, no ADR, no tests, no README mention.
- **Globally**: a stub skill that points to `domain-modeling` but does not itself contain interview instructions, artifact rules, or exit criteria.

## 5. Gaps and open questions

1. **Shape of the goal**: Should `grill-with-docs` become a skill, a prompt template, a chain, or all three? The existing stub says skill; the prior workflow shows a `/grilling` prompt.
2. **Dependency on `domain-modeling`**: `domain-modeling` is not in this repo. Should it be added as a separate packaged skill, or should its rules be inlined into `grill-with-docs`?
3. **Trigger mechanism**: The stub has `disable-model-invocation: true`, which means it must be invoked explicitly (via `/skill:grill-with-docs` or a prompt that loads it). Is that intentional, or should it be discoverable?
4. **Artifacts**: Should a grilling session write/update `CONTEXT.md` and ADRs automatically, or only guide the conversation? The description says “creates docs … as we go.”
5. **Jira/PRD integration**: Should this tie into the existing `implement-slice` / `ship-slice` workflow (e.g., `/story` → `/grilling` → `/to-prd`), or remain standalone?
6. **Subagent delegation**: Should a grilling session be run as a dedicated subagent profile (e.g., `grill-with-docs.interviewer.md`) so the parent orchestrator stays lightweight?
7. **Testing**: The repo currently only tests `lib/**/*.test.ts` and `extensions/**/*.test.ts`. There is no test harness for skills or prompts. Should we add at least frontmatter/validation smoke tests?
8. **Naming conflicts**: The package already uses the term `Slice` for vertical work units. Does the grilling concept introduce new terms that need to be reconciled with `CONTEXT.md`?
9. **Documentation**: README and CONTEXT.md will need updates. Is there a desire for a new ADR documenting the decision to add grilling?

## 6. Proposed small, independently verifiable slices

1. **Define the scope** (scout/PM slice)
   - Decide: skill only, skill + prompt, or skill + prompt + chain.
   - Decide whether `domain-modeling` is packaged separately or inlined.
   - Accept/reject Jira/PRD integration with existing slice-ship workflow.

2. **Add the `domain-modeling` skill** (if not inlining)
   - Create `skills/domain-modeling/SKILL.md` (or merge into `grill-with-docs`).
   - Include `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` references if packaged separately.
   - Verify pi loads it without warnings.

3. **Implement `skills/grill-with-docs/SKILL.md`**
   - Write full instructions: when to start a session, how to challenge fuzzy terms, how to cross-check against `CONTEXT.md`, when to update `CONTEXT.md`, when to offer an ADR, and when to stop.
   - Keep or remove `disable-model-invocation: true` based on the scope decision.
   - Ensure frontmatter is valid per Agent Skills spec.

4. **Add `/grilling` prompt template**
   - Create `prompts/grilling.md` that expands into a grilling session and loads `grill-with-docs` + `domain-modeling`.
   - Optional argument-hint for the topic/story: `[topic]`.

5. **Add a chain or subagent profile (optional)**
   - Create `chains/grill-with-docs.chain.md` or `agents/grill-with-docs.interviewer.md` if grilling should be delegated to a focused subagent.

6. **Update documentation**
   - Add `grill-with-docs` and `domain-modeling` to `README.md` skills table.
   - Add grilling terms to `CONTEXT.md` if they become part of the package’s domain language.
   - Add `docs/adr/0005-grill-with-docs.md` if the design decision is hard-to-reverse/surprising.

7. **Add smoke tests**
   - Verify that every new `SKILL.md` has required frontmatter (`name`, `description`) and that prompt templates are parseable.
   - Ensure `package.json` `files` array includes the new directories (it already does).

8. **End-to-end manual test**
   - Install the package locally (or run `pi` with `-e .`) and verify `/skill:grill-with-docs` and `/grilling` are available and produce expected behavior.

## 7. Recommended next step

Run **Slice 1** (scope decision) before writing code. Once the shape is agreed, the smallest independently verifiable deliverable is **Slice 3** (the full `skills/grill-with-docs/SKILL.md`) plus **Slice 4** (`prompts/grilling.md`), which can be tested without touching code-check logic or subagent execution.

---
*Scout findings written to:* `/.pi/subagent-results/scout-1783760717017-ozx7tymz.md`
*Also available as:* `/.pi/subagent-results/scout-grill-with-docs.md`
