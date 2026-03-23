import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { CacheableNet } from "@cacheable/net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoculaConsole } from "../src/console.js";
import Docula from "../src/docula.js";
import { DoculaOptions } from "../src/options.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI escape codes
const ansiRegex = /\u001B\[[0-9;]*m/g;
function stripAnsi(str: string): string {
	return str.replace(ansiRegex, "");
}

const githubMockContributors = JSON.parse(
	fs.readFileSync(
		"./test/fixtures/data-mocks/github-contributors.json",
		"utf8",
	),
);
const githubMockReleases = JSON.parse(
	fs.readFileSync("./test/fixtures/data-mocks/github-releases.json", "utf8"),
);

const defaultOptions: DoculaOptions = new DoculaOptions({
	templatePath: "./custom-template",
	output: "./custom-dist",
	sitePath: "./custom-site",
	githubPath: "custom/repo",
	siteTitle: "Custom Title",
	siteDescription: "Custom Description",
	siteUrl: "https://custom-url.com",
});

vi.mock("@cacheable/net");

describe("docula", () => {
	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
		// Clean build manifests to prevent differential build interference between tests
		for (const fixture of [
			"test/fixtures/single-page-site",
			"test/fixtures/single-page-site-ts",
			"test/fixtures/single-page-site-onprepare",
			"test/fixtures/single-page-site-ts-onprepare",
			"test/fixtures/multi-page-site",
			"test/fixtures/mega-page-site",
			"test/fixtures/mega-page-site-no-home-page",
		]) {
			fs.rmSync(`${fixture}/.cache/build`, { recursive: true, force: true });
		}

		// Clean up auto-generated README.md and copied assets in fixtures that should not have them
		for (const fixture of [
			"test/fixtures/mega-page-site",
			"test/fixtures/mega-page-site-no-home-page",
		]) {
			try {
				fs.rmSync(`${fixture}/README.md`, { force: true });
				fs.rmSync(`${fixture}/site`, { recursive: true, force: true });
			} catch {
				// ignore if files do not exist
			}
		}
	});
	beforeEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: test file
		(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
			if (url.endsWith("releases")) {
				return { data: githubMockReleases };
			}

			if (url.endsWith("contributors")) {
				return { data: githubMockContributors };
			}

			// Default response or throw an error if you prefer
			return { data: {} };
		});
	});

	it("should be able to initialize", () => {
		const docula = new Docula();
		docula.console.quiet = true;
		expect(docula).toBeDefined();
	});
	it("should be able to initialize with options", () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		expect(docula).toBeDefined();
	});
	it("should be able to get and set options", () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		expect(docula.options).toEqual(defaultOptions);
		const newOptions: DoculaOptions = new DoculaOptions({
			templatePath: "./new-template",
			output: "./new-dist",
			sitePath: "./new-site",
			githubPath: "new/repo",
			siteTitle: "New Title",
			siteDescription: "New Description",
			siteUrl: "https://new-url.com",
		});
		docula.options = newOptions;
		expect(docula.options).toEqual(newOptions);
	});
	it("should generate the site init files and folders", () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		const temporarySitePath = "./temp-site";
		console.log = (message) => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath);

			expect(consoleMessage).toContain("docula initialized.");
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(
				true,
			);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should generate the site init files and folders for javascript", () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		const temporarySitePath = "./temp-site-js";
		console.log = (message) => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath);

			expect(consoleMessage).toContain("docula initialized.");
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(
				true,
			);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should generate the site init files and folders for typescript", () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		const temporarySitePath = "./temp-site-ts";
		console.log = (message) => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath, true);

			expect(consoleMessage).toContain("docula initialized.");
			expect(consoleMessage).toContain("docula.config.ts");
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.ts`)).toEqual(
				true,
			);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(
				false,
			);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);

			// Verify the TypeScript config file contains expected content
			const configContent = fs.readFileSync(
				`${temporarySitePath}/docula.config.ts`,
				"utf8",
			);
			expect(configContent).toContain("import type");
			expect(configContent).toContain("DoculaOptions");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});

	it("should copy variables.css to site directory from modern template", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-vars";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		docula.console.quiet = true;

		try {
			docula.downloadVariables(temporarySitePath, "", "modern", false);
			const dest = `${temporarySitePath}/variables.css`;
			expect(fs.existsSync(dest)).toEqual(true);
			const content = fs.readFileSync(dest, "utf8");
			expect(content).toContain(":root");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should error if variables.css already exists without --overwrite", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-vars-exists";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		const dest = `${temporarySitePath}/variables.css`;
		fs.writeFileSync(dest, "/* original */");
		const consoleError = console.error;
		let errorMessage = "";
		console.error = (message) => {
			errorMessage = message;
		};

		try {
			docula.downloadVariables(temporarySitePath, "", "modern", false);
			expect(stripAnsi(errorMessage)).toContain("already exists");
			expect(stripAnsi(errorMessage)).toContain("--overwrite");
			expect(fs.readFileSync(dest, "utf8")).toEqual("/* original */");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
			console.error = consoleError;
		}
	});
	it("should overwrite variables.css when overwrite is true", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-vars-overwrite";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		const dest = `${temporarySitePath}/variables.css`;
		fs.writeFileSync(dest, "/* original */");
		docula.console.quiet = true;

		try {
			docula.downloadVariables(temporarySitePath, "", "modern", true);
			expect(fs.existsSync(dest)).toEqual(true);
			const content = fs.readFileSync(dest, "utf8");
			expect(content).not.toEqual("/* original */");
			expect(content).toContain(":root");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should copy variables.css from classic template", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-vars-classic";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		docula.console.quiet = true;

		try {
			docula.downloadVariables(temporarySitePath, "", "classic", false);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should copy full template to site/templates/<name>/", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-template";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		docula.console.quiet = true;

		try {
			docula.downloadTemplate(temporarySitePath, "", "modern", false);
			const dest = `${temporarySitePath}/templates/modern`;
			expect(fs.existsSync(dest)).toEqual(true);
			expect(fs.statSync(dest).isDirectory()).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should error if template directory already exists without --overwrite", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-template-exists";
		const dest = `${temporarySitePath}/templates/modern`;
		fs.mkdirSync(dest, { recursive: true });
		const consoleError = console.error;
		let errorMessage = "";
		console.error = (message) => {
			errorMessage = message;
		};

		try {
			docula.downloadTemplate(temporarySitePath, "", "modern", false);
			expect(stripAnsi(errorMessage)).toContain("already exists");
			expect(stripAnsi(errorMessage)).toContain("--overwrite");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
			console.error = consoleError;
		}
	});
	it("should overwrite template directory when overwrite is true", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-template-overwrite";
		const dest = `${temporarySitePath}/templates/modern`;
		fs.mkdirSync(dest, { recursive: true });
		fs.writeFileSync(`${dest}/sentinel.txt`, "original");
		docula.console.quiet = true;

		try {
			docula.downloadTemplate(temporarySitePath, "", "modern", true);
			expect(fs.existsSync(`${dest}/css/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should copy classic template to site/templates/classic/", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-template-classic";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		docula.console.quiet = true;

		try {
			docula.downloadTemplate(temporarySitePath, "", "classic", false);
			expect(fs.existsSync(`${temporarySitePath}/templates/classic`)).toEqual(
				true,
			);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should use basename of custom templatePath for output directory name", () => {
		const docula = new Docula(defaultOptions);
		const temporarySitePath = "./temp-download-template-custom-path";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		docula.console.quiet = true;
		const customTemplatePath = "templates/modern";

		try {
			docula.downloadTemplate(temporarySitePath, customTemplatePath, "", false);
			expect(fs.existsSync(`${temporarySitePath}/templates/modern`)).toEqual(
				true,
			);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should get the package version", () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		const packageJson = fs.readFileSync("./package.json", "utf8");
		const packageObject = JSON.parse(packageJson) as { version: string };
		const packageVersion = docula.getVersion();
		expect(packageVersion).toBeDefined();
		expect(packageVersion).toEqual(packageObject.version);
	});
});

