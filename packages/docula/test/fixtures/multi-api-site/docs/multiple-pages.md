---
title: Multiple Pages
order: 5
---

# Building Multiple Pages

If you want to build multiple pages you can easily do that by adding in a `docs` folder to the root of the site folder. Inside of that folder you can add as many pages as you like. Each page will be a markdown file and it will generate a table of contents for you. Here is an example of what it looks like:

```
site
├───site.css
├───logo.png
├───favicon.ico
├───docula.config.mjs
├───docs
│   ├───getting-started.md
│   ├───contributing.md
│   ├───license.md
│   ├───code-of-conduct.md
```

Files in the `docs` directory become documentation pages. An `index.md` file inside `docs` will serve as the main page for the documentation section (e.g., at `/docs/`). The rest of the files will be added to the navigation. If you want to control the title or order of the pages you can do so by setting the `title` and `order` properties in the front matter of each markdown file. Here is an example:

```md
title: Getting Started
order: 2
```

If you want your docs to be the root home page (`/`) instead of the template landing page, simply remove the `README.md` file from your site directory. Docula will automatically use the first doc as `/index.html`.
