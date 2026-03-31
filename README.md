# gemini-plugin-cc

Use Gemini CLI from Claude Code to review code or delegate tasks — just like [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) does with OpenAI Codex.

## Features

- `/gemini:ask` — Ask Gemini a question or delegate a task
- `/gemini:review` — Run a Gemini code review against local git state
- `/gemini:setup` — Check Gemini CLI readiness and authentication
- `/gemini:status` — Show status of Gemini jobs
- `/gemini:result` — Show result of a completed job
- `/gemini:cancel` — Cancel a running job
- `/gemini:rescue` — Delegate the current task to Gemini for a second opinion

## Getting Started

### Prerequisites

- Node.js >= 18.18.0
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`npm install -g @google/gemini-cli`)
- [Claude Code](https://claude.ai/code)

### Installation

Install the plugin in Claude Code:

```bash
claude plugin add /path/to/gemini-plugin-cc
```

Or clone and install from GitHub:

```bash
git clone https://github.com/shalomeir/gemini-plugin-cc.git
claude plugin add ./gemini-plugin-cc
```

### Gemini CLI Setup

1. Install Gemini CLI:
```bash
npm install -g @google/gemini-cli
```

2. Authenticate (choose one):
```bash
# Option A: Interactive login (run in terminal)
gemini

# Option B: API key
export GEMINI_API_KEY=your-api-key
```

3. Verify in Claude Code:
```
/gemini:setup
```

## How It Works

This plugin spawns Gemini CLI in headless mode (`gemini -p "prompt" --output-format json`) to:
- Run code reviews against git diffs
- Delegate tasks for a second opinion
- Get Gemini's analysis on code questions

Unlike Codex's persistent app-server model, Gemini CLI uses a simpler invocation pattern — each request is a separate CLI call with JSON output.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Optional environment variables:
- `GEMINI_API_KEY` — Gemini API key (alternative to interactive login)
- `GOOGLE_API_KEY` — Google API key (for Vertex AI)

## Project Structure

```
gemini-plugin-cc/
├── .claude-plugin/          # Marketplace metadata
├── plugins/gemini/          # Plugin root
│   ├── .claude-plugin/      # Plugin metadata
│   ├── agents/              # Subagent definitions
│   ├── commands/            # Slash command definitions
│   ├── hooks/               # Session lifecycle hooks
│   ├── prompts/             # Prompt templates
│   ├── schemas/             # Output schemas
│   ├── scripts/             # Core runtime (Node.js ESM)
│   │   ├── gemini-companion.mjs
│   │   ├── session-lifecycle-hook.mjs
│   │   └── lib/             # Internal libraries
│   └── skills/              # Internal skill definitions
├── tests/                   # Test files
└── package.json
```

## License

MIT
