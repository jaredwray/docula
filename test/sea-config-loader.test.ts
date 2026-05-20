import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	loadMjsAsCjsModule,
	transformEsmToCjs,
} from "../src/sea-config-loader.js";

function evaluate(
	transformed: string,
	requireFn: (id: string) => unknown = () => ({}),
) {
	const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
	const fn = new Function(
		"exports",
		"require",
		"module",
		"__filename",
		"__dirname",
		transformed,
	);
	fn(moduleObject.exports, requireFn, moduleObject, "/tmp/fake.mjs", "/tmp");
	return moduleObject.exports;
}

describe("transformEsmToCjs", () => {
	it("transforms export const to exports assignment", () => {
		const transformed = transformEsmToCjs(
			`export const options = { siteTitle: "Test" };`,
		);
		const result = evaluate(transformed) as { options: { siteTitle: string } };
		expect(result.options.siteTitle).toBe("Test");
	});

	it("transforms multiple exports including async function", () => {
		const code = `export const options = { foo: 1 };
export const onPrepare = async (opts, console) => {
	console.info("hi");
};`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as {
			options: { foo: number };
			onPrepare: (a: unknown, b: unknown) => Promise<void>;
		};
		expect(result.options.foo).toBe(1);
		expect(typeof result.onPrepare).toBe("function");
	});

	it("transforms named imports", () => {
		const code = `import { join } from 'node:path';
export const usesJoin = join('a', 'b');`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed, (id) => {
			if (id === "node:path") {
				return { join: (...parts: string[]) => parts.join("/") };
			}
			return {};
		}) as { usesJoin: string };
		expect(result.usesJoin).toBe("a/b");
	});

	it("transforms default import with default interop", () => {
		const code = `import dotenv from "dotenv";
export const cfg = dotenv;`;
		const transformed = transformEsmToCjs(code);
		const fakeDotenv = { config: () => ({}) };
		const result = evaluate(transformed, (id) => {
			if (id === "dotenv") {
				return { default: fakeDotenv };
			}
			return {};
		}) as { cfg: { config: () => unknown } };
		expect(result.cfg).toBe(fakeDotenv);
	});

	it("transforms namespace imports", () => {
		const code = `import * as fs from 'node:fs';
export const x = fs.something;`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed, (id) => {
			if (id === "node:fs") {
				return { something: 42 };
			}
			return {};
		}) as { x: number };
		expect(result.x).toBe(42);
	});

	it("strips import type lines", () => {
		const code = `import type { DoculaOptions } from 'docula';
export const options = { template: "modern" };`;
		const transformed = transformEsmToCjs(code);
		expect(transformed).not.toMatch(/import\s+type/);
		const result = evaluate(transformed) as { options: { template: string } };
		expect(result.options.template).toBe("modern");
	});

	it("transforms side-effect imports", () => {
		const code = `import 'side-effect';
export const x = 1;`;
		let called = false;
		const transformed = transformEsmToCjs(code);
		evaluate(transformed, (id) => {
			if (id === "side-effect") {
				called = true;
			}
			return {};
		});
		expect(called).toBe(true);
	});

	it("transforms export function declarations", () => {
		const code = `export function greet(name) { return "hi " + name; }`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as { greet: (name: string) => string };
		expect(result.greet("alice")).toBe("hi alice");
	});

	it("transforms export class declarations", () => {
		const code = `export class Foo { hello() { return "world"; } }`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as {
			Foo: new () => { hello: () => string };
		};
		const instance = new result.Foo();
		expect(instance.hello()).toBe("world");
	});

	it("transforms export default", () => {
		const code = `export default { thing: 42 };`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as { default: { thing: number } };
		expect(result.default.thing).toBe(42);
	});

	it("handles multi-line named imports", () => {
		const code = `import {
	join,
	dirname,
} from 'node:path';
export const computed = join('a', dirname('/b/c'));`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed, (id) => {
			if (id === "node:path") {
				return {
					join: (...p: string[]) => p.join("/"),
					dirname: (p: string) => p.slice(0, p.lastIndexOf("/")),
				};
			}
			return {};
		}) as { computed: string };
		expect(result.computed).toBe("a//b");
	});

	it("calls require once per default import (no double evaluation)", () => {
		const code = `import dotenv from "dotenv";
export const cfg = dotenv;`;
		const transformed = transformEsmToCjs(code);
		// Count require( calls for the package
		const requireCalls = (transformed.match(/require\(["']dotenv["']\)/g) ?? [])
			.length;
		expect(requireCalls).toBe(1);
	});

	it("preserves named-import aliases (`a as b` → `a: b`)", () => {
		const code = `import { join as pathJoin } from 'node:path';
export const computed = pathJoin('a', 'b');`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed, (id) => {
			if (id === "node:path") {
				return { join: (...p: string[]) => p.join("/") };
			}
			return {};
		}) as { computed: string };
		expect(result.computed).toBe("a/b");
	});

	it("keeps exported `const X` in module scope so later exports can use it", () => {
		const code = `export const helper = (n) => n * 2;
export const onPrepare = () => helper(21);`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as {
			helper: (n: number) => number;
			onPrepare: () => number;
		};
		expect(result.onPrepare()).toBe(42);
	});

	it("keeps exported functions in module scope (hoisted) so later code can call them", () => {
		const code = `export const onPrepare = () => helper(21);
export function helper(n) { return n * 2; }`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as {
			helper: (n: number) => number;
			onPrepare: () => number;
		};
		expect(result.onPrepare()).toBe(42);
	});

	it("keeps exported classes in module scope", () => {
		const code = `export class Greeter { greet() { return "hi"; } }
export const factory = () => new Greeter();`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as {
			Greeter: new () => { greet: () => string };
			factory: () => { greet: () => string };
		};
		expect(result.factory().greet()).toBe("hi");
	});

	it("handles the smoke test fixture pattern", () => {
		const code = `export const options = {
	githubPath: "jaredwray/docula",
	siteTitle: "Docula",
	siteDescription: "Beautiful Website for Your Projects",
	siteUrl: "https://docula.org",
};`;
		const transformed = transformEsmToCjs(code);
		const result = evaluate(transformed) as { options: Record<string, string> };
		expect(result.options.siteTitle).toBe("Docula");
		expect(result.options.githubPath).toBe("jaredwray/docula");
	});
});

describe("loadMjsAsCjsModule", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "docula-sea-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("loads a simple .mjs file with exports", () => {
		const filePath = path.join(tempDir, "docula.config.mjs");
		fs.writeFileSync(
			filePath,
			`export const options = { siteTitle: "Test Site" };`,
		);
		const result = loadMjsAsCjsModule(filePath) as {
			options: { siteTitle: string };
		};
		expect(result.options.siteTitle).toBe("Test Site");
	});

	it("loads a .mjs file with named imports from node builtins", () => {
		const filePath = path.join(tempDir, "docula.config.mjs");
		fs.writeFileSync(
			filePath,
			`import { join } from 'node:path';
export const computed = join('a', 'b');`,
		);
		const result = loadMjsAsCjsModule(filePath) as { computed: string };
		expect(result.computed).toBe(path.join("a", "b"));
	});

	it("loads a .mjs file with onPrepare function", () => {
		const filePath = path.join(tempDir, "docula.config.mjs");
		fs.writeFileSync(
			filePath,
			`export const options = { siteTitle: "X" };
export const onPrepare = async (opts) => opts.siteTitle.toUpperCase();`,
		);
		const result = loadMjsAsCjsModule(filePath) as {
			options: { siteTitle: string };
			onPrepare: (opts: { siteTitle: string }) => Promise<string>;
		};
		expect(result.options.siteTitle).toBe("X");
		expect(typeof result.onPrepare).toBe("function");
	});

	it("wraps evaluation errors with a clear SEA message", () => {
		const filePath = path.join(tempDir, "docula.config.mjs");
		fs.writeFileSync(filePath, `this is not valid JavaScript ===`);
		expect(() => loadMjsAsCjsModule(filePath)).toThrow(
			/Failed to load ESM config file in standalone binary/,
		);
	});

	it("provides __filename and __dirname to the config", () => {
		const filePath = path.join(tempDir, "docula.config.mjs");
		fs.writeFileSync(
			filePath,
			`export const here = { file: __filename, dir: __dirname };`,
		);
		const result = loadMjsAsCjsModule(filePath) as {
			here: { file: string; dir: string };
		};
		expect(result.here.file).toBe(filePath);
		expect(result.here.dir).toBe(tempDir);
	});
});
