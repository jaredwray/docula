const fetch = require('node-fetch');
const algoliasearch = require("algoliasearch");

const apiKey = 'API-KEY';

const client = algoliasearch('H1FAIV3INQ', apiKey)
const index = client.initIndex('demo');


fetch('http://localhost:8080/search.json')
  .then(function(response) {
    return response.json()
  })
  .then(function(contacts) {
    index.saveObjects(contacts, {
      autoGenerateObjectIDIfNotExist: true
    }).then(({ objectIDs }) => {
      console.log(objectIDs);
    });
  })
