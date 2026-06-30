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

## Configure

Create `~/.pi/agent/pi-dev.json` for global defaults, or `.pi/pi-dev.json` in a project for per-project overrides.

```json
{
  "jira": {
    "defaultProject": "ITA",
    "acliPath": "acli"
  }
}
```

Precedence:
1. `JIRA_DEFAULT_PROJECT` env var
2. `.pi/pi-dev.json`
3. `~/.pi/agent/pi-dev.json`
4. Hardcoded fallback `ITA`

## Tools

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

## Skill

The `jira` skill tells the LLM when and how to use the tools.

## License

MIT
