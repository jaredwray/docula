export const getGithubInfo = jest.fn(() => ({
	author: 'jaredwray',
	repo: 'docula',
}));

export const validateUrl = jest.fn(() => true);

export const getSiteUrl = jest.fn(() => 'https://www.example.com');

export const getUserPlugins = jest.fn(() => ['robots.txt', 'npm']);

export const parsePluginsData = jest.fn((plugins: string[]) => ({
	plugins: ['github'],
	github: {
		author: 'jaredwray',
		repo: 'docula',
	},
}));
