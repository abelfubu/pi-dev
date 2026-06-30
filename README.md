# @abelfubu/pi-dev

Pi extension with Jira tools and skills.

## Install

From git:

```bash
pi install git:github.com/abelfubu/pi-dev
```

## Requirements

- [Atlassian CLI (`acli`)](https://developer.atlassian.com/cloud/acli/guides/install-acli/) installed and authenticated:
  ```bash
  acli auth login
  ```
- Node 20+.

## Config

`~/.pi/agent/pi-dev.json` and `.pi/pi-dev.json` are merged. The `codeChecks` key overrides auto-discovered commands:

```json
{
  "codeChecks": {
    "eslint": "npm run lint:strict",
    "vitest": "npm run test:unit",
    "tsc": "npm run typecheck"
  }
}
```

## Tools

### Jira

| Tool | Purpose |
|------|---------|
| `jira_search` | Search issues with JQL |
| `jira_view` | View an issue by key |
| `jira_create` | Create an issue |
| `jira_update` | Edit summary, labels, assignee |
| `jira_transition` | Transition an issue |
| `jira_transitions` | List available transitions |
| `jira_comment` | Add a comment |
| `jira_projects` | List projects |

### Code checks

| Tool | Purpose |
|------|---------|
| `code_check_discover` | Detect available checks in the project |
| `code_check_eslint` | Run ESLint and summarize errors |
| `code_check_tsc` | Run `tsc --noEmit` and summarize errors |
| `code_check_vitest` | Run Vitest and summarize failures |
| `code_check_parallel` | Run selected checks in parallel |

## Skills

- `jira` — how to use the Jira tools.
- `check` — how to run code checks efficiently.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
