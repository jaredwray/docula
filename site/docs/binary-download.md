---
title: Binary Download
order: 21
---

# Binary Download

Docula publishes standalone binaries — a single executable file containing both Node.js and docula itself — for Linux, macOS (x64 and arm64), and Windows. Binaries are produced by the [`build-binaries` GitHub Actions workflow](https://github.com/jaredwray/docula/actions/workflows/build-binaries.yaml) and attached to each release.

Use a binary when you want to run docula without installing Node.js or pnpm/npm — for example, on a minimal CI image or a machine where you can't add a global npm dependency.

## Download

Grab the artifact matching your platform from the [latest release](https://github.com/jaredwray/docula/releases/latest):

| Platform | Artifact |
|----------|----------|
| Linux x64 | `docula-linux-x64` |
| macOS arm64 (Apple Silicon) | `docula-macos-arm64` |
| Windows x64 | `docula-windows-x64.exe` |

On macOS and Linux, mark the file as executable after downloading:

```bash
chmod +x docula-linux-x64
./docula-linux-x64 version
```

## JSON Config Only

The standalone binary loads configuration from **`docula.config.json`** only. TypeScript (`.ts`) and ESM JavaScript (`.mjs`) config files are not supported when running the binary; if one is present and no `docula.config.json` exists, the binary exits with an error explaining the limitation.

This restriction is intentional. Node.js's single-executable-application runtime can't dynamic-import file URLs, which is how `.ts` and `.mjs` configs are loaded under regular Node. Rather than ship a fragile transpiler inside the binary, the SEA path only reads JSON — which is data, not code.

The practical consequence: **no lifecycle hooks** (`onPrepare`, etc.) in the binary. JSON can't carry functions. If you need `onPrepare`, run docula from Node.js with a `.ts` or `.mjs` config instead.

### Example

`docula.config.json` at the root of your site directory:

```json
{
  "githubPath": "your-username/your-repo",
  "siteTitle": "My Project",
  "siteDescription": "Project description",
  "siteUrl": "https://your-site.com",
  "themeMode": "light",
  "template": "modern"
}
```

The top-level object is the options bag — the same shape as the `options` export in a `.ts`/`.mjs` config. Every field documented on the [Configuration page](./configuration) is supported, except for the function fields like `onPrepare`.

Then build:

```bash
./docula-linux-x64 build -s ./site -o ./dist
```

## Using JSON Outside the Binary

`docula.config.json` is supported under regular Node too. It's checked after `docula.config.ts` and `docula.config.mjs`, so if you have both a `.ts` and a `.json` file in the same site directory, the `.ts` config wins.

This means you can author one `docula.config.json` and use it from both:

- The standalone binary (only `.json` is read)
- A Node-installed docula (`.ts`/`.mjs` take priority if present, otherwise `.json` is used)

## When to Use Which

| Scenario | Recommended config |
|----------|-------------------|
| Standalone binary | `docula.config.json` (required) |
| Node.js project with type checking | `docula.config.ts` |
| Node.js project without TypeScript | `docula.config.mjs` |
| Plain data, no hooks, run anywhere | `docula.config.json` |
