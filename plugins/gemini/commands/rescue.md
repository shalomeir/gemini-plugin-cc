---
description: Delegate the current task to Gemini CLI for a second opinion or deeper investigation. TRIGGER when user explicitly runs /gemini:rescue or asks to "delegate to Gemini CLI". DO NOT TRIGGER when code or conversation merely mentions "gemini".
argument-hint: '[prompt]'
context: fork
allowed-tools: Bash(node:*), Bash(git:*), AskUserQuestion
---

Use this command when you're stuck, want a second implementation pass, or need Gemini to investigate an issue independently.

Raw slash-command arguments:
`$ARGUMENTS`

If no prompt is provided, ask the user what they want Gemini to work on using `AskUserQuestion`.

Then run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" task $ARGUMENTS
```

Return Gemini's output verbatim.
After returning the result, suggest next steps based on what Gemini found.
