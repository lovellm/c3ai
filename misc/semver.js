/**
 * Contains utility functions for sorting semantic version strings
 * 
 * * parse - convert a string to an object
 * * compare - compare to strings
 * * sort - sorts an array of strings or objects
 */
var semverUtil = function() {
  /**
   * 
   * @param {string[]|Object[]} l Array of strings or Array of Objects
   * @param {string|function|boolean} prop 
   * If a string, the property on each entry in l (assuming it is an object) containing the version.
   * If a function, calls the function on each item to return the version string.
   * If a boolean, replaces desc property and assumes the array is of strings, not objects.
   * @param {boolean} desc Reverse Order
   */
  function sort(l, prop, desc) {
    //If not given an array, do nothing, return what was given
    if ( !Array.isArray(l) ) { return l; }
    //Prop is a boolean, replace desc with prop
    if ( typeof prop === 'boolean' ) { desc = prop; }
    //Sort the array
    return l.sort(function(a,b) {
      //If prop is a string, assume is property name on each element
      if ( typeof prop === 'string' ) { return compare(a[prop], b[prop], desc); }
      //If prop is function, call it for each element
      if ( typeof prop === 'function' ) { return compare(prop(a), prop(b), desc); }
      //Otherwise, assume element is a string
      return compare(a, b, desc);
    });
  }
  /**
   * Compare two semantic version strings.
   * Ignores pre release and build components, only checks x,y,z.
   * @param {string} in1 
   * @param {string} in2 
   * @param {boolean} desc Reverse the sort order
   * @returns 1 if greater, -1 is lesser, 0 if equal
   */
  function compare(in1,in2,desc) {
    //Parse the inputs to an object with known fields
    var a = parse(in1);
    var b = parse(in2);
    var o = desc?-1:1;//Order factor
    //Peform the compares
    if ( a.x-b.x !== 0 ) { return o*(a.x-b.x); }
    if ( a.y-b.y !== 0 ) { return o*(a.y-b.y); }
    if ( a.z-b.z !== 0 ) { return o*(a.z-b.z); }
    return 0;
  }
  /**
   * Parse a Semantic Versioning string to an object
   * @param {string} a
   * @returns Object with properties:
   * 
   * * x {Integer} major version
   * * y {Integer} minor version
   * * z {Integer} patch version
   * * pre {string} pre release version
   * * build {string} build version
   * 
   * Not given numbers with default to 0, not given strings will default to null
   */
  function parse(a) {
    //Make a default return object
    var out = {x:0, y:0, z:0, pre:null, build: null};
    //Not given a string, use the default
    if ( typeof a !== 'string' ) { return out; }
    try {
      //Split of the version string
      var parts = a.match(/([0-9]+)\.([0-9]+)\.([0-9]+)-?([\w]+)?\+?([\w]+)?/);
      //First 3 convert to numbers
      out.x = Number.parseInt(parts[1]);
      out.y = Number.parseInt(parts[2]);
      out.z = Number.parseInt(parts[3]);
      //Second to default to null if undefined
      out.pre = parts[4]||null;
      out.build = parts[5]||null;
    } catch (e) { return out; }
    return out;
  }

  return {
    parse: parse,
    compare: compare,
    sort: sort
  };
}();
