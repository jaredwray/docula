---
title: Helper Utilities
order: 15
---

# Helpers

Docula provides powerful helper utilities through its integration with [Writr](https://writr.org). For all markdown operations including reading files, manipulating content, managing frontmatter, and rendering, you should use the `Writr` class that's exported from Docula.

**Instead of custom helper functions, use Writr for:**
- Loading and saving markdown files
- Getting and setting frontmatter (metadata)
- Rendering markdown to HTML
- Working with markdown content programmatically

# Working with Markdown using Writr

Docula exports [Writr](https://writr.org) for powerful markdown operations including loading files, rendering, and managing frontmatter. Writr provides a simple API for working with markdown content.

## Creating and Loading Markdown

```js
import { Writr } from 'docula';

// Create a new instance with markdown content
const writr = new Writr('# Hello World\n\nThis is my content');

// Or load from a file
const writr = new Writr();
await writr.loadFromFile('./README.md');

// Synchronous version
writr.loadFromFileSync('./README.md');
```

## Getting and Setting Front Matter

Front matter is metadata at the top of markdown files in YAML format. Writr makes it easy to read and modify:

```js
import { Writr } from 'docula';

const writr = new Writr();
await writr.loadFromFile('./docs/guide.md');

// Get the entire front matter object
const frontMatter = writr.frontMatter;
console.log(frontMatter.title); // 'My Guide'

// Get a specific front matter value
const title = writr.getFrontMatterValue('title');
const order = writr.getFrontMatterValue('order');

// Set front matter
writr.frontMatter = {
  title: 'Updated Guide',
  order: 1,
  author: 'John Doe'
};

// Save the changes back to the file
await writr.saveToFile('./docs/guide.md');
```

## Accessing Markdown Content

```js
// Get the full content (front matter + markdown)
const fullContent = writr.content;

// Get just the markdown body (without front matter)
const markdown = writr.body;
// or use the alias
const markdown = writr.markdown;

// Get the raw front matter string (including delimiters)
const rawFrontMatter = writr.frontMatterRaw;

// Set new content
writr.content = '---\ntitle: New Title\n---\n# New Content';
```

## Rendering Markdown to HTML

```js
// Render to HTML
const html = await writr.render();

// Synchronous rendering
const html = writr.renderSync();

// Render with options
const html = await writr.render({
  emoji: true,        // Enable emoji support (default: true)
  toc: true,          // Generate table of contents (default: true)
  highlight: true,    // Code syntax highlighting (default: true)
  gfm: true,          // GitHub Flavored Markdown (default: true)
  math: true,         // Math support (default: true)
  mdx: true           // MDX support (default: true)
});

// Render directly to a file
await writr.renderToFile('./output.html');
```
