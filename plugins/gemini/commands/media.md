---
description: Analyze image, audio, or video files with Gemini CLI. TRIGGER when user explicitly runs /gemini:media or asks to "use Gemini CLI for media analysis". DO NOT TRIGGER when code or conversation merely mentions "gemini".
argument-hint: '<@file.png|mp3|mp4> [question or instruction]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Analyze media files (images, audio, video) using Gemini's native multimodal capabilities.

Raw slash-command arguments:
`$ARGUMENTS`

Supported file types:
- Images: PNG, JPG, JPEG, GIF, WEBP
- Audio: MP3 (WAV is not supported by the API)
- Video: MP4, MOV
- Documents: PDF

Foreground flow:
- Run with a 5-minute timeout to allow for large media file analysis:
```bash
timeout 300 node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" media "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase or add commentary.
