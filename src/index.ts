import {createCommand, type OptionValues} from 'commander';
import {Docula} from './docula.js';
import {reportError} from './tools.js';

export type CommanderOptions = {
	opts: () => OptionValues;
};

export class Executable {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	async parseCLI(process: NodeJS.Process) {
		const program = createCommand();

		program.storeOptionsAsProperties(true);

		program.command('build', {isDefault: true})
			.description('Build the site')
			.option('-c, --config <config>', 'Path of where the config file is located')
			.action(async (options: CommanderOptions) => {
				try {
					const docula = new Docula(options);
					await docula.build();
				} catch (error: unknown) {
					reportError(error);
				}
			});

		program.command('template')
			.action(async (options: CommanderOptions) => {
				try {
					console.log('Demo');
				} catch (error: unknown) {
					reportError(error);
				}
			});

		program.parse(process.argv);
	}
}
