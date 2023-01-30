import logger from '../src/logger.js';
import {reportError} from '../src/tools/tools.js';

describe('Logger', () => {
	beforeEach(() => {
		jest.spyOn(logger, 'info');
		jest.spyOn(logger, 'error');
	});

	it('Logger - Error log', () => {
		const error = new Error('Test error');
		reportError(error);
		expect(logger.error).toHaveBeenCalledWith('Test error');
	});

	it('Logger - Info log', () => {
		const infoMessage = 'This is an welcome message';

		logger.info(infoMessage);
		// Check that the error message has the correct format
		expect(logger.info).toHaveBeenCalledWith(infoMessage);
	});
});
