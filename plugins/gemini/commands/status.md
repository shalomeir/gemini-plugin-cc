---
description: Show status of Gemini jobs
argument-hint: '[job-id] [--all]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" status --json $ARGUMENTS
```

Present the result to the user, focusing on:
- Active/running jobs and their progress
- The most recent completed job
- Any failed jobs with error details

If a specific job-id was provided, show detailed status for that job.
