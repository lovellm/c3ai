/**
 * WIP - NOT COMPLETE
 * Retrieves Documentation for the type and then parses it
 * into a simplified format.
 * @param {string} typeName A Type Name
 * @returns Object with information.
 */
function parseType(typeName) { 
  var raw = DocumentationParser.parseType(typeName);
  if ( !raw.documentation ) { return {}; }
  raw = raw.documentation;
  var info = {};
  //Copy basic information
  info.name = raw.name;
  info.persistable = raw.persist === 'entity';
  info.description = raw.source || '';
  info.deprecated = raw.deprecated || false;
  //Hold other information
  info.fields = [];
  info.methods = [];
  info.inherits = {};
  //Get relevant annotation information
  _.each(raw.annotationDoc, function(a,i) {
    //Only care about db annotations
    if ( a.name !== 'db' ) { return; }
    //Only care about index definitions
    if ( !a.attributes || !a.attributes.index ) { return; }
    var def = a.attributes.index;
    //Remove enclosing [].
    if ( def[0] === '[' ) { def = def.substring(1,def.length-1); }
    //Assuming starts/ends with quotes, remove them
    def = def.substring(1,def.length-1);
    //Split. Assume comma seperated with each item enclosed in quotes.
    info.index = def.split(/['"]\s*,\s*['"]/);
  });
  //Process the fields
  _.each(raw.fieldTypeDoc, function(f,i) {
    if ( f.kind === 'DATA_FIELD' ) {
      var field = processDataField(f);
      if ( field ) {
        info.fields.push(field);
        if ( field.inherited ) {
          info.inherits[field.inherited] = true;
        }
      }
    } else if ( f.kind === 'METHOD_FIELD' ) {
      var method = processMethodField(f);
      if ( method ) {
        info.methods.push(method);
        if ( method.inherited ) {
          info.inherits[method.inherited] = true;
        }
      }
    } else {
      //Ignore all other field types
      return;
    }
  });
  //Converted the unique inherited objects to an array
  info.inherits = Object.keys(info.inherits);
  //Return the info
  return info;
}
/**
 * Processes a DATA_FIELD field.
 * @param {*} raw An element from .fieldTypeDoc
 * @returns object with information, or null
 */
function processDataField(raw) {
  if ( !raw ) { return null; }
  var field = {};
  //Copy over basic info
  field.name = raw.name;
  field.description = raw.source;
  field.private = raw.private || false;
  field.required = raw.required || false;
  field.deprecated = raw.deprecated || false;
  //Inheritance
  if ( raw.inheritedFrom ) {
    field.inherited = raw.inheritedFrom.text;
  } else { field.inherited = null; }
  //Enum
  field.enum = raw.enum;
  if ( field.enum ) { field.enumValues = raw.enumValues; }
  //DataType
  field.dataType = null;
  field.primitive = true;
  field.simple = true;
  if ( raw.dataType ) {
    if ( raw.dataType.text ) {
      field.dataType = raw.dataType.text;
      if ( raw.dataType.titleText && raw.dataType.titleText.startsWith('type') ) {
        field.primitive = false;
      }
    } else {
      field.dataType = processDescription(raw.dataType);
      field.primitive = false;
      field.simple = false;
    }
  }
  return field;
}
/**
 * Procesess a METHOD_FIELD field.
 * @param {*} raw An element from .fieldTypeDoc
 * @returns object with information, or null
 */
function processMethodField(raw) {
  if ( !raw ) { return null; }
  var method = {};
  //Copy basic info
  method.name = raw.name;
  method.private = raw.private || false;
  method.deprecated = raw.deprecated || false;
  method.description = null;
  if ( raw.description ) {
    method.description = processDescription(raw.description);
  }
  method.static = !raw.member;
  method.private = raw.private;
  //Inheritance
  if ( raw.inheritedFrom ) {
    method.inherited = raw.inheritedFrom.text;
  } else { method.inherited = null; }
  //Return
  method.return = {};
  if ( raw.return ) {
    if ( raw.return.dataType ) {
      method.return.dataType = raw.return.dataType.text;
    }
    method.return.description = null;
    if ( raw.return.description ) {
      method.return.description = processDescription(raw.return.description);
    }
  }
  //Params
  method.params = [];
  _.each(raw.parameters, function(p,i) {
    var param = {};
    param.name = p.name;
    param.required = p.required;
    param.description = null;
    if ( p.description ) {
      param.description = processDescription(p.description);
    }
    param.dataType = p.dataType ? p.dataType.text : null;
    param.dataDoc = p.dataType ? p.dataType.toName: null;
    method.params.push(param);
  });
  return method;
}
/**
 * Takes the object typically found in the description field and converts to a string
 * @param {Documentation} d A Documentation-like object
 * @string with the contents.
 */
function processDescription(d) {
  if ( !d ) { return ''; }
  if ( d.style === 'PLAIN' ) {
    desc = d.text;
    return ''+d.text;
  }
  var desc = '';
  if ( d.kind === 'P' ) {
    _.each(d.spans, function(s) {
      desc += s.text;
    });
    return desc;
  } if ( d.kind === 'DOC' ) {
    _.each(d.blocks, function(b) { 
      desc += processDescription(b);
    });
  }
  return desc;
}