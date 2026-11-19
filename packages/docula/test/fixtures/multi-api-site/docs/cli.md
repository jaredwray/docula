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
| `dev` | Build, watch, and serve the project |
| `start` | Build and serve the project |
| `serve` | Serve the site locally |
| `help` / `--help` / `-h` | Print help information |
| `version` | Print the version number |
| `download` | Download template files to your site directory |

## Common Options

These options are shared across multiple commands:

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --site <path>` | Set the path where site files are located | `./site` |
| `-c, --clean` | Clean the output directory before building | `false` |
| `-o, --output <path>` | Set the output directory | `./site/dist` |
| `-p, --port <number>` | Set the port number | `3000` |
| `-w, --watch` | Watch for file changes and rebuild automatically | `false` |

## help

Print usage information. Available as a subcommand or flag:

```bash
npx docula help
npx docula --help
npx docula -h
```

## init

Scaffolds a new Docula project in the current directory. Creates a `site/` folder with starter files including a logo, favicon, CSS, README, and config file.

```bash
npx docula init
```

By default, docula auto-detects whether your project uses TypeScript by checking for a `tsconfig.json` in the current directory. If found, it generates `docula.config.ts`; otherwise, it generates `docula.config.mjs`. You can override this with the `--typescript` or `--javascript` flags.

### Flags

In addition to the [Common Options](#common-options):

| Flag | Description | Default |
|------|-------------|---------|
| `--typescript` | Force a TypeScript config file (`docula.config.ts`) | auto-detect |
| `--javascript` | Force a JavaScript config file (`docula.config.mjs`) | auto-detect |

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

## download

Downloads template files from the active template into your site directory. Use one of the subcommands below to choose what to download. If a target file or directory already exists, the command prints an error and exits. Use `--overwrite` to replace it.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `variables` | Copy `variables.css` to `site/variables.css` |
| `template` | Copy the full template to `site/templates/<name>/` |

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--overwrite` | Overwrite existing files if they already exist | `false` |

### Examples

```bash
# Copy variables.css for the current (modern) template
npx docula download variables

# Copy variables.css in a custom site directory
npx docula download variables -s ./my-site

# Overwrite an existing variables.css
npx docula download variables --overwrite

# Copy the full modern template to site/templates/modern/
npx docula download template

# Copy the classic template
npx docula download template --template classic

# Overwrite an existing template copy
npx docula download template --overwrite
```

## build

Builds your site and outputs the result to the configured output directory. This is the default command — running `npx docula` without a subcommand is equivalent to `npx docula build`.

```bash
npx docula build
```

### Flags

In addition to the [Common Options](#common-options):

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --templatePath <path>` | Set a custom template directory path | - |
| `-T, --template <name>` | Set the built-in template name (e.g., `modern`) | `modern` |

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

## dev

Builds your site, starts watching for file changes, and serves it locally — all in one command. This is the recommended way to develop locally.

```bash
npx docula dev
```

### Flags

In addition to the [Common Options](#common-options):

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --templatePath <path>` | Set a custom template directory path | - |
| `-T, --template <name>` | Set the built-in template name (e.g., `modern`) | `modern` |

### Examples

```bash
# Build, watch, and serve on default port 3000
npx docula dev

# Serve on a custom port
npx docula dev -p 8080

# Clean build, watch, and serve
npx docula dev --clean
```

## start

Builds the site and serves it locally. By default it does not watch for file changes, but you can pass `--watch` to enable live rebuilds.

```bash
npx docula start
```

All flags for `start` are covered by the [Common Options](#common-options).

### Examples

```bash
# Build and serve on default port 3000
npx docula start

# Build and serve on a custom port
npx docula start -p 8080

# Clean build and serve
npx docula start --clean

# Build, serve, and watch for changes
npx docula start --watch
```

## serve

Starts a local development server for your site. By default it listens on port 3000 and serves the existing output directory without running a build. Use `--build` to run a one-time build before serving, or `--watch` to build first and then automatically rebuild on file changes.

```bash
npx docula serve
```

### Flags

In addition to the [Common Options](#common-options):

| Flag | Description | Default |
|------|-------------|---------|
| `-b, --build` | Build the site before serving | `false` |

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
# Quick start: scaffold and develop (auto-detects TypeScript)
npx docula init
npx docula download variables
npx docula dev

# Production build
npx docula build --clean

# Force TypeScript config
npx docula init --typescript
npx docula dev

# Custom paths
npx docula build -s ./website -o ./website/dist
```
