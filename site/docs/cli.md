---
title: Using the CLI
order: 2
---

# Using the CLI

Docula provides a command-line interface for initializing, building, and serving your documentation site. All commands are available via `npx docula` or, if installed globally, just `docula`.

## Commands Overview

| Command | Description |
|---------|-------------|
| `init` | Initialize a new Docula project |
| `build` | Build the site (default if no command is specified) |
| `serve` | Serve the site locally |
| `start` | Build, watch, and serve the site |
| `help` | Print help information |
| `version` | Print the version number |

## init

Scaffolds a new Docula project in the current directory. Creates a `site/` folder with starter files including a logo, favicon, CSS, README, and config file.

```bash
npx docula init
```

By default, docula auto-detects whether your project uses TypeScript by checking for a `tsconfig.json` in the current directory. If found, it generates `docula.config.ts`; otherwise, it generates `docula.config.mjs`. You can override this with the `--typescript` or `--javascript` flags.

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--typescript` | Force a TypeScript config file (`docula.config.ts`) | auto-detect |
| `--javascript` | Force a JavaScript config file (`docula.config.mjs`) | auto-detect |
| `-s, --site <path>` | Set the path where site files will be created | `./site` |

### Examples

```bash
# Initialize (auto-detects TypeScript from tsconfig.json)
npx docula init

# Force TypeScript config
npx docula init --typescript

# Force JavaScript config
npx docula init --javascript

# Initialize in a custom directory
npx docula init -s ./docs-site
```

## build

Builds your site and outputs the result to the configured output directory. This is the default command — running `npx docula` without a subcommand is equivalent to `npx docula build`.

```bash
npx docula build
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --site <path>` | Set the path where site files are located | `./site` |
| `-o, --output <path>` | Set the output directory | `./site/dist` |
| `-t, --templatePath <path>` | Set a custom template directory path | - |
| `-T, --template <name>` | Set the built-in template name (e.g., `modern`) | `modern` |
| `-w, --watch` | Watch for file changes and rebuild automatically | `false` |
| `-c, --clean` | Clean the output directory before building | `false` |

### Examples

```bash
# Build with defaults
npx docula

# Build with a custom site path and output directory
npx docula build -s ./my-site -o ./my-site/dist

# Build with a custom template
npx docula build --template classic

# Clean build
npx docula build --clean
```

## serve

Starts a local development server for your site. By default it listens on port 3000 and serves the existing output directory without running a build. Use `--build` to run a one-time build before serving, or `--watch` to build first and then automatically rebuild on file changes.

```bash
npx docula serve
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port <number>` | Set the port number | `3000` |
| `-s, --site <path>` | Set the path where site files are located | `./site` |
| `-o, --output <path>` | Set the output directory | `./site/dist` |
| `-b, --build` | Build the site before serving | `false` |
| `-w, --watch` | Build the site, then watch for file changes and rebuild automatically | `false` |
| `-c, --clean` | Clean the output directory before building (only applies with `--build` or `--watch`) | `false` |

### Examples

```bash
# Serve the existing build on default port 3000
npx docula serve

# Serve on a custom port
npx docula serve -p 8080

# Build once and serve
npx docula serve --build

# Build, serve, and watch for changes
npx docula serve --watch

# Clean build, serve, and watch for changes
npx docula serve --clean --watch
```

## start

Builds the site, starts a file watcher, and serves it locally — all in one command. This is the recommended way to develop with Docula, equivalent to running `docula serve --build --watch`.

```bash
npx docula start
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port <number>` | Set the port number | `3000` |
| `-s, --site <path>` | Set the path where site files are located | `./site` |
| `-o, --output <path>` | Set the output directory | `./site/dist` |
| `-c, --clean` | Clean the output directory before building | `false` |

### Examples

```bash
# Build, watch, and serve on default port 3000
npx docula start

# Start on a custom port
npx docula start -p 8080

# Clean build, then watch and serve
npx docula start --clean

# Custom site path
npx docula start -s ./my-site
```

## Watch Mode

Use the `--watch` flag with either `build` or `serve` to automatically rebuild your site when files change:

```bash
npx docula serve --watch
```

When watch mode is enabled:

1. An initial build runs at startup
2. The dev server starts and serves your site (when using `serve`)
3. File changes in the site directory (e.g., `./site`) are detected and trigger an automatic rebuild
4. Changes in the output directory are ignored to prevent rebuild loops

This is useful during development when you want to see changes reflected immediately without manually re-running the build.

## Common Workflows

```bash
# Quick start: scaffold and serve (auto-detects TypeScript)
npx docula init
npx docula start

# Production build
npx docula build --clean

# Force TypeScript config
npx docula init --typescript
npx docula start

# Custom paths
npx docula build -s ./website -o ./website/dist
```
