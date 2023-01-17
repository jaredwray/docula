import {createCommand, type OptionValues} from 'commander';
import {Docula} from './docula.js';
import {reportError} from './tools.js';
import logger from './logger.js';

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
					logger.info('Building your documentation...');
					const docula = new Docula(options);
					await docula.build();
					logger.info('Site was built successfully!');
				} catch (error: unknown) {
					reportError(error);
				}
			});

		program.command('init')
			.description('Initialize the site')
			.action(async (options: CommanderOptions) => {
				try {
					logger.info('Initializing Docula...');
					const docula = new Docula(options);
					docula.init();
				} catch (error: unknown) {
					reportError(error);
				}
			});

		program.parse(process.argv);
	}
}
