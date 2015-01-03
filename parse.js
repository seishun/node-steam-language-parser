var token_analyzer = require(__dirname + '/parser/token_analyzer');

var string = require('fs').readFileSync(__dirname + '/SteamLanguage/steammsg.steamd', { encoding: 'ascii' });

var tokenList = require(__dirname + '/parser/language_parser').tokenizeString(string);

var root = token_analyzer.analyze(tokenList);

var rootEnumNode = new token_analyzer.Node();

