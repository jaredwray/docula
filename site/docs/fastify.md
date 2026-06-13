---
title: Fastify Plugin
order: 22
---

# Fastify Plugin

`@docula/fastify` lets a [Fastify](https://fastify.dev) application serve your
docula docs, changelog, and API reference **on the fly** — no separate build
step. When [`@fastify/swagger`](https://github.com/fastify/fastify-swagger) is
registered, the API reference is generated from your application's **live
routes**, so it always matches the running server.

## Install

```bash
npm install @docula/fastify fastify @fastify/static
# optional: live API reference from your running routes
npm install @fastify/swagger
```

## Quick start

```ts
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import doculaFastify from "@docula/fastify";

const app = Fastify();

// Register @fastify/swagger so the plugin can read your live routes.
await app.register(fastifySwagger, {
  openapi: { info: { title: "My API", version: "1.0.0" } },
});

app.get(
  "/users",
  { schema: { summary: "List users", tags: ["users"] } },
  async () => [{ id: 1 }],
);

await app.register(doculaFastify, {
  prefix: "/docs",
  doculaOptions: {
    sitePath: "./site",
    siteTitle: "My API Docs",
    siteUrl: "https://example.com",
  },
  apiSpec: "swagger",
});

await app.listen({ port: 3000 });
// Docs:          http://localhost:3000/docs
// API reference: http://localhost:3000/docs/api   (rendered from your routes)
```

## How it works

The plugin uses a **build-then-serve** model. When your server starts, it runs a
docula build into a working directory and serves it with `@fastify/static` under
your chosen `prefix`. Because the build happens after all routes are registered,
the `swagger` API mode captures the full API surface of the running app.

## API reference modes

The `apiSpec` option controls where the API reference comes from:

- `"swagger"` — read the live spec from `fastify.swagger()` (requires
  `@fastify/swagger`). This is the default when `@fastify/swagger` is registered.
- `"options"` — use the `openApiUrl` from `doculaOptions` as-is.
- `"none"` — do not render an API reference.

## Rebuilding and watch mode

The plugin decorates your instance with `fastify.docula`, including
`fastify.docula.rebuild()` to rebuild on demand. Set `exposeRebuildRoute: true`
to expose a `POST {prefix}/_rebuild` endpoint, or `watch: true` to rebuild
automatically when files in `sitePath` change during development.

See the [`@docula/fastify` README](https://github.com/jaredwray/docula/tree/main/packages/fastify)
for the full list of options.
