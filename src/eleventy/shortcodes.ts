import {DateTime} from 'luxon';

export const getYear = (): string => DateTime.local().toUTC().toFormat('yyyy');

export const formatDate = (format: string, date?: Date): string => {
	if (date) {
		return DateTime.fromJSDate(date).toUTC().toFormat(format);
	}

	return DateTime.now().toUTC().toFormat(format);
};
