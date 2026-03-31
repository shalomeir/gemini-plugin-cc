# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Gemini, etc.) when working with this repository.

## Project Overview

- **Project**: gemini-plugin-cc
- **Description**: TBD
- **Language**: TBD

## Coding Standards

### General Rules
- Write correct, up-to-date, bug-free, secure, and performant code
- Focus on readability over clever optimizations
- Fully implement all requested functionality — no TODOs or placeholders
- Use UTF-8 encoding, add a blank line at the end of every file

### Naming Conventions
- Variables / Functions: camelCase
- Classes / Types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case

### Comments
- Explain the "why", not the "what"
- Write documentation comments for all public APIs

## Git Conventions

### Commit Messages
```
<type>(<scope>): <subject>
```
- type: feat, fix, docs, style, refactor, test, chore
- scope: changed component or module
- subject: summary in 50 chars or less

### Branch Strategy
- `main` — production (protected, PR required)
- `develop` — development (default branch)
- `feature/*` — new features
- `bugfix/*` — bug fixes
- `release/*` — release preparation

## Security
- Never commit secrets, tokens, or API keys
- Use environment variables for all sensitive configuration
- Keep `.env.example` updated with required variable names (no values)

## Testing
- Prefer running single tests over full test suite during development
- Tests must be independent and generate their own test data
