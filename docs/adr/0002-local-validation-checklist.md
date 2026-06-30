# Store validation checklist in a local file

The validation pipeline collects findings from automated `/review` and manual testing. We chose a user-scoped file at `~/.pi/agent/pi-dev/validation/<issue-key>.md` over Jira subtasks or comments or a repo-local file. The checklist is ephemeral rework tracking, not permanent team-visible work. Keeping it outside the repo avoids git noise and version-control clutter. The file is deleted when validation passes, so abandoned validations are the only growth risk; we can add a TTL later if needed.
