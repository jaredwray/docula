---
title: Assets & Public Folder
order: 6
---

# Including Assets in Markdown

Non-markdown files placed inside the `docs/` or `changelog/` directories are automatically copied to the build output, preserving their relative paths. This lets you keep images and other assets alongside the markdown that references them.

For `docs/`, only assets that are actually referenced in a document's markdown content are copied. If a file exists in the `docs/` directory but is not referenced by any document, it will not be included in the build output. For `changelog/`, all assets are copied regardless of whether they are referenced.

```
site
├───docs
│   ├───getting-started.md
│   ├───images
│   │   ├───architecture.png
│   │   └───screenshot.jpg
│   └───assets
│       └───example.pdf
├───changelog
│   ├───2025-01-15-initial-release.md
│   └───images
│       └───release-banner.png
```

After building, these files appear at the same relative paths under `dist/`:

```
dist
├───docs
│   ├───getting-started
│   │   └───index.html
│   ├───images
│   │   ├───architecture.png
│   │   └───screenshot.jpg
│   └───assets
│       └───example.pdf
├───changelog
│   ├───initial-release
│   │   └───index.html
│   └───images
│       └───release-banner.png
```

Reference assets from your markdown using relative paths:

```md
![Architecture](images/architecture.png)
[Download PDF](assets/example.pdf)
```

## Supported Extensions

By default the following file extensions are copied:

- **Images:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.avif`, `.ico`
- **Documents:** `.pdf`, `.zip`, `.tar`, `.gz`
- **Media:** `.mp4`, `.webm`, `.ogg`, `.mp3`, `.wav`
- **Data:** `.json`, `.xml`, `.csv`, `.txt`

Files with extensions not in this list are ignored. To customize the list, set `allowedAssets` in your config:

```js
export const options = {
  allowedAssets: ['.png', '.jpg', '.gif', '.svg', '.pdf', '.custom'],
};
```

# Public Folder

If you have static assets like images, fonts, or other files that need to be copied directly to your built site, you can use a `public` folder. Any files placed in the `public` folder within your site directory will be automatically copied to the root of your `dist` output folder during the build process.

## Usage

Create a `public` folder inside your site directory:

```
site
├───public
│   ├───images
│   │   ├───screenshot.png
│   │   └───banner.jpg
│   ├───fonts
│   │   └───custom-font.woff2
│   └───downloads
│       └───example.pdf
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

When you run the build command, all contents of the `public` folder will be copied to the `dist` folder:

```
dist
├───images
│   ├───screenshot.png
│   └───banner.jpg
├───fonts
│   └───custom-font.woff2
├───downloads
│   └───example.pdf
├───index.html
└───...
```

The build output will show each file being copied:

```
Public folder found, copying contents to dist...
  Copied: images/screenshot.png
  Copied: images/banner.jpg
  Copied: fonts/custom-font.woff2
  Copied: downloads/example.pdf
Build completed in 1234ms
```

This is useful for:
- Images referenced in your documentation
- Downloadable files (PDFs, zip archives, etc.)
- Custom fonts
- Any other static assets that need to be served from your site
