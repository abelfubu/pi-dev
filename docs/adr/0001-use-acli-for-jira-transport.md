# Use acli jira as the Jira transport

We chose to drive all Jira operations through the Atlassian CLI (`acli jira`) instead of calling the Jira REST API directly or reusing the existing `~/.local/bin/jira-api` wrapper. acli already handles OAuth authentication, so the extension does not need to manage `JIRA_API_TOKEN` or ask users for tokens. For Markdown ↔ ADF conversion we use the npm package `extended-markdown-adf-parser`, which is bidirectional and well-tested, instead of embedding the old `~/.local/bin` scripts.

## Considered Options

- **Reuse `jira-api`** — Fastest path, but it hardcodes project `ITA`, user email, and a `JIRA_API_TOKEN` env var. It would need heavy refactoring to be portable.
- **Direct REST with `fetch`** — Cleanest and most flexible, but would require the extension to handle OAuth/API tokens itself.
- **`acli jira`** — Gives authenticated commands out of the box. JSON output is stable enough for our tools.
- **Reuse `~/.local/bin/adf-to-md` and `md-to-adf`** — Already local, but embedding them as modules would have recreated the wheel inside the package.
- **Use `extended-markdown-adf-parser`** — One dependency, bidirectional, handles standard Markdown plus ADF-specific elements like panels and mentions.

We picked **acli jira** because authentication is the hardest part to get right across multiple machines, and acli solves it. We picked **extended-markdown-adf-parser** because it replaces both conversion scripts with a single maintained dependency.

## Consequences

- Every machine must install `acli` and run `acli auth login` before the tools work.
- Tool output relies on acli's JSON shape; if acli changes its output, we must update our parsers.
- The package depends on `extended-markdown-adf-parser` for text conversion.
- `jira_create` requires an explicit `project` key; no default project is configured anywhere.
- `pi-dev.json` is kept as an empty config scaffold for future concepts.
