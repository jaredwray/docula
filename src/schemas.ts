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
				enum: [],
			},
		},
		imagesPath: {type: 'string'},
		assetsPath: {type: 'string'},
	},
	required: [],
};