describe("docula execute", () => {
	it("should be able to execute with no parameters", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.output = "test/temp/docula-exec-no-params";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		try {
			process.argv = ["node", "docula"];
			await docula.execute(process);
			expect(fs.existsSync(buildOptions.output)).toEqual(true);
		} finally {
			await fs.promises.rm(buildOptions.output, {
				recursive: true,
				force: true,
			});
		}
	});
	it("should be able to build with typescript config", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site-ts";
		buildOptions.output = "test/temp/docula-exec-ts-config";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(fs.existsSync(buildOptions.output)).toEqual(true);
		// Verify the config was loaded from TypeScript file
		expect(docula.configFileModule.options.siteTitle).toEqual(
			"Docula TypeScript",
		);

		await fs.promises.rm(buildOptions.output, { recursive: true });
	});
	it("should be able to execute with output parameter", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.output = "test/temp/docula-exec-output-initial";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const realOutputPath = "test/temp/docula-exec-output-param";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		process.argv = ["node", "docula", "-o", realOutputPath];
		await docula.execute(process);

		expect(fs.existsSync(realOutputPath)).toEqual(true);

		await fs.promises.rm(realOutputPath, { recursive: true });
	});
	it("should clean the output directory when --clean flag is set", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.output = "test/temp/docula-exec-clean";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		try {
			// First build without clean
			process.argv = ["node", "docula"];
			await docula.execute(process);
			expect(fs.existsSync(buildOptions.output)).toEqual(true);

			// Add a stale file
			fs.writeFileSync(`${buildOptions.output}/stale.txt`, "stale");
			expect(fs.existsSync(`${buildOptions.output}/stale.txt`)).toEqual(true);

			// Build again with --clean
			process.argv = ["node", "docula", "--clean"];
			await docula.execute(process);

			// Output should exist (rebuilt) but stale file should be gone
			expect(fs.existsSync(buildOptions.output)).toEqual(true);
			expect(fs.existsSync(`${buildOptions.output}/stale.txt`)).toEqual(false);
		} finally {
			await fs.promises.rm(buildOptions.output, {
				recursive: true,
				force: true,
			});
		}
	});
	it("should clean the .cache directory when --clean flag is set", async () => {
		const sitePath = "test/temp/clean-cache-site";
		const outputDir = `${sitePath}/dist`;

		// Create a minimal site fixture without a config file (so sitePath isn't overridden)
		fs.mkdirSync(sitePath, { recursive: true });
		fs.writeFileSync(`${sitePath}/README.md`, "# Test");

		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = sitePath;
		buildOptions.output = outputDir;
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		const cachePath = `${sitePath}/.cache`;

		try {
			// Create a fake cache directory
			fs.mkdirSync(`${cachePath}/templates/modern`, { recursive: true });
			fs.writeFileSync(`${cachePath}/templates/modern/test.hbs`, "test");
			expect(fs.existsSync(cachePath)).toEqual(true);

			// Build with --clean
			process.argv = ["node", "docula", "--clean"];
			await docula.execute(process);

			// The pre-existing template cache should be removed by --clean
			expect(fs.existsSync(`${cachePath}/templates/modern/test.hbs`)).toEqual(
				false,
			);
			// But the build manifest is recreated during the build
			expect(fs.existsSync(`${cachePath}/build/manifest.json`)).toEqual(true);
		} finally {
			fs.rmSync(sitePath, { recursive: true, force: true });
		}
	});
	it("should generate llms files during build for docs/api/changelog sites", async () => {
		const sourcePath = "test/fixtures/mega-page-site-no-home-page";
		const sitePath = "test/temp/llms-integration-site";
		const output = `${sitePath}/dist`;
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = sitePath;
		buildOptions.output = output;
		buildOptions.template = "modern";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		fs.rmSync(sitePath, { recursive: true, force: true });
		fs.cpSync(sourcePath, sitePath, { recursive: true });
		fs.rmSync(`${sitePath}/docula.config.mjs`, { force: true });
		fs.rmSync(output, { recursive: true, force: true });

		try {
			process.argv = ["node", "docula"];
			await docula.execute(process);

			expect(fs.existsSync(`${output}/feed.xml`)).toBe(true);
			expect(fs.existsSync(`${output}/llms.txt`)).toBe(true);
			expect(fs.existsSync(`${output}/llms-full.txt`)).toBe(true);

			const feed = await fs.promises.readFile(`${output}/feed.xml`, "utf8");
			const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
			const llmsFull = await fs.promises.readFile(
				`${output}/llms-full.txt`,
				"utf8",
			);

			expect(feed).toContain('<rss version="2.0"');
			expect(feed).toContain("<item>");
			expect(feed).toContain("https://docula.org/docs/");
			expect(llms).toContain("## Documentation");
			expect(llms).toContain("## API Reference");
			expect(llms).toContain("## Changelog");
			expect(llmsFull).toContain("## API Reference");
			expect(llmsFull).toContain('"openapi": "3.0.3"');
		} finally {
			await fs.promises.rm(sitePath, { recursive: true, force: true });
		}
	});
	it("should init based on the init command with auto-detect", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site";
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		process.argv = ["node", "docula", "init", "-s", sitePath];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			// Auto-detects TypeScript because this project has tsconfig.json
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(true);
			expect(consoleMessage).toContain("docula initialized.");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			console.log = consoleLog;
		}
	});
	it("should init with typescript config using --typescript flag", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site-ts";
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		process.argv = ["node", "docula", "init", "-s", sitePath, "--typescript"];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(false);
			expect(consoleMessage).toContain("docula initialized.");
			expect(consoleMessage).toContain("docula.config.ts");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			console.log = consoleLog;
		}
	});
	it("should init with javascript config using --javascript flag", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site-js";
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		process.argv = ["node", "docula", "init", "-s", sitePath, "--javascript"];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(false);
			expect(consoleMessage).toContain("docula initialized.");
			expect(consoleMessage).toContain("docula.config.mjs");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			console.log = consoleLog;
		}
	});
	it("should auto-detect typescript when tsconfig.json exists", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site-auto-ts";
		const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
		const hadTsconfig = fs.existsSync(tsconfigPath);
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		// Ensure tsconfig.json exists (this project already has one)
		if (!hadTsconfig) {
			fs.writeFileSync(tsconfigPath, "{}");
		}

		process.argv = ["node", "docula", "init", "-s", sitePath];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(false);
			expect(consoleMessage).toContain("docula.config.ts");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			if (!hadTsconfig) {
				fs.unlinkSync(tsconfigPath);
			}

			console.log = consoleLog;
		}
	});
	it("should --javascript flag override auto-detection", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site-js-override";
		const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
		const hadTsconfig = fs.existsSync(tsconfigPath);
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		if (!hadTsconfig) {
			fs.writeFileSync(tsconfigPath, "{}");
		}

		process.argv = ["node", "docula", "init", "-s", sitePath, "--javascript"];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(false);
			expect(consoleMessage).toContain("docula.config.mjs");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			if (!hadTsconfig) {
				fs.unlinkSync(tsconfigPath);
			}

			console.log = consoleLog;
		}
	});
	it("should error when both --typescript and --javascript flags are used", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site-conflict";
		let errorMessage = "";
		const consoleError = console.error;
		docula.console.quiet = true;
		console.error = (message) => {
			errorMessage = message as string;
		};

		process.argv = [
			"node",
			"docula",
			"init",
			"-s",
			sitePath,
			"--typescript",
			"--javascript",
		];
		try {
			await docula.execute(process);
			expect(errorMessage).toContain("Cannot use both");
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(false);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(false);
		} finally {
			if (fs.existsSync(sitePath)) {
				await fs.promises.rm(sitePath, { recursive: true });
			}

			console.error = consoleError;
		}
	});
	it("should detect typescript project", () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		// This project has a tsconfig.json
		expect(docula.detectTypeScript()).toEqual(true);
	});
	it("should print help command", async () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		process.argv = ["node", "docula", "help"];
		console.log = (message) => {
			if (typeof message === "string" && message.includes("Usage:")) {
				consoleMessage = message;
			}
		};

		await docula.execute(process);
		expect(consoleMessage).toContain("Usage:");
		console.log = consoleLog;
	});
	it("should show version by the version command", async () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		process.argv = ["node", "docula", "version"];
		console.log = (message) => {
			if (typeof message === "string") {
				consoleMessage = message;
			}
		};

		await docula.execute(process);
		expect(consoleMessage).toContain(".");
		console.log = consoleLog;
	});
	it("should serve the site", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-serve-basic";
		options.templatePath = "test/fixtures/template-example/";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8181"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}
	});
	it("should serve the site and reset the server if exists", async () => {
		const options = new DoculaOptions();
		options.sitePath = path.join(
			process.cwd(),
			"test/fixtures/single-page-site",
		);
		options.output = path.join(process.cwd(), "test/temp/docula-serve-reset");
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8182"];
		docula.console.quiet = true;

		try {
			await docula.serve(options);
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}
	});
	it("should serve the site on a specified port", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-serve-port";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8183"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);

			expect(docula.server).toBeDefined();
			const address = docula.server?.address() as { port: number };
			expect(address.port).toEqual(8183);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}
	});
	it("should serve the site on a specified port with --port flag", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-serve-port-flag";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "--port", "8184"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);

			expect(docula.server).toBeDefined();
			const address = docula.server?.address() as { port: number };
			expect(address.port).toEqual(8184);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}
	});
	it("should run onPrepare method if exists", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site-onprepare";
		buildOptions.output = "test/temp/docula-exec-onprepare";
		buildOptions.templatePath = "test/fixtures/template-example/";

		const consoleLog = console.log;
		let consoleMessage = "";
		console.log = (message) => {
			if (typeof message === "string") {
				consoleMessage += message;
			}
		};

		const docula = new Docula(buildOptions);

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(consoleMessage).toContain("onPrepare");

		await fs.promises.rm(buildOptions.output, { recursive: true });
		console.log = consoleLog;
	});
	it("should execute download variables command and copy variables.css", async () => {
		const temporarySitePath = "./temp-exec-download-vars";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = temporarySitePath;
		buildOptions.template = "modern";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		try {
			process.argv = ["node", "docula", "download", "variables"];
			await docula.execute(process);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should execute download variables --overwrite command and overwrite variables.css", async () => {
		const temporarySitePath = "./temp-exec-download-vars-overwrite";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		const dest = `${temporarySitePath}/variables.css`;
		fs.writeFileSync(dest, "/* original */");
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = temporarySitePath;
		buildOptions.template = "modern";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		try {
			process.argv = ["node", "docula", "download", "variables", "--overwrite"];
			await docula.execute(process);
			const written = fs.readFileSync(dest, "utf8");
			expect(written).not.toEqual("/* original */");
			expect(written).toContain(":root");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should execute download template command and copy template directory", async () => {
		const temporarySitePath = "./temp-exec-download-template";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = temporarySitePath;
		buildOptions.template = "modern";
		const docula = new Docula(buildOptions);
		docula.console.quiet = true;

		try {
			process.argv = ["node", "docula", "download", "template"];
			await docula.execute(process);
			expect(fs.existsSync(`${temporarySitePath}/templates/modern`)).toEqual(
				true,
			);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should execute download with no subcommand and print error", async () => {
		const temporarySitePath = "./temp-exec-download-noarg";
		fs.mkdirSync(temporarySitePath, { recursive: true });
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = temporarySitePath;
		buildOptions.template = "modern";
		const docula = new Docula(buildOptions);
		const consoleError = console.error;
		let errorMessage = "";
		docula.console.quiet = true;
		console.error = (message) => {
			errorMessage = message;
		};

		try {
			process.argv = ["node", "docula", "download"];
			await docula.execute(process);
			expect(stripAnsi(errorMessage)).toContain("variables");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
			console.error = consoleError;
		}
	});
});

describe("docula watch", () => {
	it("should start watching when serve is called with --watch flag", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-serve-watch";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8190", "--watch"];
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeDefined();
			expect(
				messages.some((m) =>
					stripAnsi(m).includes("Watching for file changes..."),
				),
			).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should not start watching when serve is called without --watch flag", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-serve-no-watch";
		options.templatePath = "test/fixtures/template-example/";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8191"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeUndefined();
		} finally {
			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
		}
	});
	it("should not clean output directory when serve is called with --clean but without --build or --watch", async () => {
		const outputDir = path.resolve("test/temp/docula-serve-clean-no-build");
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = outputDir;
		options.templatePath = "test/fixtures/template-example/";
		await fs.promises.mkdir(outputDir, { recursive: true });
		// Create a marker file to verify it doesn't get deleted
		fs.writeFileSync(path.join(outputDir, "marker.txt"), "keep");
		const docula = new Docula(options);
		process.argv = [
			"node",
			"docula",
			"serve",
			"-p",
			"8193",
			"--clean",
			"-o",
			"test/temp/docula-serve-clean-no-build",
		];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			// The marker file should still exist — clean should not have run
			expect(fs.existsSync(path.join(outputDir, "marker.txt"))).toBe(true);
		} finally {
			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(outputDir, { recursive: true, force: true });
		}
	});
	it("should build and serve when --build flag is used without --watch", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-serve-build-flag";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8192", "--build"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeUndefined();
			// Verify that a build was performed
			expect(fs.existsSync(path.join(options.output, "index.html"))).toBe(true);
		} finally {
			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
		}
	});
	it("should rebuild when a file changes in the watched directory", async () => {
		const tempSitePath = "test/temp/watch-site";
		const tempOutput = "test/temp/watch-output";

		// Copy fixture to temp directory
		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});

		const options = new DoculaOptions();
		options.sitePath = tempSitePath;
		options.output = tempOutput;
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			await builder.build();
			const watcher = docula.watch(options, builder);
			expect(watcher).toBeDefined();

			// Write a file to trigger the watcher
			fs.writeFileSync(`${tempSitePath}/test-change.txt`, "test content");

			// Poll until rebuild message appears or timeout
			const startedAt = Date.now();
			while (
				!messages.some((m) => m.includes("rebuilding...")) &&
				Date.now() - startedAt < 5000
			) {
				await new Promise((resolve) => {
					setTimeout(resolve, 100);
				});
			}

			expect(messages.some((m) => m.includes("rebuilding..."))).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			// Small delay to let any in-flight build finish
			await new Promise((resolve) => {
				setTimeout(resolve, 500);
			});

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			await fs.promises.rm(tempOutput, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should close existing watcher when watch is called again", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-watch-close-existing";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		docula.console.quiet = true;

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);

			const watcher1 = docula.watch(options, builder);
			expect(watcher1).toBeDefined();

			const watcher2 = docula.watch(options, builder);
			expect(watcher2).toBeDefined();
			expect(watcher2).not.toBe(watcher1);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
		}
	});
	it("should ignore changes in the .cache directory", async () => {
		const tempSitePath = "test/temp/watch-ignore-cache";
		const tempOutput = `${tempSitePath}/dist`;

		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});

		const options = new DoculaOptions();
		options.sitePath = tempSitePath;
		options.output = tempOutput;
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			await builder.build();

			// Clear messages from the initial build
			messages.length = 0;

			docula.watch(options, builder);

			// Write a file inside the .cache directory
			fs.mkdirSync(`${tempSitePath}/.cache`, { recursive: true });
			fs.writeFileSync(`${tempSitePath}/.cache/test.json`, "{}");

			// Wait for debounce period
			await new Promise((resolve) => {
				setTimeout(resolve, 1000);
			});

			// Should NOT have triggered a rebuild
			expect(messages.some((m) => m.includes("rebuilding..."))).toBe(false);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			await new Promise((resolve) => {
				setTimeout(resolve, 500);
			});

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should ignore changes in the output directory", async () => {
		const tempSitePath = "test/temp/watch-ignore-output";
		const tempOutput = `${tempSitePath}/dist`;

		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});

		const options = new DoculaOptions();
		options.sitePath = tempSitePath;
		options.output = tempOutput;
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			await builder.build();

			// Clear messages from the initial build
			messages.length = 0;

			docula.watch(options, builder);

			// Write a file inside the output directory
			fs.mkdirSync(tempOutput, { recursive: true });
			fs.writeFileSync(`${tempOutput}/test-output.html`, "<html></html>");

			// Wait for debounce period
			await new Promise((resolve) => {
				setTimeout(resolve, 1000);
			});

			// Should NOT have triggered a rebuild
			expect(messages.some((m) => m.includes("rebuilding..."))).toBe(false);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			await new Promise((resolve) => {
				setTimeout(resolve, 500);
			});

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should handle rebuild errors gracefully", async () => {
		const tempSitePath = "test/temp/watch-error-site";
		const tempOutput = "test/temp/watch-error-output";
		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});

		const options = new DoculaOptions();
		options.sitePath = tempSitePath;
		options.output = tempOutput;
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const consoleError = console.error;
		const messages: string[] = [];
		const errors: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};
		console.error = (message) => {
			if (typeof message === "string") {
				errors.push(message);
			}
		};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			await builder.build();

			// Clear messages from the initial build
			messages.length = 0;
			errors.length = 0;

			// Mock build to throw an error
			builder.build = async () => {
				throw new Error("Build error test");
			};

			docula.watch(options, builder);

			// Modify an existing file to trigger the watcher reliably
			fs.appendFileSync(`${tempSitePath}/README.md`, "\n<!-- trigger -->\n");

			const startedAt = Date.now();
			while (
				!errors.some((m) => m.includes("Rebuild failed:")) &&
				Date.now() - startedAt < 3000
			) {
				await new Promise((resolve) => {
					setTimeout(resolve, 100);
				});
			}

			expect(errors.some((m) => m.includes("Rebuild failed:"))).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			await fs.promises.rm(tempOutput, { recursive: true, force: true });
			console.log = consoleLog;
			console.error = consoleError;
		}
	});
});

