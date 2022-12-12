// eslint-disable-next-line unicorn/prefer-module
const algoliasearch = require('algoliasearch');
// eslint-disable-next-line unicorn/prefer-module
const Eleventy = require('@11ty/eleventy');

const apiKey = 'API-KEY';

const client = algoliasearch('H1FAIV3INQ', apiKey);
const index = client.initIndex('demo-2');

const elev = new Eleventy('site', 'dist', {
	configPath: '.eleventy.cjs',
});
// eslint-disable-next-line unicorn/prefer-top-level-await
elev.toJSON().then(json => json).then(elements => {
	const contacts = elements.filter(element => element.url);
	index.saveObjects(contacts, {
		autoGenerateObjectIDIfNotExist: true,
	}).then(({objectIDs}) => {
		console.log(objectIDs);
	});
});
