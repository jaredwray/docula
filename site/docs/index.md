---
title: Getting Started
order: 1
---

# Getting Started

## Install docula via init

> npx docula init

This will create a folder called site with the following structure:

```
site
├───logo.png
├───favicon.ico
├───README.md
├───docula.config.mjs
```

If your project has a `tsconfig.json`, docula will automatically generate a TypeScript config (`docula.config.ts`). To explicitly choose, use `docula init --typescript` or `docula init --javascript`.

## Add your content

Simply replace the logo, favicon, and css file with your own. For the README, docula will automatically read your project root `README.md` at build time and render it as the home page — no copying required. If you want to use a different README just for the site, place one in the site folder and docula will use that instead. This behavior is controlled by the `autoReadme` option (enabled by default).

## Build your site

> npx docula

This will build your site and place it in the `dist` folder. You can then host it anywhere you like.

## Single Page vs Multi Page

Docula supports two modes for organizing your site content:

### Single Page

By default, if no `docs/` folder exists in your site directory, Docula renders a single home page using your `README.md` as the content. This is the simplest setup — no extra configuration needed.

```
site
├───logo.png
├───favicon.ico
├───variables.css
├───README.md
└───docula.config.mjs
```

### Multi Page

To build a site with multiple documentation pages, add a `docs/` folder to your site directory. Docula automatically detects the folder and generates individual pages with sidebar navigation.

```
site
├───logo.png
├───favicon.ico
├───variables.css
├───docula.config.mjs
└───docs
    ├───index.md
    ├───configuration.md
    └───guides
        ├───getting-started.md
        └───advanced.md
```

Each markdown file becomes its own page. Use front matter to control the title and ordering:

```md
---
title: Configuration
order: 2
---
```

Subdirectories inside `docs/` automatically become sections in the sidebar navigation.

### Automatic Starting View

Docula automatically detects what content exists and picks the starting view for your site:

- **README.md exists** — A dedicated landing page renders at `/` using `home.hbs`, and docs are available at `/docs/`. Docula looks for a `README.md` in your site folder first, then falls back to your project root `README.md` via the `autoReadme` option. When using `autoReadme`, the leading `# Title` heading is automatically stripped from the rendered page to avoid duplicating the site title.
- **No README.md, but docs exist** — The first doc page renders directly as `/index.html`.
- **No README.md, no docs, but `api/swagger.json` exists** — The API page renders as `/index.html`.
