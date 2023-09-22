// GetConfig.test.js
import {Config} from '../../src/config.js';
import {getConfig} from '../../src/eleventy/global-data.js';

test('getConfig should return the config object passed to it', () => {
	const mockConfig = new Config();
	const result = getConfig(mockConfig);

	expect(result).toBe(mockConfig);
});
