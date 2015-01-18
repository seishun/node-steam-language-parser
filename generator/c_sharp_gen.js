var code_generator = require('../code_generator');
var symbol_locator = require('../parser/symbol_locator');
var token_analyzer = require('../parser/token_analyzer');
var util = require('util');

var readerTypeMap = {
  byte: 'Byte',
  short: 'Int16',
  ushort: 'UInt16',
  int: 'Int32',
  uint: 'UInt32',
  long: 'Int64',
  ulong: 'UInt64',
  char: 'Char'
};

exports.emitNamespace = function(sb, end, nspace) {
  if (end) {
    sb.push('}');
    sb.push('#pragma warning restore 1591');
    sb.push('#pragma warning restore 0219');
  } else {
    sb.push('#pragma warning disable 1591'); // this will hide 'Missing XML comment for publicly visible type or member 'Type_or_Member''
    sb.push('#pragma warning disable 0219'); // Warning CS0219: The variable `(variable)' is assigned but its value is never used
    sb.push('using System;');
    sb.push('using System.IO;');
    sb.push('using System.Runtime.InteropServices;');
    sb.push('');
    sb.push(util.format('namespace %s', nspace));
    sb.push('{');
  }
};

exports.emitSerialBase = function(sb, level, supportsGC) {
  var padding = Array(level + 1).join('\t');
  
  sb.push(padding + 'public interface ISteamSerializable');
  sb.push(padding + '{');
  sb.push(padding + '\tvoid Serialize(Stream stream);');
  sb.push(padding + '\tvoid Deserialize( Stream stream );');
  sb.push(padding + '}');
  
  sb.push(padding + 'public interface ISteamSerializableHeader : ISteamSerializable');
  sb.push(padding + '{');
  sb.push(padding + '\tvoid SetEMsg( EMsg msg );');
  sb.push(padding + '}');
  
  sb.push(padding + 'public interface ISteamSerializableMessage : ISteamSerializable');
  sb.push(padding + '{');
  sb.push(padding + '\tEMsg GetEMsg();');
  sb.push(padding + '}');
  
  if (supportsGC) {
    sb.push(padding + 'public interface IGCSerializableHeader : ISteamSerializable');
    sb.push(padding + '{');
    sb.push(padding + '\tvoid SetEMsg( uint msg );');
    sb.push(padding + '}');
    
    sb.push(padding + 'public interface IGCSerializableMessage : ISteamSerializable');
    sb.push(padding + '{');
    sb.push(padding + '\tuint GetEMsg();');
    sb.push(padding + '}');
  }
  
  sb.push('');
};

exports.emitType = function(sym) {
  if (sym instanceof symbol_locator.WeakSymbol) {
    return sym.identifier;
  } else if (sym instanceof symbol_locator.StrongSymbol) {
    if (!sym.prop) {
      return sym.class.name;
    } else {
      return sym.class.name + '.' + sym.prop.name;
    }
  }
  
  return 'INVALID';
};

exports.emitMultipleTypes = function(syms, operation) {
  var identList = syms.map(function(sym) { return sym.identifier; });
  return identList.join(' ' + (operation || '|') + ' ');
};

exports.getUpperName = function(name) {
  return name.substr(0, 1).toUpperCase() + name.substr(1);
};

exports.emitNode = function(n, sb, level) {
  if (n instanceof token_analyzer.ClassNode) {
    emitClassNode(n, sb, level);
  } else if (n instanceof token_analyzer.EnumNode) {
    emitEnumNode(n, sb, level);
  }
};

function emitEnumNode(enode, sb, level) {
  var padding = Array(level + 1).join('\t');
  
  if (enode.flags == 'flags')
    sb.push(padding + '[Flags]');
  
  if (enode.type) {
    sb.push(padding + 'public enum ' + enode.name + ' : ' + exports.emitType(enode.type));
  } else {
    sb.push(padding + 'public enum ' + enode.name);
  }
  
  sb.push(padding + '{');
  
  var lastValue = '0';
  
  enode.childNodes.forEach(function(prop) {
    lastValue = exports.emitMultipleTypes(prop.default);
    
    if (prop.obsolete != null) {
      if (prop.obsolete.length > 0)
        sb.push(padding + '\t[Obsolete( "' + prop.obsolete + '" )]');
      else
        sb.push(padding + '\t[Obsolete]');
    }
    sb.push(padding + '\t' + prop.name + ' = ' + lastValue + ',');
  });
  
  sb.push(padding + '}');
}

