function StrongSymbol(classNode, prop) {
  this.class = classNode;
  this.prop = prop;
}

function WeakSymbol(ident) {
  this.identifier = ident;
}

var identifierPattern = '([a-zA-Z0-9_:]*)';
var fullIdentPattern = '([a-zA-Z0-9_]*?)::([a-zA-Z0-9_]*)';

var identifierRegex = new RegExp(identifierPattern);
var fullIdentRegex = new RegExp(fullIdentPattern);

function findNode(tree, symbol) {
  return tree.childNodes.filter(function(child) { return child.name == symbol; })[0];
}

exports.lookupSymbol = function(tree, identifier, strongonly) {
  var ident = identifierRegex.exec(identifier);
  
  if (!ident) {
    throw new Error("Invalid identifier specified " + identifier);
  }
  
  var classNode;
  
  if (!~identifier.indexOf('::')) {
    classNode = findNode(tree, ident[0]);
    
    if (!classNode) {
      if (strongonly) {
        throw new Error("Invalid weak symbol " + identifier);
      } else {
        return new WeakSymbol(identifier);
      }
    } else {
      return new StrongSymbol(classNode);
    }
  } else {
    ident = fullIdentRegex.exec(identifier);
    
    if (!ident) {
      throw new Error("Couldn't parse full identifier");
    }
    
    classNode = findNode(tree, ident[1]);
    
    if (!classNode) {
      throw new Error("Invalid class in identifier " + identifier);
    }
    
    var propNode = findNode(classNode, ident[2]);
    
    if (!propNode) {
      throw new Error("Invalid property in identifier " + identifier);
    }
    
    return new StrongSymbol(classNode, propNode);
  }
  
  throw new Error("Invalid symbol");
};
