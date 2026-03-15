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

Simply replace the logo, favicon, and css file with your own. The readme is your root project readme and you just need to at build time move it over to the site folder. If you have it at the root of the project and this is a folder inside just delete the README.md file in the site folder and docula will copy it over for you automatically.

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

- **README.md exists** — A dedicated landing page renders at `/` using `home.hbs`, and docs are available at `/docs/`.
- **No README.md, but docs exist** — The first doc page renders directly as `/index.html`.
- **No README.md, no docs, but `api/swagger.json` exists** — The API page renders as `/index.html`.
