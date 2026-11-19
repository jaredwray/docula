# Docula

Docula builds static websites from Markdown files, Handlebars templates, and OpenAPI specifications.

Install Docula in your project.

```sh
pnpm add --save-dev docula
```

Create the site files.

```sh
pnpm exec docula init
```

Add your home page text to `site/README.md`. Then build the site.

```sh
pnpm exec docula build
```

The default output directory is `site/dist/`.

See the [Docula documentation](https://docula.org/docs/index) for configuration options and CLI commands.
