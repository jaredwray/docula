export const squashCallback = (text: string): string => {
	const content = text.toString().toLowerCase();

	// Remove duplicated words
	const words = content.split(' ');
	const deduped = [...(new Set(words))];
	const dedupedString = deduped.join(' ');

	// Remove repeated spaces
	return dedupedString.replace(/ {2,}/g, ' ');
};
