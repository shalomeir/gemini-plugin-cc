---
description: Analyze the codebase using Gemini's large context window
argument-hint: '[--scope <path>] [--background] <question or focus area>'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Analyze the codebase or a subset of it using Gemini's large context window (1M+ tokens).

Raw slash-command arguments:
`$ARGUMENTS`

Use this when you want Gemini to:
- Analyze overall architecture and patterns
- Find dependencies and coupling between modules
- Review code quality across the entire project
- Understand a large codebase holistically

Execution mode rules:
- If the raw arguments include `--background`, run in background without asking.
- Otherwise, run in the foreground by default.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" analyze $ARGUMENTS
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" analyze --background $ARGUMENTS`,
  description: "Gemini codebase analysis",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini analysis started in the background. Check `/gemini:status` for progress."
