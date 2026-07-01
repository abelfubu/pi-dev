---
name: github-pr
description: Use the GitHub tools from the @abelfubu/pi-dev extension to create, view, and check pull requests.
---

## Purpose

Use these tools when you need to interact with GitHub pull requests, especially when shipping a slice or checking merge readiness.

## Tools

- `gh_pr_create` — open a new PR from the current branch.
- `gh_pr_view` — read a PR by number, branch, or URL.
- `gh_pr_checks` — list CI status checks for a PR.

## Conventions

- `repo` is always `OWNER/NAME` (e.g. `abelfubu/pi-dev`).
- `body` is Markdown and is passed through to GitHub as-is.
- If `body` is omitted for `gh_pr_create`, the tool uses `--fill` to autofill the body from commits.
- `gh_pr_checks` returns exit code `8` in details when checks are still pending; this is not treated as an error.
