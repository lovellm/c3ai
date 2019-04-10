/**
 * Run an `evaluate` call based on a single string. Automatically handles grouping if 
 * an aggregate function was used. Supports column alias names.
 * @param {Persistable} type A C3 type that mixes Persistable and can have `evaluate` used on it. 
 * @param {string} select A 'select' string. Essentially, the `projection` string for an `evaluate` call,
 * with the addition of SQL-like column aliasing.
 * @param {string} filter A filter string for the type.
 * @param {number} limit Optional limit to use, defaults to 2000.
 * @returns
 * An Array of Objects. Each object is one row from the resulting query.
 * If alias names were used, properties have those names, otherwise named based on the field/calculation name.
 * @example
 * //Simple Use Case, retrieve 'id' and 'name' with no aggregation.
 * queryData(SomeType,'id,name');
 * @example
 * //Simple case, group by 'someFieldName' with a sum of 'value'
 * queryData(SomeType,'someFieldName,sum(value)');
 * @example
 * //No aggregation, use column aliases in output instead of actual names
 * queryData(someType,'someFieldName as "My Field", anotherFieldName OtherField, moreFields AS YetAnotherField');
 * @example
 * //More complex one with calculations and such.
 * queryData(someType,
 *   'productId as Product, sum(sales) TotalSales, sum(cost) "Total Cost", (productType=="New"?"New":"Old") as "Is New?"',
 *   'seller=="SellerId',
 *   10);
 */
function queryData(type,select,filter,limit) {
  /**
   * Split the given text on the given delimeter.
   * A delimeter within double quotes or parents will not be split.
   * Quotes within quotes escapted by doubling (as in csv).
   * @param {string} text Text to Split
   * @param {string} delim Character to split on. Must be 1-character long.
   * @returns Array of strings, similar to string.prototype.split
   */
  var splitOn = function(text,delim) {
    if ( !delim || delim.length !== 1 ) { return [text]; }
    if ( !text ) { return []; }
    var parens = 0;
    var quotes = false;
    var i = -1;
    var buffer = '';
    var parts = [];
    var prev = null;
    var c = null;
    while ( ++i < text.length ) {
      prev = c;
      c = text[i];
      if ( c === delim && parens === 0 && !quotes ) {
        parts.push(buffer);
        buffer = '';
        continue;
      }
      else if ( c === '(' && !quotes ) { parens++; } //Increment Parens
      else if ( c === ')' && !quotes ) { parens--; } //Decrement Parens
      else if ( c === '"' ) {
        quotes = !quotes;
        if ( prev === '"' ) { 
          //if ( parens === 0 ) { buffer += c; }
          continue;
        } //Second quote, escaped quote
        //if ( parens === 0 ) { continue; } //Not within parens, strip quote.
      }
      else if ( c === ' ' && !quotes && (!buffer || prev === ' ')) { continue; } //Skip Consecutive Whitespace
      buffer += c;
    }
    if ( parens !== 0 ) { throw 'Bad Format - Uneven Parens'; }
    if ( quotes ) { throw 'Bad Format - Uneven Quotes'; }
    parts.push(buffer);
    return parts;
  }
  /**
   * If the first and last character in text are ", removes them.
   * Does not modify given string.
   * @param {string} text 
   * @returns string without first and last character if they were quotes.
   */
  var stripQuotes = function(text) {
    if ( !text ) { return ''; }
    if ( text[0] === '"' && text[text.length-1] === '"' ) {
      return text.substring(1,text.length-1);
    }
    return text;
  }
  //Keep track of fields
  var group = [];
  var proj = [];
  var names = [];
  filter = filter || '';
  limit = limit || 2000;
  //Whether we need to grop by or not
  var hasAgg = false;
  //Split the fields on comma
  var fields = splitOn(select,',');
  //Process each field
  _.each(fields, function(field){
    if ( !field ) { return; }
    field = field.trim();
    //Split the field on space, check for alias name
    var parts = splitOn(field,' ');
    //console.log(field+'  ->  '+parts.join('|'));
    if ( parts.length < 1 || !parts[0] ) { return; }
    if ( parts.length === 1 ) {
      //Just field no alias
      proj.push(parts[0]);
      names.push(parts[0]);
    } else if ( parts.length === 2 ) {
      //Field + alias, no 'as'
      proj.push(parts[0]);
      names.push(stripQuotes(parts[1]));
    } else if ( parts.length === 3 && parts[1].toLowerCase() === 'as' ) {
      //Field + as + alias
      proj.push(parts[0]);
      names.push(stripQuotes(parts[2]));
    } else {
      throw 'Parsing Field, Confused By: '+field;
    }
    //Check if the field is an aggregation function
    var isAgg = false;
    var m = parts[0].match(/^([a-zA-Z]+) *\(/);
    if ( m && m[1] ) {
      m = m[1].toLowerCase();
      if ( m === 'max' || m === 'min' || m === 'sum' || m === 'count' || m === 'avg' || m === 'stddev' ) {
        hasAgg = true;
        isAgg = true;
      }
    }
    //If not an aggregation function, add to the group clause.
    if ( !isAgg ) {
      group.push(parts[0]);
    }
  }); //End for Each Field
  //Make the Spec
  var spec = EvaluateSpec.make({
    projection: proj.join(','),
    filter: filter,
    limit: limit,
    forceDbEngineEval: true
  });
  //Add a group only if there was an aggregation function.
  if ( hasAgg ) {
    spec.group = group.join(',');
  }
  //console.log(spec);
  //Run the Evaluate
  var tuples = type.evaluate(spec) || {};
  var out = [];
  //Parse Evaluate, Create Output
  _.each(tuples.tuples, function(row) {
    var cells = row.cells || [];
    var outRow = {};
    _.each(names, function(name,i) {
      var value = null;
      if ( cells[i] ) {
        if ( cells[i].str ) {
          value = cells[i].str || '';
        } else if ( cells[i].number ) {
          value = cells[i].number || 0;
        } else if ( cells[i].bool ) {
          value = cells[i].bool ? true : false;
        } else if ( cells[i].date ) {
          value = new DateTime(cells[i].date);
        } else if ( cells[i].obj ) {
          value = cells[i].obj.id || '';
        }
      }
      outRow[name] = value;
    });
    out.push(outRow);
  });
  return out;
}