import path from "node:path";
import process from "node:process";
import {
	blue,
	bold,
	cyan,
	dim,
	gray,
	green,
	magenta,
	red,
	yellow,
} from "colorette";

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI escape codes
const ansiRegex = /\u001B\[[0-9;]*m/g;

export class DoculaConsole {
	log(message: string): void {
		console.log(message);
	}

	error(message: string): void {
		console.error(red(bold(`\u2718 [error] ${message}`)));
	}

	warn(message: string): void {
		console.warn(yellow(`\u26A0 [warn] ${message}`));
	}

	success(message: string): void {
		console.log(green(bold(`\u2714 ${message}`)));
	}

	info(message: string): void {
		console.log(cyan(`\u2139 ${message}`));
	}

	step(message: string): void {
		console.log(bold(blue(`\u25B6 ${message}`)));
	}

	fileBuilt(filePath: string): void {
		console.log(dim(`  \u2192 ${filePath}`));
	}

	fileCopied(filePath: string): void {
		this.fileBuilt(filePath);
	}

	serverLog(
		method: string,
		url: string,
		statusCode: number,
		durationMs?: number,
	): void {
		let statusColor = green;
		if (statusCode >= 400) {
			statusColor = red;
		} else if (statusCode >= 300) {
			statusColor = yellow;
		}

		const sanitizedMethod = method.replace(ansiRegex, "");
		const sanitizedUrl = url.replace(ansiRegex, "");
		const parts = [
			`  ${bold(sanitizedMethod)}`,
			sanitizedUrl,
			statusColor(String(statusCode)),
		];
		if (durationMs !== undefined) {
			parts.push(gray(`${durationMs}ms`));
		}

		console.log(parts.join(" "));
	}

	banner(message: string): void {
		console.log(bold(magenta(message)));
	}

	printHelp(): void {
		console.log(
			bold(
				magenta(
					"\n  Docula \uD83E\uDD87 \u2014 Beautiful Website for Your Projects\n",
				),
			),
		);
		console.log(bold(cyan("  Usage:")));
		console.log("    docula [command] [arguments]");
		console.log();
		console.log(bold(cyan("  Commands:")));
		console.log(`    ${green("init")}           Initialize a new project`);
		console.log(
			`    ${green("build")}          Build the project. By default just npx docula will build the project if it finds a ./site folder`,
		);
		console.log(
			`    ${green("serve")}          Serve the project as a local website`,
		);
		console.log(
			`    ${green("start")}          Build, watch, and serve the site`,
		);
		console.log(`    ${green("help")}           Print this help`);
		console.log(`    ${green("version")}        Print the version`);
		console.log();
		console.log(bold(cyan("  Common Options:")));
		console.log(
			`    ${yellow("-s, --site")}             Set the path where site files are located`,
		);
		console.log(
			`    ${yellow("-c, --clean")}            Clean the output directory before building`,
		);
		console.log(
			`    ${yellow("-o, --output")}           Set the output directory. Default is ./site/dist`,
		);
		console.log(
			`    ${yellow("-p, --port")}             Set the port number used with serve`,
		);
		console.log(
			`    ${yellow("-w, --watch")}            Watch for changes and rebuild`,
		);
		console.log();
		console.log(bold(cyan("  Init Options:")));
		console.log(
			`    ${yellow("--typescript")}           Generate TypeScript config file (docula.config.ts)`,
		);
		console.log(
			`    ${yellow("--javascript")}           Generate JavaScript config file (docula.config.mjs)`,
		);
		console.log();
		console.log(bold(cyan("  Build Options:")));
		console.log(
			`    ${yellow("-t, --templatePath")}     Set the custom template to use`,
		);
		console.log(
			`    ${yellow("-T, --template")}         Set the built-in template name (e.g., modern, classic)`,
		);
		console.log();
		console.log(bold(cyan("  Serve Options:")));
		console.log(
			`    ${yellow("-b, --build")}            Build the site before serving`,
		);
	}

	public parseProcessArgv(argv: string[]): DoculaConsoleProcess {
		const command = this.getCommand(argv);
		const arguments_ = this.getArguments(argv);
		return {
			argv,
			command,
			args: arguments_,
		};
	}

	public getCommand(argv: string[]): string | undefined {
		for (const argument of argv) {
			switch (argument) {
				case "init": {
					return "init";
				}

				case "build": {
					return "build";
				}

				case "serve": {
					return "serve";
				}

				case "start": {
					return "start";
				}

				case "help":
				case "-h":
				case "--help": {
					return "help";
				}

				case "version": {
					return "version";
				}
			}
		}
	}

	public getArguments(argv: string[]): DoculaConsoleArguments {
		const arguments_: DoculaConsoleArguments = {
			sitePath: "",
			templatePath: "",
			template: "",
			output: "",
			watch: false,
			clean: false,
			build: false,
			port: undefined,
			typescript: false,
			javascript: false,
		};
		for (let i = 0; i < argv.length; i++) {
			const argument = argv[i];

			switch (argument) {
				case "-p":
				case "--port": {
					const portString = argv[i + 1];
					/* v8 ignore next -- @preserve */
					if (portString !== undefined) {
						arguments_.port = Number.parseInt(portString, 10);
					}

					break;
				}

				case "-o":
				case "--output": {
					arguments_.output = argv[i + 1];
					arguments_.output = path.join(process.cwd(), arguments_.output);
					break;
				}

				case "-w":
				case "--watch": {
					arguments_.watch = true;
					break;
				}

				case "-c":
				case "--clean": {
					arguments_.clean = true;
					break;
				}

				case "-b":
				case "--build": {
					arguments_.build = true;
					break;
				}

				case "-s":
				case "--site": {
					arguments_.sitePath = argv[i + 1];
					arguments_.sitePath = path.join(process.cwd(), arguments_.sitePath);
					break;
				}

				case "-t":
				case "--templatePath": {
					arguments_.templatePath = argv[i + 1];
					arguments_.templatePath = path.join(
						process.cwd(),
						arguments_.templatePath,
					);
					break;
				}

				case "-T":
				case "--template": {
					arguments_.template = argv[i + 1];
					break;
				}

				case "--typescript": {
					arguments_.typescript = true;
					break;
				}

				case "--javascript": {
					arguments_.javascript = true;
					break;
				}
			}
		}

		return arguments_;
	}
}

type DoculaConsoleProcess = {
	argv: string[];
	command: string | undefined;
	args: DoculaConsoleArguments;
};

type DoculaConsoleArguments = {
	sitePath: string | undefined;
	templatePath: string | undefined;
	template: string | undefined;
	output: string | undefined;
	watch: boolean;
	clean: boolean;
	build: boolean;
	port: number | undefined;
	typescript: boolean;
	javascript: boolean;
};
