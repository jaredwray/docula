export const jsonConfigSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		originPath: {type: 'string'},
		outputPath: {type: 'string'},
		dataPath: {type: 'string'},
		templatePath: {type: 'string'},
		searchEngine: {type: 'string', enum: ['algolia', null]},
		plugins: {
			type: 'array',
			items: {
				type: 'string',
				enum: ['github', 'npm', 'algolia'],
			},
		},
		algolia: {
			type: 'object',
			required: ['appId', 'apiKey', 'indexName'],
			properties: {
				appId: {type: 'string'},
				apiKey: {type: 'string'},
				indexName: {type: 'string'},
			},
		},
		github: {
			type: 'object',
			required: ['repo', 'author'],
			properties: {
				repo: {type: 'string'},
				author: {type: 'string'},
			},
		},
		npm: {
			type: 'object',
			required: ['moduleName'],
			properties: {
				moduleName: {type: 'string'},
			},
		},
		imagesPath: {type: 'string'},
		assetsPath: {type: 'string'},
	},
};
