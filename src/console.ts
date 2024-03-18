import path from 'node:path';
import process from 'node:process';

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
		console.log('   Usage: docula [command] [arguments]');
		console.log();
		console.log('   Commands:');
		console.log('     init           Initialize a new project');
		console.log('     build          Build the project. By default just npx docula will build the project if it finds a ./site folder');
		console.log('     serve          Serve the project as a local website');
		console.log('     help           Print this help');
		console.log('     version        Print the version');
		console.log();
		console.log('   Arguments Build:');
		console.log('     -w, --watch            watch for changes and rebuild');
		console.log('     -s, --site             Set the path where site files are located');
		console.log('     -o, --outputPath       Set the output directory. Default is ./site/dist');
		console.log('     -t, --templatePath     Set the custom template to use');
		console.log();
		console.log('   Arguments serve:');
		console.log('     -p, --port         Set the port number used with serve');
		console.log('     -w, --watch        watch for changes and rebuild');
		console.log('     -s, --site         Set the path where site files are located');
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
		let result;
		for (const argument of argv) {
			// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
			switch (argument) {
				case 'init': {
					result = 'init';
					break;
				}

				case 'build': {
					result = 'build';
					break;
				}

				case 'serve': {
					result = 'serve';
					break;
				}

				case 'help': {
					result = 'help';
					break;
				}

				case 'version': {
					result = argument;
					break;
				}
			}
		}

		return result;
	}

	public getArguments(argv: string[]): DoculaConsoleArguments {
		const arguments_ = {
			sitePath: '',
			templatePath: '',
			output: '',
			watch: false,
			port: 3000,
		};
		for (let i = 0; i < argv.length; i++) {
			const argument = argv[i];

			// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
			switch (argument) {
				case '-p':
				case '--port': {
					const portString = argv[i + 1];
					if (portString !== undefined) {
						arguments_.port = Number.parseInt(portString, 10);
					}

					break;
				}

				case '-o':
				case '--output': {
					arguments_.output = argv[i + 1];
					arguments_.output = path.join(process.cwd(), arguments_.output);
					break;
				}

				case '-w':
				case '--watch': {
					arguments_.watch = true;
					break;
				}

				case '-s':
				case '--site': {
					arguments_.sitePath = argv[i + 1];
					arguments_.sitePath = path.join(process.cwd(), arguments_.sitePath);
					break;
				}

				case '-t':
				case '--templatePath': {
					arguments_.templatePath = argv[i + 1];
					arguments_.templatePath = path.join(process.cwd(), arguments_.templatePath);
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
	output: string | undefined;
	watch: boolean;
	port: number;
};

