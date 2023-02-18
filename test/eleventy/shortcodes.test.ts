import {getYear, formatDate, parseRelease} from '../../src/eleventy/shortcodes.js';

describe('shortcodes', () => {
	test('getYear returns the current year', () => {
		const expectedYear = new Date().getFullYear();
		const year = getYear();
		expect(year).toBe(expectedYear.toString());
	});

	test('formatDate formats a date correctly', () => {
		const date = new Date('2022-01-01T00:00:00.000Z').toISOString();
		const format = 'yyyy-MM-dd';
		const expectedDateString = '2022-01-01';
		const formattedDate = formatDate(format, date);
		expect(formattedDate).toBe(expectedDateString);
	});

	test('formatDate returns the current date if no date is provided', () => {
		const format = 'yyyy-MM-dd';
		const expectedDateString = new Date().toISOString().slice(0, 10);
		const formattedDate = formatDate(format);
		expect(formattedDate).toBe(expectedDateString);
	});

	test('parseRelease returns html based on md file', () => {
		const md = '# Title';
		const result = parseRelease(md);
		expect(result).toEqual(`<h1>Title</h1>
`);
	});
});
