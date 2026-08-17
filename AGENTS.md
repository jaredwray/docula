# AGENTS.md

Guidelines for AI coding agents (Claude, Gemini, Codex).

## Project

Docula is a documentation/website generator built with TypeScript and Node.js (>=22).

## Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Build the project
- `pnpm test` - Run linter and tests with coverage
- `pnpm test:binary` - Smoke-test a standalone binary (`dist/docula` or `DOCULA_BINARY`)

**Use pnpm, not npm.**

## Development Rules

1. **Always run `pnpm test` before committing** - All tests must pass
2. **Maintain 100% code coverage** - Add tests for any new code
3. **Follow existing code style** - Biome enforces formatting and linting

## Structure

- `src/` - TypeScript source code
- `test/` - Test files (Vitest)
- `template/` - Handlebars templates

## Safe Chain

Package installs in this environment go through Aikido Safe Chain shims. Never bypass them:

- Keep `~/.safe-chain/shims` first on `PATH`.
- Do not call unshimmed `npm`, `pnpm`, `npx`, or `pnpx`.
- Do not install packages with `curl | sh` or by pointing at a package manager outside the shim directory.
