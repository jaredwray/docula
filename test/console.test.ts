import { describe, expect, it } from "vitest";
import { DoculaConsole } from "../src/console.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI escape codes
const ansiRegex = /\u001B\[[0-9;]*m/g;
function stripAnsi(str: string): string {
	return str.replace(ansiRegex, "");
}

describe("DoculaConsole", () => {
	it("should be able to log", () => {
		const consoleLog = console.log;
		console.log = (message) => {
			expect(message).toEqual("Hello World");
		};

		const c = new DoculaConsole();
		c.log("Hello World");
		console.log = consoleLog;
	});
	it("should be able to log error with color and prefix", () => {
		const consoleLog = console.error;
		let captured = "";
		console.error = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.error("Hello World");
		expect(stripAnsi(captured)).toContain("[error]");
		expect(stripAnsi(captured)).toContain("Hello World");
		console.error = consoleLog;
	});
	it("should be able to log warn with color and prefix", () => {
		const consoleLog = console.warn;
		let captured = "";
		console.warn = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.warn("Hello World");
		expect(stripAnsi(captured)).toContain("[warn]");
		expect(stripAnsi(captured)).toContain("Hello World");
		console.warn = consoleLog;
	});
	it("should be able to log success", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.success("Done!");
		expect(stripAnsi(captured)).toContain("Done!");
		expect(stripAnsi(captured)).toContain("\u2714");
		console.log = consoleLog;
	});
	it("should be able to log info", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.info("Some info");
		expect(stripAnsi(captured)).toContain("Some info");
		expect(stripAnsi(captured)).toContain("\u2139");
		console.log = consoleLog;
	});
	it("should be able to log step", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.step("Building pages...");
		expect(stripAnsi(captured)).toContain("Building pages...");
		expect(stripAnsi(captured)).toContain("\u25B6");
		console.log = consoleLog;
	});
	it("should be able to log fileBuilt", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.fileBuilt("index.html");
		expect(stripAnsi(captured)).toContain("index.html");
		expect(stripAnsi(captured)).toContain("\u2192");
		console.log = consoleLog;
	});
	it("should be able to log fileCopied", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.fileCopied("favicon.ico");
		expect(stripAnsi(captured)).toContain("favicon.ico");
		expect(stripAnsi(captured)).toContain("\u2192");
		console.log = consoleLog;
	});
	it("should be able to log serverLog with 2xx status", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.serverLog("GET", "/docs", 200, 12);
		const plain = stripAnsi(captured);
		expect(plain).toContain("GET");
		expect(plain).toContain("/docs");
		expect(plain).toContain("200");
		expect(plain).toContain("12ms");
		console.log = consoleLog;
	});
	it("should be able to log serverLog with 3xx status", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.serverLog("GET", "/old", 301);
		const plain = stripAnsi(captured);
		expect(plain).toContain("301");
		console.log = consoleLog;
	});
	it("should be able to log serverLog with 4xx status", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.serverLog("GET", "/missing", 404, 5);
		const plain = stripAnsi(captured);
		expect(plain).toContain("404");
		console.log = consoleLog;
	});
	it("should be able to log banner", () => {
		const consoleLog = console.log;
		let captured = "";
		console.log = (message) => {
			captured = message as string;
		};

		const c = new DoculaConsole();
		c.banner("Docula running");
		expect(stripAnsi(captured)).toContain("Docula running");
		console.log = consoleLog;
	});
	it("should be able to print help", () => {
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			messages.push(message as string);
		};

		const c = new DoculaConsole();
		c.printHelp();
		expect(messages.length).toEqual(29);
		expect(messages.some((m) => m && stripAnsi(m).includes("Docula"))).toBe(
			true,
		);
		expect(messages.some((m) => m && stripAnsi(m).includes("Commands:"))).toBe(
			true,
		);

		console.log = consoleLog;
	});
	it("should be able to parse process argv", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv([
			"node",
			"docula",
			"build",
			"-w",
			"-s",
			"./site",
			"-o",
			"./site/dist",
			"-p",
			"8080",
			"-t",
			"./site/template",
		]);
		expect(result.argv.length).toEqual(12);
		expect(result.command).toEqual("build");
		expect(result.args.watch).toEqual(true);
		expect(result.args.templatePath).toContain("/site/template");
		expect(result.args.sitePath).toContain("/site");
		expect(result.args.output).toContain("/site/dist");
		expect(result.args.port).toEqual(8080);
	});
	it("should be able to parse process templatePath", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv([
			"node",
			"docula",
			"build",
			"--templatePath",
			"./site/dist",
			"-p",
			"8080",
		]);
		expect(result.command).toEqual("build");
		expect(result.args.templatePath).toContain("/site/dist");
	});
	it("should be able to parse serve", () => {
		const c = new DoculaConsole();
		const commands = ["serve", "build", "help", "version", "init"];
		for (const command of commands) {
			const result = c.parseProcessArgv(["node", "docula", command]);
			expect(result.command).toEqual(command);
		}
	});
	it("should be able to parse --typescript flag", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv([
			"node",
			"docula",
			"init",
			"--typescript",
		]);
		expect(result.command).toEqual("init");
		expect(result.args.typescript).toEqual(true);
	});
	it("should default typescript to false when not provided", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "init"]);
		expect(result.command).toEqual("init");
		expect(result.args.typescript).toEqual(false);
	});
	it("should parse -T flag for template name", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv([
			"node",
			"docula",
			"build",
			"-T",
			"modern",
		]);
		expect(result.command).toEqual("build");
		expect(result.args.template).toEqual("modern");
	});
	it("should parse --template flag for template name", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv([
			"node",
			"docula",
			"build",
			"--template",
			"modern",
		]);
		expect(result.command).toEqual("build");
		expect(result.args.template).toEqual("modern");
	});
	it("should parse -c flag for clean", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "build", "-c"]);
		expect(result.command).toEqual("build");
		expect(result.args.clean).toEqual(true);
	});
	it("should parse --clean flag for clean", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "build", "--clean"]);
		expect(result.command).toEqual("build");
		expect(result.args.clean).toEqual(true);
	});
	it("should default clean to false when not provided", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "build"]);
		expect(result.command).toEqual("build");
		expect(result.args.clean).toEqual(false);
	});
	it("should parse -b flag for build", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "serve", "-b"]);
		expect(result.command).toEqual("serve");
		expect(result.args.build).toEqual(true);
	});
	it("should parse --build flag for build", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "serve", "--build"]);
		expect(result.command).toEqual("serve");
		expect(result.args.build).toEqual(true);
	});
	it("should default build to false when not provided", () => {
		const c = new DoculaConsole();
		const result = c.parseProcessArgv(["node", "docula", "serve"]);
		expect(result.command).toEqual("serve");
		expect(result.args.build).toEqual(false);
	});
});
