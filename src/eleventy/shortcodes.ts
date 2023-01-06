import {DateTime} from 'luxon';
import MarkdownIt from 'markdown-it';

export const getYear = (): string => DateTime.local().toUTC().toFormat('yyyy');

export const formatDate = (format: string, date?: Date): string => {
	if (date) {
		return DateTime.fromJSDate(date).toUTC().toFormat(format);
	}

	return DateTime.now().toUTC().toFormat(format);
};

export const parseRelease = (content: string) => {
	const md = new MarkdownIt({
		html: true,
		linkify: true,
		typographer: true,
	});
	return md.render(content);
};