describe("docula dev", () => {
	afterEach(() => {
		vi.resetAllMocks();
		for (const fixture of ["test/fixtures/single-page-site"]) {
			fs.rmSync(`${fixture}/.cache/build`, { recursive: true, force: true });
		}
	});
	beforeEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: test file
		(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
			if (url.endsWith("releases")) {
				return { data: githubMockReleases };
			}

			if (url.endsWith("contributors")) {
				return { data: githubMockContributors };
			}

			return { data: {} };
		});
	});

	it("should build, watch, and serve when dev command is used", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-dev-cmd";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "dev", "-p", "8195"];
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeDefined();
			// Verify build was performed
			expect(fs.existsSync(path.join(options.output, "index.html"))).toBe(true);
			// Verify watching message
			expect(
				messages.some((m) =>
					stripAnsi(m).includes("Watching for file changes..."),
				),
			).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});

	it("should build and serve without watch when start command is used", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-start-cmd";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "start", "-p", "8196"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeUndefined();
			expect(fs.existsSync(path.join(options.output, "index.html"))).toBe(true);
		} finally {
			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
		}
	});

	it("should build, watch, and serve when start command is used with --watch", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/docula-start-watch";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "start", "-w", "-p", "8197"];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeDefined();
			expect(fs.existsSync(path.join(options.output, "index.html"))).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
		}
	});
});

