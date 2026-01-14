import { describe, expect, it } from "vitest";
import { DoculaConsole } from "../src/console.js";

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
	it("should be able to log error", () => {
		const consoleLog = console.error;
		console.error = (message) => {
			expect(message).toEqual("Hello World");
		};

		const c = new DoculaConsole();
		c.error("Hello World");
		console.error = consoleLog;
	});
	it("should be able to log error", () => {
		const consoleLog = console.warn;
		console.warn = (message) => {
			expect(message).toEqual("Hello World");
		};

		const c = new DoculaConsole();
		c.warn("Hello World");
		console.warn = consoleLog;
	});
	it("should be able to print help", () => {
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			messages.push(message as string);
		};

		const c = new DoculaConsole();
		c.printHelp();
		expect(messages.length).toEqual(23);

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
});
