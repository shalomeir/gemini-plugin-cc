---
name: gemini-cli-runtime
description: Internal skill for running Gemini CLI commands via the companion script
user-invocable: false
---

# Gemini CLI Runtime

The Gemini companion script (`gemini-companion.mjs`) is the only way to interact with Gemini CLI from this plugin.

## Invocation

All Gemini operations go through a single script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" <subcommand> [options]
```

## Subcommands

- `setup` — check readiness and authentication
- `review` — run a code review against git state
- `task` — run a freeform task (question, delegation, analysis)
- `status` — show job status
- `result` — show completed job result
- `cancel` — cancel an active job

## Key Rules

1. Never call `gemini` directly — always use the companion script
2. The companion script manages job tracking, progress logging, and state
3. Background tasks are handled via detached worker processes
4. All output should be returned verbatim to the user
