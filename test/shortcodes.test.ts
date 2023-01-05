import {parseRelease, formatDate} from '../src/eleventy/shortcodes.js';

describe('Eleventy shortcodes', () => {
	it('parseRelease shortcode', () => {
		const md = '# Title';
		const result = parseRelease(md);
		expect(result).toEqual(`<h1>Title</h1>
`);
	});

	it('formatDate - formats a given date according to the specified format ', () => {
		const date = new Date('2022-01-01T00:00:00');
		const format = 'yyyy/MM/dd';
		expect(formatDate(format, date)).toBe('2022/01/01');
	});
});
