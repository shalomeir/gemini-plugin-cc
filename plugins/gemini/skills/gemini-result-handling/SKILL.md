---
name: gemini-result-handling
description: Guidelines for presenting Gemini CLI results to the user
user-invocable: false
---

# Gemini Result Handling

## Rendering Rules

1. **Verbatim output**: Always present Gemini's response verbatim. Do not paraphrase, summarize, or restructure.
2. **Preserve formatting**: Keep file paths, line numbers, severity labels, and markdown formatting exactly as returned.
3. **No auto-fix**: Never automatically fix issues found in a review. The user must explicitly request fixes.
4. **Error transparency**: If Gemini returns an error, show the full error message including stderr.

## Review Results

- Present findings in severity order (critical → high → medium → low)
- Preserve file path and line number references
- Include the overall verdict prominently
- Show stats (model, tokens) if available

## Task Results

- Return the full response text
- If the task produced structured output, format it appropriately
- Suggest follow-up actions based on the result content
