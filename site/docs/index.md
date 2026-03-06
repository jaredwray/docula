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
├───site.css
├───logo.png
├───favicon.ico
├───README.md
├───docula.config.mjs
```

Note: for typescript do `docula init --typescript`

## Add your content

Simply replace the logo, favicon, and css file with your own. The readme is your root project readme and you just need to at build time move it over to the site folder. If you have it at the root of the project and this is a folder inside just delete the README.md file in the site folder and docula will copy it over for you automatically.

## Build your site

> npx docula

This will build your site and place it in the `dist` folder. You can then host it anywhere you like.
