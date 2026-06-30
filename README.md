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

`~/.pi/agent/pi-dev.json` and `.pi/pi-dev.json` are reserved for future configuration. They are not required today.

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

## Creating an issue

`jira_create` requires a `project` key. Example:

```
prompt: create a bug in ITA titled "Login fails on Safari"
```

## Skill

The `jira` skill tells the LLM when and how to use the tools.

## Theme

Includes the `material-darker` TUI theme. After installing the package, select it via `/settings` or set `"theme": "material-darker"` in `settings.json`.

## License

MIT
