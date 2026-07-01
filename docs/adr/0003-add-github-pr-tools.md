# Add GitHub PR tools to pi-dev

We will add a small GitHub PR tool surface to the `@abelfubu/pi-dev` extension, backed by the GitHub CLI (`gh`). This lets the slice-ship chain and other agents open, view, and check pull requests through typed tools instead of raw `bash`.

## Considered options

- **Keep using `bash` for `gh` commands** — This is what `slice-ship.delegate` does today. It works, but every agent has to remember the right flags, handle the interactive prompts, and parse the text output. It also leaves PR operations implicit in the tool list.
- **Create a separate package** (e.g. `@abelfubu/pi-github`) — Keeps concerns isolated, but adds install, versioning, and maintenance overhead for a small surface that is already conceptually part of the pi-dev workflow.
- **Add tools to `@abelfubu/pi-dev`** — Reuses the existing extension package and skill directory. The package already hosts Jira tools and code-check tools; PR tools are the natural third leg.

## Decision

Add the tools to `@abelfubu/pi-dev` and expose them as a new skill, `skills/github-pr/SKILL.md`.

## Tool surface (initial)

- **`gh_pr_create`** — Open a PR with title, body, base branch, head branch, and draft flag. Returns the PR URL.
- **`gh_pr_view`** — Read a PR by number, branch, or URL, returning a concise summary.
- **`gh_pr_checks`** — List CI status for a PR.

Not in scope initially: PR review, merge, or comment. The agent can still use `bash` for those until a workflow demands them.

## Consequences

- Requires `gh` to be installed and authenticated. This is already assumed by the `ship-slice` chain, so it does not introduce a new dependency for existing users.
- `gh pr create` prints a URL on success rather than JSON; the tool will parse the URL from stdout.
- `gh pr view` and `gh pr checks` support `--json`, so output parsing is straightforward.
- The `slice-ship.delegate` agent should be updated to prefer `gh_pr_create` once the tools exist, but `bash` remains a fallback.
- The extension name stays `@abelfubu/pi-dev`, but the package description should be updated to mention GitHub PR tools.
