![Docula](site/logo.svg)

# Beautiful Website for Your Projects

[![tests](https://github.com/jaredwray/docula/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/docula/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/docula)](https://github.com/jaredwray/docula/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/docula/graph/badge.svg?token=RS0GPY4V4M)](https://codecov.io/gh/jaredwray/docula)
[![npm](https://img.shields.io/npm/dm/docula)](https://npmjs.com/package/docula)
[![npm](https://img.shields.io/npm/v/docula)](https://npmjs.com/package/docula)

# Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
- [Using Your own Template](#using-your-own-template)
- [Building Multiple Pages](#building-multiple-pages)
- [Using a Github Token](#using-a-github-token)
- [Helper Functions for Markdown](#helper-functions-for-markdown)
- [Code of Conduct and Contributing](#code-of-conduct-and-contributing)
- [License - MIT](#license)

# Features
* No configuration requrired. Just setup the folder structure with a logo, favicon, and css file. 
* Builds a static website that can be hosted anywhere.
* For more complex projects easily add a `docula.config.mjs` file to customize the build process. With PRE and POST methods. 
* Support for single page with readme or multiple markdown pages in a docs folder.
* Will generate a sitemap.xml and robots.txt for your site.
* Uses Github release notes to generate a changelog / releases page.
* Uses Github to show contributors and link to their profiles.
* Simple search is provided by default out of the box. 

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
Note: for typescript do 'docula init --typescript'

## Add your content

Simply replace the logo, favicon, and css file with your own. The readme is your root project readme and you just need to at build time move it over to the site folder. If you have it at the root of the project and this is a folder inside just delete the  README.md file in the site folder and docula will copy it over for you automatically.

## Build your site

> npx docula

This will build your site and place it in the `dist` folder. You can then host it anywhere you like.

# Using Your own Template

If you want to use your own template you can do so by adding a `docula.config.ts` file to the root of your project. This file will be used to configure the build process.

or at the command line:

> npx docula --template path/to/template

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

The `readme.md` file will be the root page and the rest will be added to the table of contents. If you want to control the title or order of the pages you can do so by setting the `title` and `order` properties in the front matter of the markdown file. Here is an example:

```md
title: Getting Started
order: 2
```

# Using a Github Token

If you want to use the Github token to access the Github API you can do so by setting the `GITHUB_TOKEN` environment variable. This is useful if you want to access private repositories or if you want to access the Github API without hitting the rate limit. This is optional and you can still use docula without it but could hit rate limits and will not be able to access private repositories.

# Helper Functions for Markdown

docula comes with some helper functions that you can use in your markdown files.
* `doculaHelpers.getFrontMatter(fileName)` - Gets the front matter of a markdown file.
* `doculaHelpers.setFrontMatter(fileName, frontMatter)` - Sets the front matter of a markdown file.
* `doculaHelpers.createDoc(source, destination, frontMatter?, contentFn[]?)` - Creates a markdown file with the specified front matter and content. The contentFn is a function that is executed on the original content of the file. This is useful if you want to remove content from the original file.

# Remove html content

In some cases your markdown file will have html content in it such as the logo of your project or a badge. You can use the `doculaHelpers.removeHtmlContent()` helper function to remove that content from the page. Here is an example:

# Get and Set the Front Matter of a Markdown File

You can use the `doculaHelpers.getFrontMatter()` and `doculaHelpers.setFrontMatter()` helper functions to get and set the front matter of a markdown file. Here is an example:

```js
const frontMatter = doculaHelpers.getFrontMatter('../readme.md');
frontMatter.title = 'My Title';
doculaHelpers.setFrontMatter('../readme.md', frontMatter);
```

# Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

# License

MIT © [Jared Wray](https://jaredwray.com)
