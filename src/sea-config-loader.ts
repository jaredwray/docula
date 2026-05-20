/**
 * SEA-compatible config loader.
 *
 * Node.js SEA binaries route all dynamic `import()` calls through the
 * embedder's builtin-module lookup, which throws `ERR_UNKNOWN_BUILTIN_MODULE`
 * for any file:// URL. As a workaround, this module loads `.mjs` config
 * files by:
 *
 *   1. Reading the config source from disk
 *   2. Rewriting ESM `import`/`export` syntax to CJS via regex
 *   3. Pre-resolving every `require('specifier')` to an absolute path
 *      using `createRequire(originalConfigPath)`, so the temp file (which
 *      lives in the OS temp dir) can still reach the user's node_modules
 *   4. Inlining `__filename` / `__dirname` to the original config's
 *      absolute path (so user code sees the correct location)
 *   5. Writing the transformed CJS to a temp file and loading it through
 *      Node's standard `createRequire` — i.e. through the normal CJS
 *      module loader, NOT via `new Function`/`eval`
 *
 * The user's config file is, by design, code they want docula to execute
 * (that's what `onPrepare`/`options` are). The security boundary is the
 * same as the non-SEA `await import(configFile)` path: docula trusts the
 * user-authored config it's pointed at. This module just makes that
 * mechanism work inside a SEA where dynamic `import()` is broken.
 *
 * Best-effort transform: handles `import X from 'p'`, named/namespace/side-
 * effect imports, `import type` (stripped), and `export const|let|var|
 * function|async function|class|default`. Cross-referenced exports and
 * non-trivial ESM patterns (re-exports, top-level await) are not supported.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function rewriteAliases(specifiers: string): string {
	return specifiers.replace(/(\w+)\s+as\s+(\w+)/g, "$1: $2");
}

export function transformEsmToCjs(code: string): string {
	const trailingExports: string[] = [];
	let result = code
		.replace(/^\s*import\s+type\s+[^;]*;?\s*$/gm, "")
		.replace(
			/^(\s*)import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+(['"])(.+?)\4\s*;?/gm,
			(_m, indent, def, specs, q, pkg) =>
				`${indent}const ${def} = require(${q}${pkg}${q}).default ?? require(${q}${pkg}${q}); const {${rewriteAliases(specs)}} = require(${q}${pkg}${q});`,
		)
		.replace(
			/^(\s*)import\s+\*\s+as\s+(\w+)\s+from\s+(['"])(.+?)\3\s*;?/gm,
			"$1const $2 = require($3$4$3);",
		)
		.replace(
			/^(\s*)import\s+\{([^}]+)\}\s+from\s+(['"])(.+?)\3\s*;?/gm,
			(_m, indent, specs, q, pkg) =>
				`${indent}const {${rewriteAliases(specs)}} = require(${q}${pkg}${q});`,
		)
		.replace(
			/^(\s*)import\s+(\w+)\s+from\s+(['"])(.+?)\3\s*;?/gm,
			"$1const $2 = require($3$4$3).default ?? require($3$4$3);",
		)
		.replace(/^(\s*)import\s+(['"])(.+?)\2\s*;?/gm, "$1require($2$3$2);")
		// `export const X = expr` → `const X = exports.X = expr` so X stays
		// in the module-local scope and is also exported. Same shape for
		// let/var.
		.replace(
			/^(\s*)export\s+(const|let|var)\s+(\w+)\s*=/gm,
			"$1$2 $3 = exports.$3 =",
		)
		// `export function|async function|class X` → keep the declaration
		// intact (so X is module-scoped and hoisted) and append the export
		// after the file body.
		.replace(
			/^(\s*)export\s+(async\s+function|function|class)\s+(\w+)/gm,
			(_m, indent, kind, name) => {
				trailingExports.push(name);
				return `${indent}${kind} ${name}`;
			},
		)
		.replace(/^(\s*)export\s+default\s+/gm, "$1module.exports.default = ");

	if (trailingExports.length > 0) {
		result += `\n${trailingExports.map((n) => `exports.${n} = ${n};`).join("\n")}\n`;
	}
	return result;
}

/**
 * Pre-resolves every `require('specifier')` call in the transformed
 * source to an absolute path using the supplied resolver, so the loaded
 * module can run from a different working directory and still find the
 * user's node_modules. Specifiers that fail to resolve are left as-is so
 * Node's loader throws a normal MODULE_NOT_FOUND at runtime.
 */
function preResolveRequires(
	transformed: string,
	resolver: (specifier: string) => string,
): string {
	return transformed.replace(
		/require\((["'])([^"']+)\1\)/g,
		(_match, _quote, spec) => {
			try {
				return `require(${JSON.stringify(resolver(spec))})`;
			} catch {
				return `require(${JSON.stringify(spec)})`;
			}
		},
	);
}

/**
 * Loads a .mjs config file by reading its source, transforming ESM
 * syntax to CJS, pre-resolving requires, and loading the resulting
 * temp file through Node's standard CJS loader (`createRequire`).
 *
 * Uses `createRequire` rather than `new Function`/`eval` so the loader
 * goes through the normal module system (not dynamic code construction).
 * The temp file is created in the OS temp dir, with the user's
 * node_modules reachable via the pre-resolved absolute paths.
 *
 * The security boundary is the same as `await import(configFile)`:
 * docula trusts user-authored configs it's pointed at.
 */
export function loadMjsAsCjsModule(absolutePath: string): unknown {
	const code = fs.readFileSync(absolutePath, "utf8");
	const configRequire = createRequire(pathToFileURL(absolutePath).href);

	let transformed = transformEsmToCjs(code);
	transformed = preResolveRequires(transformed, (spec) =>
		configRequire.resolve(spec),
	);
	transformed = transformed
		.replace(/\b__filename\b/g, JSON.stringify(absolutePath))
		.replace(/\b__dirname\b/g, JSON.stringify(path.dirname(absolutePath)));

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "docula-sea-config-"));
	const tempFile = path.join(tempDir, "config.cjs");

	try {
		fs.writeFileSync(tempFile, transformed);
		const tempRequire = createRequire(pathToFileURL(tempFile).href);
		return tempRequire(tempFile);
	} catch (error) {
		throw new Error(
			`Failed to load ESM config file in standalone binary: ${(error as Error).message}`,
		);
	} finally {
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
}
