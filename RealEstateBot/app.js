var util = require('util');
var _ = require('lodash');
var builder = require('botbuilder');
var restify = require('restify');

/// <reference path="../SearchDialogLibrary/index.d.ts" />
var SearchLibrary = require('../SearchDialogLibrary');
var AzureSearch = require('../SearchProviders/azure-search');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});
server.post('/api/messages', connector.listen());

// Bot Storage: Here we register the state storage for your bot. 
// Default store: volatile in-memory store - Only for prototyping!
// We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
// For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
var inMemoryStorage = new builder.MemoryBotStorage();

// Bot with main dialog that triggers search and display its results
var bot = new builder.UniversalBot(connector, [
    function (session) {
        // Trigger Search
        SearchLibrary.begin(session);
    },
    function (session, args) {
        // Process selected search results
        session.send(
            'Done! For future reference, you selected these properties: %s',
            args.selection.map(function (i) { return i.key; }).join(', '));
    }
]).set('storage', inMemoryStorage); // Register in memory storage

// Azure Search
var azureSearchClient = AzureSearch.create('realestate', '82BCF03D2FC9AC7F4E9D7DE1DF3618A5', 'listings');
var realStateResultsMapper = SearchLibrary.defaultResultsMapper(realstateToSearchHit);

// Register Search Dialogs Library with bot
bot.library(SearchLibrary.create({
    multipleSelection: true,
    search: function (query) { return azureSearchClient.search(query).then(realStateResultsMapper); },
    refiners: ['region', 'city', 'type'],
    refineFormatter: function (refiners) {
        return _.zipObject(
            refiners.map(function (r) { return 'By ' + _.capitalize(r); }),
            refiners);
    }
}));

// Maps the AzureSearch RealState Document into a SearchHit that the Search Library can use
function realstateToSearchHit(realstate) {
    return {
        key: realstate.listingId,
        title: util.format('%d bedroom, %d bath in %s, $%s',
            realstate.beds, realstate.baths, realstate.city, realstate.price.toFixed(2)),
        description: realstate.description,
        imageUrl: realstate.thumbnail
    };
}