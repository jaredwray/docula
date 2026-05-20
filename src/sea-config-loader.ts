/**
 * SEA-compatible config loader.
 *
 * Node.js SEA binaries route all dynamic `import()` calls through the
 * embedder's builtin-module lookup, which throws `ERR_UNKNOWN_BUILTIN_MODULE`
 * for any file:// URL. As a workaround, this module loads `.mjs` config
 * files by reading their source, rewriting ESM `import`/`export` syntax to
 * CJS, and evaluating via the `Function` constructor with an injected
 * `createRequire`-based require function.
 *
 * Best-effort transform: handles `import X from 'p'`, named/namespace/side-
 * effect imports, `import type` (stripped), and `export const|let|var|
 * function|async function|class|default`. Cross-referenced exports and
 * non-trivial ESM patterns (re-exports, top-level await) are not supported.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function transformEsmToCjs(code: string): string {
	return code
		.replace(/^\s*import\s+type\s+[^;]*;?\s*$/gm, "")
		.replace(
			/^(\s*)import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+(['"])(.+?)\4\s*;?/gm,
			"$1const $2 = require($4$5$4); const {$3} = $2;",
		)
		.replace(
			/^(\s*)import\s+\*\s+as\s+(\w+)\s+from\s+(['"])(.+?)\3\s*;?/gm,
			"$1const $2 = require($3$4$3);",
		)
		.replace(
			/^(\s*)import\s+\{([^}]+)\}\s+from\s+(['"])(.+?)\3\s*;?/gm,
			"$1const {$2} = require($3$4$3);",
		)
		.replace(
			/^(\s*)import\s+(\w+)\s+from\s+(['"])(.+?)\3\s*;?/gm,
			"$1const $2 = require($3$4$3).default ?? require($3$4$3);",
		)
		.replace(/^(\s*)import\s+(['"])(.+?)\2\s*;?/gm, "$1require($2$3$2);")
		.replace(
			/^(\s*)export\s+(?:const|let|var)\s+(\w+)\s*=\s*/gm,
			"$1exports.$2 = ",
		)
		.replace(
			/^(\s*)export\s+async\s+function\s+(\w+)/gm,
			"$1exports.$2 = async function $2",
		)
		.replace(/^(\s*)export\s+function\s+(\w+)/gm, "$1exports.$2 = function $2")
		.replace(/^(\s*)export\s+class\s+(\w+)/gm, "$1exports.$2 = class $2")
		.replace(/^(\s*)export\s+default\s+/gm, "$1module.exports.default = ");
}

/**
 * Loads a .mjs config file by reading its source, transforming ESM syntax
 * to CJS, and evaluating via the Function constructor. The injected
 * `require` is created with `createRequire(absolutePath)` so user
 * `import`/`require` calls resolve from the config's own directory.
 */
export function loadMjsAsCjsModule(absolutePath: string): unknown {
	const code = fs.readFileSync(absolutePath, "utf8");
	const transformed = transformEsmToCjs(code);
	const requireFn = createRequire(pathToFileURL(absolutePath).href);
	const moduleObject: { exports: Record<string, unknown> } = { exports: {} };

	try {
		const fn = new Function(
			"exports",
			"require",
			"module",
			"__filename",
			"__dirname",
			transformed,
		);
		fn(
			moduleObject.exports,
			requireFn,
			moduleObject,
			absolutePath,
			path.dirname(absolutePath),
		);
	} catch (error) {
		throw new Error(
			`Failed to load ESM config file in standalone binary: ${(error as Error).message}`,
		);
	}

	return moduleObject.exports;
}
