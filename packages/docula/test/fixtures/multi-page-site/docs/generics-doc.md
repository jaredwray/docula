---
title: Generics Guide
description: A guide with TypeScript generics in code blocks
---

## Using Generics

Here is a generic function:

```typescript
function identity<T>(arg: T): T {
  return arg;
}
```

And a more complex example:

```typescript
const cache = new Map<string, number>();
const list: Array<Promise<Response>> = [];
```

## Non-ASCII Characters

This section has non-ASCII characters: caf&eacute;, na&iuml;ve, r&eacute;sum&eacute;.

Unicode: &uuml;ber, stra&szlig;e, &copy; 2025.
