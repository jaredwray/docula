import logger from './logger.js';

export const reportError = (error: unknown): void => {
	let message = String(error);
	if (error instanceof Error) {
		message = error.message;
	}

	logger.error(message);
};