function emitClassNode(cnode, sb, level) {
  emitClassDef(cnode, sb, level, false);
  
  emitClassIdentity(cnode, sb, level + 1);
  
  var baseSize = emitClassProperties(cnode, sb, level + 1);
  emitClassConstructor(cnode, sb, level + 1);
  
  emitClassSerializer(cnode, sb, level + 1, baseSize);
  emitClassDeserializer(cnode, sb, level + 1, baseSize);
  
  emitClassDef(cnode, sb, level, true);
}

function emitClassDef(cnode, sb, level, end) {
  var padding = Array(level + 1).join('\t');
  
  if (end) {
    sb.push(padding + '}');
    sb.push('');
    return;
  }
  
  var parent = 'ISteamSerializable';
  
  if (cnode.ident) {
    if (~cnode.name.indexOf('MsgGC')) {
      parent = 'IGCSerializableMessage';
    } else {
      parent = 'ISteamSerializableMessage';
    }
  } else if (~cnode.name.indexOf('Hdr')) {
    if (~cnode.name.indexOf('MsgGC'))
      parent = 'IGCSerializableHeader';
    else
      parent = 'ISteamSerializableHeader';
  }
  
  if (~cnode.name.indexOf('Hdr')) {
    sb.push(padding + '[StructLayout( LayoutKind.Sequential )]');
  }
  
  sb.push(padding + 'public class ' + cnode.name + ' : ' + parent);
  sb.push(padding + '{');
}

function emitClassIdentity(cnode, sb, level) {
  var padding = Array(level + 1).join('\t');
  
  if (cnode.ident) {
    var cnodeIdent = cnode.ident;
    var supressObsoletionWarning = false;
    
    if (cnodeIdent instanceof symbol_locator.StrongSymbol) {
      var propNode = cnodeIdent.prop;
      if (propNode instanceof token_analyzer.PropNode && propNode.obsolete != null) {
        supressObsoletionWarning = true;
      }
    }
    
    if (supressObsoletionWarning) {
      sb.push(padding + '#pragma warning disable 0612');
    }
    
    if (~cnode.name.indexOf('MsgGC')) {
      sb.push(padding + 'public uint GetEMsg() { return ' + exports.emitType(cnode.ident) + '; }');
    } else {
      sb.push(padding + 'public EMsg GetEMsg() { return ' + exports.emitType(cnode.ident) + '; }');
    }
    
    if (supressObsoletionWarning) {
      sb.push(padding + '#pragma warning restore 0612');
    }
    
    sb.push('');
  } else if (~cnode.name.indexOf('Hdr')) {
    if (~cnode.name.indexOf('MsgGC')) {
      if (cnode.childNodes.some(function(node) { return node.name == 'msg'; })) {
        sb.push(padding + 'public void SetEMsg( uint msg ) { this.Msg = msg; }');
        sb.push('');
      } else {
        // this is required for a gc header which doesn't have an emsg
        sb.push(padding + 'public void SetEMsg( uint msg ) { }');
        sb.push('');
      }
    } else {
      sb.push(padding + 'public void SetEMsg( EMsg msg ) { this.Msg = msg; }');
      sb.push('');
    }
  }
}

function emitClassProperties(cnode, sb, level) {
  var padding = Array(level + 1).join('\t');
  var baseClassSize = 0;
  
  if (cnode.parent) {
    sb.push(padding + 'public ' + exports.emitType(cnode.parent) + ' Header { get; set; }');
  }
  
  cnode.childNodes.forEach(function(prop) {
    var typestr = exports.emitType(prop.type);
    var propName = exports.getUpperName(prop.name);
    
    if (prop.flags == 'const') {
      sb.push(padding + 'public static readonly ' + typestr + ' ' + propName + ' = ' + exports.emitType(prop.default[0]) + ';');
      return;
    }
    
    var size = code_generator.getTypeSize(prop);
    baseClassSize += size;
    
    sb.push(padding + '// Static size: ' + size);
    
    if (prop.flags == 'steamidmarshal' && typestr == 'ulong') {
      sb.push(padding + util.format('private %s %s;', typestr, prop.name));
      sb.push(padding + 'public SteamID ' + propName + ' { get { return new SteamID( ' + prop.name + ' ); } set { ' + prop.name + ' = value.ConvertToUInt64(); } }');
    } else if (prop.flags == 'boolmarshal' && typestr == 'byte') {
      sb.push(padding + util.format('private %s %s;', typestr, prop.name));
      sb.push(padding + 'public bool ' + propName + ' { get { return ( ' + prop.name + ' == 1 ); } set { ' + prop.name + ' = ( byte )( value ? 1 : 0 ); } }');
    } else if (prop.flags == 'gameidmarshal' && typestr == 'ulong') {
      sb.push(padding + util.format('private %s %s;', typestr, prop.name));
      sb.push(padding + 'public GameID ' + propName + ' { get { return new GameID( ' + prop.name + ' ); } set { ' + prop.name + ' = value.ToUInt64(); } }');
    } else {
      if (prop.flagsOpt && isFinite(prop.flagsOpt)) {
        typestr += '[]';
      }
      
      sb.push(padding + 'public ' + typestr + ' ' + propName + ' { get; set; }');
    }
  });
  
  sb.push('');
  
  return baseClassSize;
}

