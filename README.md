# Gemini plugin for Claude Code

Use Gemini CLI from inside Claude Code for code reviews or to delegate tasks to Gemini.

This is an **unofficial, community-driven** adaptation of [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) for [Gemini CLI](https://github.com/google-gemini/gemini-cli). It is **NOT** an official Google product and is not affiliated with or endorsed by Google.

## What You Get

- `/gemini:review` for a Gemini-powered code review
- `/gemini:ask` to ask Gemini a question or delegate a task
- `/gemini:ui-review` to review UI screenshots against code implementation
- `/gemini:media` to analyze images, audio, and video files
- `/gemini:analyze` to analyze the codebase using Gemini's large context window (1M+ tokens)
- `/gemini:rescue`, `/gemini:status`, `/gemini:result`, and `/gemini:cancel` to delegate work and manage background jobs
- `/gemini:setup` to check Gemini CLI readiness and authentication

## Requirements

- **Gemini CLI access** — requires a [Google AI Studio API key](https://aistudio.google.com/apikey) or Google account login. Gemini CLI is available with a [Google One AI Premium subscription](https://one.google.com/explore-plan/gemini-advanced) or via API key.
- **Node.js 18.18 or later**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add shalomeir/gemini-plugin-cc
```

Install the plugin:

```bash
/plugin install gemini@google-gemini
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/gemini:setup
```

`/gemini:setup` will tell you whether Gemini CLI is ready. If Gemini CLI is missing and npm is available, it can offer to install it for you.

If you prefer to install Gemini CLI yourself, use:

```bash
npm install -g @google/gemini-cli
```

If Gemini CLI is installed but not authenticated yet, run:

```bash
!gemini
```

This launches the interactive Gemini CLI to complete authentication. Alternatively, set an API key:

```bash
export GEMINI_API_KEY=your-api-key
```

After install, you should see:

- the slash commands listed below
- the `gemini:gemini-rescue` subagent in `/agents`

One simple first run is:

```bash
/gemini:review --background
/gemini:status
/gemini:result
```

### Local development

For local development, you can load the plugin directly without the marketplace:

```bash
git clone https://github.com/shalomeir/gemini-plugin-cc.git
claude --plugin-dir ./gemini-plugin-cc
```

## Usage

### `/gemini:review`

Runs a Gemini-powered code review on your current work.

> [!NOTE]
> Code review for multi-file changes might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. It also supports `--wait` and `--background`.

Examples:

```bash
/gemini:review
/gemini:review --base main
/gemini:review --background
```

This command is read-only and will not perform any changes. When run in the background you can use [`/gemini:status`](#geministatus) to check on the progress and [`/gemini:cancel`](#geminicancel) to cancel the ongoing task.

### `/gemini:ask`

Delegates a question or task to Gemini.

Use it when you want Gemini to:

- investigate a bug
- analyze code or architecture
- get a second opinion on an approach
- run a task with a different AI perspective

It supports `--background` and `--wait`.

Examples:

```bash
/gemini:ask explain the authentication flow in this codebase
/gemini:ask --background investigate why the tests are flaky
/gemini:ask suggest improvements for the error handling in src/api/
```

### `/gemini:ui-review`

Reviews UI screenshots against the current code implementation using Gemini's native vision capabilities.

Use it when you want to:

- compare a design mockup or screenshot with your component code
- check visual accuracy, layout, typography, and accessibility
- review responsive breakpoints and cross-browser concerns

It supports `--background`.

Examples:

```bash
/gemini:ui-review @screenshot.png review the header component
/gemini:ui-review @design.png @current.png compare these two states
/gemini:ui-review --background @full-page.png review all components
```

### `/gemini:media`

Analyzes media files (images, audio, video, PDF) using Gemini's native multimodal capabilities.

Supported file types:

- **Images**: PNG, JPG, JPEG, GIF, WEBP
- **Audio**: MP3 (WAV is not supported)
- **Video**: MP4, MOV
- **Documents**: PDF

Use the `@file` syntax to reference files. Gemini processes media natively — no 3rd-party preprocessing (ffmpeg, whisper, etc.) is needed.

Examples:

```bash
/gemini:media @photo.jpg describe this image
/gemini:media @recording.mp3 transcribe and summarize this audio
/gemini:media @demo.mp4 describe what happens in this video
/gemini:media @document.pdf summarize this document
```

### `/gemini:analyze`

Analyzes the codebase or a subset of it using Gemini's large context window (1M+ tokens).

Use it when you want Gemini to:

- analyze overall architecture and patterns
- find dependencies and coupling between modules
- review code quality across the entire project
- understand a large codebase holistically

It supports `--scope <path>` and `--background`.

Examples:

```bash
/gemini:analyze what are the main architectural patterns?
/gemini:analyze --scope src/api review the API layer
/gemini:analyze --background find all circular dependencies
```

### `/gemini:rescue`

Hands the current task context to Gemini through the `gemini:gemini-rescue` subagent for a second opinion.

Use it when you want Gemini to:

- take a fresh look at what you're working on
- provide an alternative approach
- investigate something Claude is stuck on

Examples:

```bash
/gemini:rescue investigate why the tests started failing
/gemini:rescue suggest an alternative approach to this refactoring
```

### `/gemini:status`

Shows running and recent Gemini jobs for the current repository.

Examples:

```bash
/gemini:status
/gemini:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/gemini:result`

Shows the final stored Gemini output for a finished job.

Examples:

```bash
/gemini:result
/gemini:result task-abc123
```

### `/gemini:cancel`

Cancels an active background Gemini job.

Examples:

```bash
/gemini:cancel
/gemini:cancel task-abc123
```

### `/gemini:setup`

Checks whether Gemini CLI is installed and authenticated.
If Gemini CLI is missing and npm is available, it can offer to install it for you.

## Typical Flows

### Review Before Shipping

```bash
/gemini:review
```

### Get A Second Opinion

```bash
/gemini:ask is this the right approach for handling concurrent requests?
```

### Hand A Problem To Gemini

```bash
/gemini:ask investigate why the build is failing in CI
```

### Review UI Against Screenshots

```bash
/gemini:ui-review @screenshot.png check the login page matches the design
```

### Analyze Media Files

```bash
/gemini:media @recording.mp3 what topics are discussed?
/gemini:media @demo.mp4 summarize the user flow shown
```

### Deep Codebase Analysis

```bash
/gemini:analyze --background review the entire codebase architecture
/gemini:status
/gemini:result
```

### Start Something Long-Running

```bash
/gemini:review --background
/gemini:ask --background analyze the test coverage gaps
```

Then check in with:

```bash
/gemini:status
/gemini:result
```

## Gemini CLI Integration

This plugin wraps the [Gemini CLI](https://github.com/google-gemini/gemini-cli) in [headless mode](https://google-gemini.github.io/gemini-cli/docs/cli/headless.html). It uses the global `gemini` binary installed in your environment.

### Authentication

Gemini CLI supports multiple authentication methods:

1. **Google account login** (interactive): Run `gemini` once in your terminal to complete OAuth login
2. **API key**: Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable

Your authentication state is shared with your local Gemini CLI installation.

### Model Selection

Each command has a default model. You can override it with `--model` (`-m`):

```bash
/gemini:media -m gemini-2.5-pro @photo.jpg describe this image
/gemini:review -m gemini-3-flash-preview
```

| Command | Default Model | Notes |
|---------|--------------|-------|
| `/gemini:review` | Gemini CLI default (auto-routed) | Uses Gemini CLI's built-in model routing |
| `/gemini:ask` | Gemini CLI default (auto-routed) | Uses Gemini CLI's built-in model routing |
| `/gemini:ui-review` | `gemini-3-flash-preview` | Flash model for multimodal vision |
| `/gemini:media` | `gemini-3-flash-preview` | Flash model for image/audio/video |
| `/gemini:analyze` | Gemini CLI default (auto-routed) | Uses Gemini CLI's built-in model routing |

Commands without an explicit default rely on Gemini CLI's automatic model routing.

For multimodal commands (`ui-review`, `media`), the default model can be changed without editing code:

```bash
export GEMINI_MULTIMODAL_MODEL=gemini-3.5-flash  # use a newer flash model
```

Priority: `--model` flag > `GEMINI_MULTIMODAL_MODEL` env var > built-in default (`gemini-3-flash-preview`).

## Differences from codex-plugin-cc

This plugin closely mirrors the architecture and command structure of [codex-plugin-cc](https://github.com/openai/codex-plugin-cc), but there are key structural differences driven by how Gemini CLI works compared to Codex:

### No app-server or broker

Codex uses a persistent [app-server](https://developers.openai.com/codex/app-server/) with JSON-RPC over a Unix socket, managed by a broker process that starts on session init and shuts down on session end. Gemini CLI has no equivalent persistent server mode. Instead, this plugin uses **one-shot headless invocations** (`gemini -p "prompt" --output-format stream-json -y`) for each request. This is simpler but means there is no shared runtime between calls.

### No adversarial-review

Codex offers a separate `/codex:adversarial-review` command for steerable challenge reviews. This plugin uses a single `/gemini:review` command with a comprehensive review prompt. An adversarial mode could be added in the future.

### No review gate (Stop hook)

Codex can block Claude's response via a `Stop` hook if its review finds issues, creating a review-then-fix loop. This plugin does not implement a Stop hook because Gemini's headless mode is not optimized for the quick, targeted gate-style reviews this feature requires.

### Session resume

Codex maintains thread IDs so you can `codex resume <session-id>` to continue a previous task. Gemini CLI supports `gemini --resume <session-id>` for session continuity. This plugin captures session IDs from Gemini responses and stores them with job results — you can see them in `/gemini:result` output.

### `/gemini:ask` instead of `/codex:rescue`

Codex's rescue command delegates through a subagent with session continuity and model selection (`--model`, `--effort`, `--resume`, `--fresh`). This plugin's `/gemini:ask` is a simpler task delegation command. A separate `/gemini:rescue` exists as a subagent-based forwarder for context-heavy delegation.

### Stream-JSON instead of JSON-RPC

Codex streams responses through a JSON-RPC socket connection. Gemini CLI uses [NDJSON streaming](https://google-gemini.github.io/gemini-cli/docs/cli/headless.html) (`--output-format stream-json`) with line-delimited JSON events. The event protocol is different but the user experience is similar.

### Simplified internals

Because Gemini CLI is one-shot with no persistent runtime, several codex-plugin-cc patterns were intentionally simplified:

- **No session tracking**: Codex groups jobs by session ID for lifecycle management. Since Gemini CLI has no sessions, this plugin skips session IDs entirely — on session end, all running jobs are terminated unconditionally.
- **No status polling**: Codex's `/codex:status --wait` polls for completion. Since there is no persistent process to poll, `/gemini:status` returns the current snapshot immediately.
- **Reduced job history**: Codex keeps 50 jobs; this plugin keeps 10. One-shot invocations accumulate history quickly with less value.
- **No state versioning or config store**: Codex prepares for schema migration and per-project config. This plugin's state is just a flat job list — simple enough that versioning adds no value.
- **Lighter progress tracking**: Phase updates go to the state index only, not double-written to individual job files on every event. Final state is written once on completion.

The background task execution pattern (`--background` with detached workers) is retained — it is genuinely useful for long-running operations like code reviews.

## Environment Setup

Optional environment variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Gemini API key (alternative to interactive login) |
| `GOOGLE_API_KEY` | Google API key (for Vertex AI) |
| `GEMINI_MULTIMODAL_MODEL` | Default model for multimodal commands (`ui-review`, `media`). Defaults to `gemini-3-flash-preview` |

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

## FAQ

### Do I need a separate Google account for this plugin?

If you have already authenticated with Gemini CLI on this machine, that authentication works immediately. This plugin uses your local Gemini CLI authentication state.

If you haven't used Gemini CLI yet, you'll need either a Google account or a [Google AI Studio API key](https://aistudio.google.com/apikey). Run `/gemini:setup` to check readiness, and use `!gemini` for interactive login if needed.

### Does the plugin use a separate Gemini runtime?

No. This plugin delegates through your local [Gemini CLI](https://github.com/google-gemini/gemini-cli) installation.

That means:

- it uses the same Gemini CLI install you would use directly
- it uses the same local authentication state
- it uses the same repository checkout and machine-local environment

### Is this an official Google plugin?

**No.** This is an unofficial, community-driven project. It is an adaptation of OpenAI's [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) for Gemini CLI. It is not affiliated with, endorsed by, or supported by Google.

### Where can I get Gemini CLI?

Install via npm:

```bash
npm install -g @google/gemini-cli
```

For more information, see the [Gemini CLI repository](https://github.com/google-gemini/gemini-cli) and the [headless mode documentation](https://google-gemini.github.io/gemini-cli/docs/cli/headless.html).

## Credits

This project is heavily inspired by and structurally based on [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) by OpenAI. The command structure, plugin architecture, and background job management patterns are adapted from that project.

## License

MIT
