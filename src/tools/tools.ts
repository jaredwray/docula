import logger from '../logger.js';

export const reportError = (error: unknown): void => {
	let message = String(error);
	if (error instanceof Error) {
		message = error.message;
	}

	logger.error(message);
};

export const urlRegex = /^(http(s)?:\/\/.)[-\w@:%.+~#=]{2,256}\.[a-z]{2,6}\b([-\w@:%+.~#?&/=]*)$/g;

