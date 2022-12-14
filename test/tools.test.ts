import {reportError} from '../src/tools.js';

describe('Tools', () => {
	const errorLog = jest.spyOn(console, 'error').mockImplementation((message: string) => message);

	afterEach(() => {
		errorLog.mockReset();
	});

	it('Tools - Log the error', () => {
		const error = new Error('test error');
		reportError(error);
		expect(errorLog).toBeCalled();
	});

	it('Tools - get Error Message from Error instance', () => {
		const error = new Error('test error');
		reportError(error);
		expect(errorLog).toBeCalledWith('test error');
	});

	it('Tools - report Error from any data', () => {
		const error = 'test error';
		reportError(error);
		expect(errorLog).toBeCalledWith('test error');
	});
});
