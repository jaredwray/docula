# AGENTS.md

Guidelines for AI coding agents (Claude, Gemini, Codex).

## Project

Docula is a documentation/website generator built with TypeScript and Node.js (>=22).

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

This is a pnpm monorepo. Run commands from the root, or scope them to a package
with `pnpm --filter <name> <script>` (e.g. `pnpm --filter @docula/fastify test:unit`).

- `packages/docula/` - The core `docula` package (CLI + library)
  - `src/` - TypeScript source code
  - `test/` - Test files (Vitest)
  - `templates/` - Handlebars templates
- `packages/fastify/` - The `@docula/fastify` Fastify plugin
- `site/` - Docula's own documentation site (built with docula)