function emitClassConstructor(cnode, sb, level) {
  var padding = Array(level + 1).join('\t');
  
  sb.push(padding + 'public ' + cnode.name + '()');
  sb.push(padding + '{');
  
  if (cnode.parent) {
    sb.push(padding + '\tHeader = new ' + exports.emitType(cnode.parent) + '();');
    sb.push(padding + '\tHeader.Msg = GetEMsg();');
  }
  
  cnode.childNodes.forEach(function(prop) {
    var defsym = prop.default[0];
    var defflags = prop.flags;
    
    var symname = exports.getUpperName(prop.name);
    var ctor = exports.emitType(defsym);
    
    if (defflags == 'proto') {
      ctor = 'new ' + exports.emitType(prop.type) + '()';
    } else if (!defsym) {
      if (prop.flagsOpt) {
        ctor = 'new ' + exports.emitType(prop.type) + '[' + code_generator.getTypeSize(prop) + ']';
      } else {
        ctor = '0';
      }
    }
    
    if (defflags == 'steamidmarshal' || defflags == 'gameidmarshal' || defflags == 'boolmarshal') {
      symname = prop.name;
    } else if (defflags == 'const') {
      return;
    }
    
    sb.push(padding + '\t' + symname + ' = ' + ctor + ';');
  });
  
  sb.push(padding + '}');
}

function emitClassSerializer(cnode, sb, level, baseSize) {
  var padding = Array(level + 1).join('\t');
  
  sb.push('');
  sb.push(padding + 'public void Serialize(Stream stream)');
  sb.push(padding + '{');
  
  
  // first emit variable length members
  var varLengthProps = [];
  var openedStreams = [];
  varLengthProps.push(baseSize.toString());
  
  if (cnode.parent) {
    sb.push(padding + '.Header.Serialize(stream);');
    varLengthProps.push('(int)msHeader.Length');
    openedStreams.push('msHeader');
    
    sb.push('');
  }
  
  cnode.childNodes.forEach(function(prop) {
    var typestr = exports.emitType(prop.type);
    var size = code_generator.getTypeSize(prop);
    
    if (!size) {
      if (prop.flags == 'proto') {
        if (!baseSize) {
          // early exit
          sb.push(padding + '\tProtoBuf.Serializer.Serialize<' + typestr + '>(stream, ' + exports.getUpperName(prop.name) + ');');
          sb.push(padding + '}');
          return;
        }
        
        sb.push(padding + '\tMemoryStream ms' + exports.getUpperName(prop.name) + ' = new MemoryStream();');
        sb.push(padding + '\tProtoBuf.Serializer.Serialize<' + typestr + '>(ms' + exports.getUpperName(prop.name) + ', ' + exports.getUpperName(prop.name) + ');');
        
        if (prop.flagsOpt != null) {
          sb.push(padding + '\t' + exports.getUpperName(prop.flagsOpt) + ' = (int)ms' + exports.getUpperName(prop.name) + '.Length;');
        }
        
        //sb.push(padding + '.ms' + exports.getUpperName(prop.name) + '.Seek( 0, SeekOrigin.Begin );');
      } else {
        sb.push(padding + '\tMemoryStream ms' + exports.getUpperName(prop.name) + ' = ' + exports.getUpperName(prop.name) + '.serialize();');
      }
      
      varLengthProps.push('(int)ms' + exports.getUpperName(prop.name) + '.Length');
      openedStreams.push( 'ms' + exports.getUpperName(prop.name) );
    }
  });
  
  //sb.push(padding + '.BinaryWriterEx bw = new BinaryWriterEx( stream );');
  //sb.push('');
  sb.push(padding + '\tBinaryWriter bw = new BinaryWriter( stream );');
  sb.push('');
  
  if (cnode.parent) {
    sb.push(padding + '\tmsHeader.CopyTo( msBuffer );');
  }
  
  // next emit writers
  cnode.childNodes.forEach(function(prop) {
    var typecast = '';
    var propName = exports.getUpperName(prop.name);
    
    if (prop.type.class instanceof token_analyzer.EnumNode) {
      var enode = prop.type.class;
      
      if (enode.type instanceof symbol_locator.WeakSymbol)
        typecast = '(' + enode.type.identifier + ')';
      else
        typecast = '(int)';
    }
    
    if (prop.flags) {
      if (prop.flags == 'steamidmarshal' || prop.flags == 'gameidmarshal' || prop.flags == 'boolmarshal' ) {
        propName = prop.name;
      } else if (prop.flags == 'proto') {
        sb.push(padding + '\tbw.Write( ms' + propName + '.ToArray() );');
        return;
      } else if (prop.flags == 'const') {
        return;
      }
    }
    
    if (prop.flags == 'protomask') {
      propName = 'MsgUtil.MakeMsg( ' + propName + ', true )';
    } else if (prop.flags == 'protomaskgc') {
      propName = 'MsgUtil.MakeGCMsg( ' + propName + ', true )';
    }
    
    sb.push(padding + '\tbw.Write( ' + typecast + propName + ' );');
  });
  
  sb.push('');
  
  openedStreams.forEach(function(stream) {
    sb.push(padding + '\t' + stream + '.Close();');
  });
  
  //sb.push('');
  //sb.push(padding + '.msBuffer.Seek( 0, SeekOrigin.Begin );');
  sb.push(padding + '}');
}

