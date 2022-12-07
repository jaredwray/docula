const fetch = require('node-fetch');
const algoliasearch = require("algoliasearch");
const Eleventy = require("@11ty/eleventy");

const apiKey = 'API-KEY';

const client = algoliasearch('H1FAIV3INQ', apiKey)
const index = client.initIndex('demo-2');

const elev = new Eleventy( "site", "dist" , {
  configPath: ".eleventy.cjs",
});
elev.toJSON().then((json) => {
  return json;
}).then(function(elements) {
  const contacts = elements.filter((element) => element.url)
    index.saveObjects(contacts, {
      autoGenerateObjectIDIfNotExist: true
    }).then(({ objectIDs }) => {
      console.log(objectIDs);
    });
  })
