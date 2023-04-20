<img src="branding-guidelines/Docula Logos/PNG/Color/docula.png" />

# Docula

[![tests](https://github.com/jaredwray/docula/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/docula/actions/workflows/tests.yaml)
[![codecov](https://codecov.io/github/jaredwray/docula/branch/main/graph/badge.svg?token=RS0GPY4V4M)](https://codecov.io/github/jaredwray/docula)
[![release](https://github.com/jaredwray/docula/actions/workflows/release.yaml/badge.svg)](https://github.com/jaredwray/docula/actions/workflows/release.yaml)
[![npm](https://img.shields.io/npm/dm/docula.svg)](https://www.npmjs.com/package/docula)
[![npm](https://img.shields.io/npm/v/docula.svg)](https://www.npmjs.com/package/docula)

## Features

- Zero Config - Just drop it in and it works
- Can run from `npx` or installed globally
- Knowledge Base that is easy to setup and manage
- Beautiful and Responsive Design (Like Stripe or 11ty)
- Search Engine Optimized
- Search Engine Plugin (Algolia) and local search by default.
- Convention over Configuration - just add your files, use a template (or build your own) and you're done.
- Will generate a sitemap.xml
- Will generate a robots.txt
- Will generate a release based on Github Releases
- Generatses an RSS feed.xml file to use and share 

## Site Structure

- `site/docs` - contains the documentation files
- `site/template` - contains the templates files

This will all be generated in the `dist` folder by default. To change that you can use the `--output=<folder_name>` flag.

### Github Integration
- Pull all of your Contributors and Display Them
- Pulls your release notes and puts it into a good looking data format for your templates
- Pulls your project stats based on Github Forks, Stars, and Watchers
## How the CLI should work
To create a new project it should be as simple as:
```bash
docula init <project-name>
```

This will actually do all the scaffolding for the site setting up the package.json, the config file, and the templates. It will also install the default template.

To build the site just do:
```bash
docula <path optional>
```

To build the site and watch for changes:
```bash
docula <path optional> --serve --watch --port=8081
```
