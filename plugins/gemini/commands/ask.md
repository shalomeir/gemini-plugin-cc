---
description: Ask Gemini CLI a question or delegate a task. TRIGGER when user explicitly runs /gemini:ask or asks to "use Gemini CLI". DO NOT TRIGGER when code or conversation merely mentions "gemini".
argument-hint: '[--background] [--model <model>] [--sandbox] <prompt>'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Delegate a task or question to Gemini CLI.

Raw slash-command arguments:
`$ARGUMENTS`

Execution mode rules:
- If the raw arguments include `--background`, run in background without asking.
- Otherwise, run in the foreground by default.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" task "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase or add commentary.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" task --background "$ARGUMENTS"`,
  description: "Gemini task",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini task started in the background. Check `/gemini:status` for progress."
