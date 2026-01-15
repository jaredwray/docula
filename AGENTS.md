# AGENTS.md

Guidelines for AI coding agents (Claude, Gemini, Codex).

## Project

Docula is a documentation/website generator built with TypeScript and Node.js (>=20).

## Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Build the project
- `pnpm test` - Run linter and tests with coverage

**Use pnpm, not npm.**

## Development Rules

1. **Always run `pnpm test` before committing** - All tests must pass
2. **Maintain 100% code coverage** - Add tests for any new code
3. **Follow existing code style** - Biome enforces formatting and linting

## Structure

- `src/` - TypeScript source code
- `test/` - Test files (Vitest)
- `template/` - Handlebars templates
