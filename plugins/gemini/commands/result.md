---
description: Show result of a completed Gemini CLI job. TRIGGER only when user explicitly runs /gemini:result. DO NOT TRIGGER on casual mention of "gemini".
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" result "$ARGUMENTS"
```

Return the command stdout verbatim, exactly as-is.
Do not paraphrase, summarize, or add commentary.
Do not fix any issues mentioned in the output.