function emitClassSize(cnode, sb, level) {
}

function emitClassDeserializer(cnode, sb, level, baseSize) {
  var padding = Array(level + 1).join('\t');
  
  sb.push('');
  sb.push(padding + 'public void Deserialize( Stream stream )');
  sb.push(padding + '{');
  
  if (baseSize > 0) {
    sb.push(padding + '\tBinaryReader br = new BinaryReader( stream );');
    sb.push('');
  }
  
  if (cnode.parent) {
    sb.push(padding + '\tHeader.Deserialize( stream );');
  }
  
  cnode.childNodes.forEach(function(prop) {
    var typestr = exports.emitType(prop.type);
    var size = code_generator.getTypeSize(prop);
    
    var defflags = prop.flags;
    var symname = exports.getUpperName(prop.name);
    
    if (defflags == 'steamidmarshal' || defflags == 'gameidmarshal' || defflags == 'boolmarshal') {
      symname = prop.name;
    } else if (defflags == 'const') {
      return;
    }
    
    if (!size) {
      if (prop.flags == 'proto') {
        if (prop.flagsOpt != null) {
          sb.push(padding + '\tusing( MemoryStream ms' + exports.getUpperName(prop.name) + ' = new MemoryStream( br.ReadBytes( ' + exports.getUpperName(prop.flagsOpt) + ' ) ) )');
          sb.push(padding + '\t\t' + exports.getUpperName(prop.name) + ' = ProtoBuf.Serializer.Deserialize<' + typestr + '>( ms' + exports.getUpperName(prop.name) + ' );');
        } else {
          sb.push(padding + '\t' + exports.getUpperName(prop.name) + ' = ProtoBuf.Serializer.Deserialize<' + typestr + '>( stream );');
        }
      } else {
        sb.push(padding + '\t' + exports.getUpperName(prop.name) + '.Deserialize( stream );');
      }
    } else {
      var typecast = '';
      if (!readerTypeMap[typestr]) {
        typecast = '(' + typestr + ')';
        typestr = code_generator.getTypeOfSize(size, exports.supportsUnsignedTypes());
      }
      
      var call = 'br.Read' + readerTypeMap[typestr] + '()';
      
      if (prop.flagsOpt) {
        call = 'br.Read' + readerTypeMap[typestr] + 's( ' + prop.flagsOpt + ' )';
      }
      
      if (prop.flags == 'protomask') {
        call = 'MsgUtil.GetMsg( (uint)' + call + ' )';
      } else if (prop.flags == 'protomaskgc') {
        call = 'MsgUtil.GetGCMsg( (uint)' + call + ' )';
      }
      
      sb.push(padding + '\t' + symname + ' = ' + typecast + call + ';');
    }
  });
  
  
  sb.push(padding + '}');
}

exports.supportsUnsignedTypes = function() {
  return true;
};

exports.supportsNamespace = function() {
  return true;
};
