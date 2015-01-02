exports.Token = function(name, value) {
  this.name = name;
  this.value = value;
};

var pattern =
  '(\\s+)|' + // whitespace
  '([;])|' + // terminator
  
  '["](.+?)["]|' + // string
  
  '//(.*)$|' + // comment
  
  '(-?[a-zA-Z_0-9][a-zA-Z0-9_:.]*)|' + // identifier
  '[#]([a-zA-Z]*)|' + // preprocess
  
  '([{}<>\\]=|])|' + // operator
  '([^\\s]+)'; // invalid

var groupNames = [
  , 'whitespace'
  , 'terminator'
  , 'string'
  , 'comment'
  , 'identifier'
  , 'preprocess'
  , 'operator'
  , 'invalid'
];

var regexPattern = new RegExp(pattern, 'gm');

exports.tokenizeString = function(buffer) {
  var match;

  var tokenList = [];
  while ((match = regexPattern.exec(buffer))) {
    var i = 0;
    match.forEach(function(group) {
      if (group && i > 1) {
        var groupName = groupNames[i];
        
        if (groupName == 'comment')
          return; // don't create tokens for comments
        
        tokenList.push(new exports.Token(groupName, group));
      }
      i++;
    });
  }
  
  return tokenList;
};
