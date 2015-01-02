var string = require('fs').readFileSync('SteamLanguage/steammsg.steamd', { encoding: 'ascii' });

// console.log(tokenList);
console.log(process.version)
var tokenList = require(__dirname + '/parser/language_parser').tokenizeString(string);

var root = require(__dirname + '/parser/token_analyzer').analyze(tokenList);

var rootEnumNode = new Node();