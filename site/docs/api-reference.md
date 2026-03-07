---
title: API Reference
order: 8
---

# API Reference

Docula can generate an API Reference page from an OpenAPI (Swagger) specification. The spec is parsed at build time and rendered as a native, interactive API reference (inspired by [Scalar](https://github.com/scalar/scalar)) with grouped endpoints, method badges, schema tables, code examples, and search — all with no external dependencies. The page is available at `/api`.

## Auto-Detection

If your site directory contains an `api/swagger.json` file, Docula will automatically detect it and generate the API Reference page — no configuration needed:

```
site
├───api
│   └───swagger.json
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

## Explicit Configuration

You can also set the `openApiUrl` option in your config to point to any OpenAPI spec, either a local path or a remote URL:

```js
export const options = {
  openApiUrl: '/api/swagger.json',
  // or a remote URL:
  // openApiUrl: 'https://petstore.swagger.io/v2/swagger.json',
};
```

When `openApiUrl` is set explicitly, it takes priority over auto-detection.

## Spec Requirements

The file must be a valid OpenAPI 3.x or Swagger 2.0 JSON specification. A minimal example:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {}
}
```
