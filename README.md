![Docula](site/logo.svg)

# Beautiful Website for Your Projects

[![tests](https://github.com/jaredwray/docula/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/docula/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/docula)](https://github.com/jaredwray/docula/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/docula/branch/main/graph/badge.svg?token=RS0GPY4V4M)](https://codecov.io/gh/jaredwray/docula)
[![npm](https://img.shields.io/npm/dm/docula)](https://npmjs.com/package/docula)
[![npm](https://img.shields.io/npm/v/docula)](https://npmjs.com/package/docula)

# Features
* No configuration required. Just setup the folder structure with a logo, favicon, and css file.
* Builds a static website that can be hosted anywhere.
* Simple search is provided by default out of the box.
* Support for single page with readme or multiple markdown pages in a docs folder.
* Full TypeScript support with typed configuration and IDE autocompletion.
* For more complex projects easily add a `docula.config.ts` (TypeScript) or `docula.config.mjs` (JavaScript) file to customize the build process with lifecycle hooks and `DoculaConsole` logging.
* Will generate a sitemap.xml, robots.txt, and `feed.xml` for your site.
* Automatically generates `llms.txt` and `llms-full.txt` for LLM-friendly indexing of docs, API reference, and changelog content.
* OpenAPI / Swagger support for auto-generating an interactive API reference page.
* Uses Github release notes and file-based changelog entries to generate a changelog with individual pages, pagination, and preview text.
* Uses Github to show contributors and link to their profiles.
* Light, dark, and system theme modes with a built-in toggle.
* Easy styling customization via `variables.css` with no template editing required.
* Watch mode with auto-rebuild for local development.

# Table of Contents
- [Getting Started](https://docula.org/docs/index)
- [Configuration](https://docula.org/docs/configuration)
- [CLI](https://docula.org/docs/cli)
- [Templates](https://docula.org/docs/templates)
- [Partial Templates](https://docula.org/docs/partial-templates)
- [Multiple Pages](https://docula.org/docs/multiple-pages)
- [Assets](https://docula.org/docs/assets)
- [Styling](https://docula.org/docs/styling)
- [API Reference](https://docula.org/docs/api-reference)
- [LLM Files](https://docula.org/docs/llm-files)
- [Announcements](https://docula.org/docs/using-announcements)
- [Changelog](https://docula.org/docs/changelog)
- [GitHub Integration](https://docula.org/docs/github-integration)
- [GitHub Token](https://docula.org/docs/github-token)
- [Helper Utilities](https://docula.org/docs/helper-utilities)
- [Header Links](https://docula.org/docs/header-links)
- [Caching](https://docula.org/docs/caching)
- [Cookie Auth](https://docula.org/docs/cookie-auth)
- [Robots & Sitemap](https://docula.org/docs/robots-and-sitemap)
- [Open Source Examples](#open-source-examples)
- [Code of Conduct and Contributing](#code-of-conduct-and-contributing)
- [License - MIT](#license)

# Open Source Examples

See Docula in action with these open source projects that use it for their documentation:

* **[Cacheable.org](https://cacheable.org)** - High-performance caching library for Node.js with layered caching support ([Source](https://github.com/jaredwray/cacheable))
* **[Keyv.org](https://keyv.org)** - Simple key-value storage with support for multiple backends ([Source](https://github.com/jaredwray/keyv))
* **[Docula.org](https://docula.org)** - Docula's own documentation site, built with Docula ([Source](https://github.com/jaredwray/docula))

# Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

# License
MIT © [Jared Wray](https://jaredwray.com)
