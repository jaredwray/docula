import path from "node:path";
import process from "node:process";

export class DoculaConsole {
	log(message: string): void {
		console.log(message);
	}

	error(message: string): void {
		console.error(message);
	}

	warn(message: string): void {
		console.warn(message);
	}

	printHelp(): void {
		console.log("   Usage: docula [command] [arguments]");
		console.log();
		console.log("   Commands:");
		console.log("     init           Initialize a new project");
		console.log(
			"     build          Build the project. By default just npx docula will build the project if it finds a ./site folder",
		);
		console.log("     serve          Serve the project as a local website");
		console.log("     help           Print this help");
		console.log("     version        Print the version");
		console.log();
		console.log("   Arguments init:");
		console.log(
			"     --typescript       Generate TypeScript config file (docula.config.ts)",
		);
		console.log(
			"     -s, --site         Set the path where site files are located",
		);
		console.log();
		console.log("   Arguments build:");
		console.log("     -w, --watch            watch for changes and rebuild");
		console.log(
			"     -c, --clean            Clean the output directory before building",
		);
		console.log(
			"     -s, --site             Set the path where site files are located",
		);
		console.log(
			"     -o, --output           Set the output directory. Default is ./site/dist",
		);
		console.log("     -t, --templatePath     Set the custom template to use");
		console.log(
			"     -T, --template         Set the built-in template name (e.g., modern, classic)",
		);
		console.log();
		console.log("   Arguments serve:");
		console.log("     -p, --port         Set the port number used with serve");
		console.log("     -b, --build        Build the site before serving");
		console.log("     -w, --watch        watch for changes and rebuild");
		console.log(
			"     -c, --clean        Clean the output directory before building",
		);
		console.log(
			"     -s, --site         Set the path where site files are located",
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

				case "help": {
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
};
