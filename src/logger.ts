import winston from 'winston';

const logFormat = winston.format.printf(({level, message}: Record<string, string>) => {
	if (level === 'error') {
		return `[Docula] Error: ${message}`;
	}

	return `[Docula] ${message}`;
});

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				logFormat,
				winston.format.colorize({
					all: true,
				}),
			),
		}),
	],
});

export default logger;
