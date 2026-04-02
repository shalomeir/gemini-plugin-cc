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

## Routing

Check if the arguments contain a media file reference (a path ending in `.mp4`, `.mov`, `.webm`, `.mp3`, `.wav`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.pdf`).

**If a media file is detected**, use the `media` subcommand for native multimodal analysis:

```bash
timeout 300 node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" media "$ARGUMENTS"
```

**Otherwise**, use the `task` subcommand:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" task "$ARGUMENTS"
```

Return Gemini's output verbatim.
After returning the result, suggest next steps based on what Gemini found.
