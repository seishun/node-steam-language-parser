var fs = require('fs');
var token_analyzer = require(__dirname + '/parser/token_analyzer');

var projectPath = process.env.SteamRE || process.argv[2];

if (!fs.existsSync(projectPath)) {
  throw new Error("Unable to find SteamRE project path, please specify the `SteamRE` environment variable");
}

parseFile(projectPath, 'Resources/SteamLanguage', 'steammsg.steamd', 'SteamKit2', 'SteamKit2/SteamKit2/Base/Generated/', 'SteamLanguage', true, require('./generator/c_sharp_gen'), 'cs');

function parseFile(projectPath, path, file, nspace, outputPath, outFile, supportsGC, codeGen, fileNameSuffix) {
  var languagePath = require('path').join(projectPath, path);
  
  process.chdir(languagePath);
  var tokenList = require('./parser/language_parser').tokenizeString(fs.readFileSync(require('path').join(languagePath, file), { encoding: 'ascii' }));
  
  var root = token_analyzer.analyze(tokenList);

  var rootEnumNode = new token_analyzer.Node();
  var rootMessageNode = new token_analyzer.Node();

  rootEnumNode.childNodes = root.childNodes.filter( function(n) { return n instanceof token_analyzer.EnumNode; });
  rootMessageNode.childNodes = root.childNodes.filter( function(n) { return n instanceof token_analyzer.ClassNode; });
  
  var enumBuilder = [];
  var messageBuilder = [];
  
  require('./code_generator').emitCode(rootEnumNode, codeGen, enumBuilder, nspace, supportsGC, false);
  require('./code_generator').emitCode(rootMessageNode, codeGen, messageBuilder, nspace + '.Internal', supportsGC, true);
  
  var outputEnumFile = require('path').join(outputPath, outFile + '.' + fileNameSuffix);
  var outputMessageFile = require('path').join(outputPath, outFile + 'Internal.' + fileNameSuffix);
  
  fs.writeFileSync(require('path').join(projectPath, outputEnumFile), enumBuilder.join('\r\n') + '\r\n');
  fs.writeFileSync(require('path').join(projectPath, outputMessageFile), messageBuilder.join('\r\n') + '\r\n');
}
