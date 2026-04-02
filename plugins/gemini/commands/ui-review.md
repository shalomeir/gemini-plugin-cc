---
description: Review UI screenshots against code implementation using Gemini CLI. TRIGGER when user explicitly runs /gemini:ui-review or asks to "use Gemini CLI for UI review". DO NOT TRIGGER when code or conversation merely mentions "gemini".
argument-hint: '<@screenshot.png> [--base <ref>] [--background]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Review UI implementation by comparing screenshots with code.

Raw slash-command arguments:
`$ARGUMENTS`

This command leverages Gemini's native multimodal support to analyze screenshots
alongside the code that produces them.

Core constraint:
- This command is review-only.
- Do not fix issues or apply patches.
- Return Gemini's output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--background`, run in background without asking.
- Otherwise, run in the foreground by default.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" ui-review "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" ui-review --background "$ARGUMENTS"`,
  description: "Gemini UI review",
  run_in_background: true
})
```
- After launching, tell the user: "Gemini UI review started in the background. Check `/gemini:status` for progress."
