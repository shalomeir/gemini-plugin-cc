# Gemini plugin for Claude Code

Use Gemini CLI from inside Claude Code to analyze codebases, process media files, run code reviews, or delegate tasks to Gemini.

This is an **unofficial, community-driven** adaptation of [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) for [Gemini CLI](https://github.com/google-gemini/gemini-cli). It is **NOT** an official Google product and is not affiliated with or endorsed by Google.

## What You Get

- `/gemini:analyze` to analyze the codebase using Gemini's large context window (1M+ tokens)
- `/gemini:media` to analyze images, audio, and video files
- `/gemini:ui-review` to review UI screenshots against code implementation
- `/gemini:review` for a Gemini-powered code review
- `/gemini:ask` to ask Gemini a question or delegate a task
- `/gemini:rescue`, `/gemini:status`, `/gemini:result`, and `/gemini:cancel` to delegate work and manage background jobs
- `/gemini:setup` to check Gemini CLI readiness and authentication

## Requirements

- **Gemini CLI access** — requires a [Google AI Studio API key](https://aistudio.google.com/apikey) or Google account login. Gemini CLI is available with a [Google One AI Premium subscription](https://one.google.com/explore-plan/gemini-advanced) or via API key.
- **Node.js 18.18 or later**

## Install

### Via marketplace

```bash
/plugin marketplace add shalomeir/gemini-plugin-cc
/plugin install gemini@google-gemini
/reload-plugins
```

### From a Git URL (without the default marketplace)

You can point to any Git repository or local path as a marketplace source:

```bash
/plugin marketplace add https://github.com/shalomeir/gemini-plugin-cc.git
/plugin install gemini@shalomeir-gemini-plugin-cc
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
/gemini:analyze what are the main patterns in this codebase?
```

### Local development

For local development, you can load the plugin directly without the marketplace:

```bash
git clone https://github.com/shalomeir/gemini-plugin-cc.git
claude --plugin-dir ./gemini-plugin-cc
```

## Usage

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

### Deep Codebase Analysis

```bash
/gemini:analyze --background review the entire codebase architecture
/gemini:status
/gemini:result
```

### Analyze Media Files

```bash
/gemini:media @recording.mp3 what topics are discussed?
/gemini:media @demo.mp4 summarize the user flow shown
```

### Review UI Against Screenshots

```bash
/gemini:ui-review @screenshot.png check the login page matches the design
```

### Review Before Shipping

```bash
/gemini:review
```

### Get A Second Opinion

```bash
/gemini:ask is this the right approach for handling concurrent requests?
```

### Start Something Long-Running

```bash
/gemini:analyze --background review the entire codebase
/gemini:review --background
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
| `/gemini:analyze` | Gemini CLI default (auto-routed) | Uses Gemini CLI's built-in model routing |
| `/gemini:media` | `gemini-3-flash-preview` | Flash model for image/audio/video |
| `/gemini:ui-review` | `gemini-3-flash-preview` | Flash model for multimodal vision |
| `/gemini:review` | Gemini CLI default (auto-routed) | Uses Gemini CLI's built-in model routing |
| `/gemini:ask` | Gemini CLI default (auto-routed) | Uses Gemini CLI's built-in model routing |

For multimodal commands (`ui-review`, `media`), the default model can be changed via environment variable:

```bash
export GEMINI_MULTIMODAL_MODEL=gemini-3.5-flash
```

Priority: `--model` flag > `GEMINI_MULTIMODAL_MODEL` env var > built-in default.

## FAQ

### Do I need a separate Google account for this plugin?

If you have already authenticated with Gemini CLI on this machine, that authentication works immediately. Run `/gemini:setup` to check readiness, and use `!gemini` for interactive login if needed.

### Does the plugin use a separate Gemini runtime?

No. This plugin delegates through your local [Gemini CLI](https://github.com/google-gemini/gemini-cli) installation. It uses the same install, authentication state, and machine-local environment.

### Is this an official Google plugin?

**No.** This is an unofficial, community-driven project adapted from [codex-plugin-cc](https://github.com/openai/codex-plugin-cc). It is not affiliated with or endorsed by Google.

## Credits

This project is heavily inspired by and structurally based on [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) by OpenAI.

## License

MIT
