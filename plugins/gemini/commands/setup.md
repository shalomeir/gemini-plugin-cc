---
description: Check whether the local Gemini CLI is ready. TRIGGER only when user explicitly runs /gemini:setup or asks to "set up Gemini CLI". DO NOT TRIGGER when code or conversation merely mentions "gemini".
argument-hint: ''
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup --json "$ARGUMENTS"
```

If the result says Gemini is unavailable and npm is available:
- Use `AskUserQuestion` exactly once to ask whether Claude should install Gemini now.
- Put the install option first and suffix it with `(Recommended)`.
- Use these two options:
  - `Install Gemini CLI (Recommended)`
  - `Skip for now`
- If the user chooses install, run:

```bash
npm install -g @google/gemini-cli
```

- Then rerun:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" setup --json "$ARGUMENTS"
```

If Gemini is already installed but not authenticated:
- Tell the user to run `!gemini` interactively to log in.

If Gemini is installed and authenticated:
- Present the final setup output to the user.
