---
description: Cancel a running Gemini job
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" cancel --json $ARGUMENTS
```

Present the cancellation result to the user.
If no active job was found, inform the user.
