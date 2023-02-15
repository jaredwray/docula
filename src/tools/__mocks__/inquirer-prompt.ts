export const getGithubInfo = jest.fn(() => ({
	author: 'jaredwray',
	repo: 'docula',
}));

export const validateUrl = jest.fn(() => true);

export const getSiteUrl = jest.fn(() => 'https://www.example.com');

export const getUserPlugins = jest.fn(() => ({
	plugins: ['robots.txt', 'npm'],
}));

export const setPlugins = jest.fn(() => ({
	siteUrl: 'https://www.example.com',
	searchEngine: 'pagefind',
	plugins: ['github'],
	github: {
		author: 'jaredwray',
		repo: 'docula',
	},
}));
