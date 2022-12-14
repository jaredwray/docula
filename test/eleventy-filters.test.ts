import {squashCallback} from '../src/eleventy/filters.js';

describe('Eleventy Filters', () => {
	it('Eleventy Filters - squash', () => {
		const squashedText = squashCallback('Hello  Word');
		expect(squashedText).toBe('hello word');
	});
});
