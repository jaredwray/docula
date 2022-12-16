export const reportError = (error: unknown): void => {
	let message = String(error);
	if (error instanceof Error) {
		message = error.message;
	}

	console.error(message);
};