describe("docula config file", () => {
	it("should be able to load the config file", async () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		const sitePath = "test/fixtures/multi-page-site";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
	});
	it("should be able to load a typescript config file", async () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		const sitePath = "test/fixtures/single-page-site-ts";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.options.siteTitle).toEqual(
			"Docula TypeScript",
		);
	});
	it("should prefer typescript config over mjs config", async () => {
		// Create a temporary fixture with both config files
		const tempPath = "./temp-both-configs";
		fs.mkdirSync(tempPath, { recursive: true });
		fs.writeFileSync(
			`${tempPath}/docula.config.ts`,
			`export const options = { siteTitle: 'TypeScript Config' };`,
		);
		fs.writeFileSync(
			`${tempPath}/docula.config.mjs`,
			`export const options = { siteTitle: 'MJS Config' };`,
		);

		try {
			const docula = new Docula(defaultOptions);
			docula.console.quiet = true;
			await docula.loadConfigFile(tempPath);
			expect(docula.configFileModule).toBeDefined();
			expect(docula.configFileModule.options.siteTitle).toEqual(
				"TypeScript Config",
			);
		} finally {
			fs.rmSync(tempPath, { recursive: true });
		}
	});
	it("should handle non-existent site path gracefully", async () => {
		const docula = new Docula(defaultOptions);
		docula.console.quiet = true;
		const sitePath = "test/fixtures/non-existent-path";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toEqual({});
	});
	it("should load the config and set the options", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/multi-page-site";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		const consoleLog = console.log;
		let _consoleMessage = "";
		console.log = (message) => {
			if (typeof message === "string") {
				_consoleMessage = message;
			}
		};

		process.argv = ["node", "docula", "version"];
		await docula.execute(process);
		expect(docula.options.output).toEqual(
			path.resolve(process.cwd(), docula.configFileModule.options.output),
		);
		console.log = consoleLog;
	});
	it("should build docs at root when no README.md exists", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/mega-page-site-no-home-page";
		options.autoReadme = false;
		const docula = new Docula(options);
		const output = "test/temp/build-mega-no-home-test";
		docula.console.quiet = true;

		try {
			process.argv = ["node", "docula", "-o", output];
			await docula.execute(process);

			const indexHtml = await fs.promises.readFile(
				`${output}/index.html`,
				"utf8",
			);
			expect(indexHtml).toContain("<title>docula -");
		} finally {
			await fs.promises.rm(output, { recursive: true, force: true });
		}
	});
	it("should load the config and test the onPrepare", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/single-page-site-onprepare";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.onPrepare).toBeDefined();
		const doculaConsole = new DoculaConsole();
		const consoleLog = console.log;
		let consoleMessage = "";
		const originalInfo = doculaConsole.info.bind(doculaConsole);
		doculaConsole.info = (message: string) => {
			consoleMessage = message;
			originalInfo(message);
		};

		await docula.configFileModule.onPrepare(docula.options, doculaConsole);
		expect(consoleMessage).toContain("onPrepare");
		console.info = consoleLog;
	});
	it("should load typescript config and test the onPrepare", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/single-page-site-ts-onprepare";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.onPrepare).toBeDefined();
		const doculaConsole = new DoculaConsole();
		const consoleLog = console.log;
		let consoleMessage = "";
		const originalInfo = doculaConsole.info.bind(doculaConsole);
		doculaConsole.info = (message: string) => {
			consoleMessage = message;
			originalInfo(message);
		};

		await docula.configFileModule.onPrepare(docula.options, doculaConsole);
		expect(consoleMessage).toContain("onPrepare TypeScript");
		console.info = consoleLog;
	});
	it("should throw error onPrepare", async () => {
		const docula = new Docula(defaultOptions);
		docula.options.sitePath = "test/fixtures/single-page-site-error";
		const consoleLog = console.log;
		let _consoleMessage = "";
		console.log = (message) => {
			if (typeof message === "string") {
				_consoleMessage = message;
			}
		};

		const consoleError = console.error;
		let _consoleErrorMessage = "";
		console.error = (message) => {
			if (typeof message === "string") {
				_consoleErrorMessage = message;
			}
		};

		process.argv = ["node", "docula", "version"];
		try {
			await docula.execute(process);
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeDefined();
		}

		console.log = consoleLog;
		console.error = consoleError;
	});

	it("should apply --templatePath flag from CLI args", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/temp/templatepath-test";
		const docula = new Docula(options);
		process.argv = [
			"node",
			"docula",
			"build",
			"-t",
			"test/fixtures/template-example",
		];
		docula.console.quiet = true;

		try {
			await docula.execute(process);
			expect(docula.options.templatePath).toContain(
				"test/fixtures/template-example",
			);
			expect(fs.existsSync(path.join(options.output, "index.html"))).toBe(true);
		} finally {
			await fs.promises.rm(options.output, { recursive: true, force: true });
		}
	});
});
