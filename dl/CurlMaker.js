/**
 * Generate `curl` commands to use in data loading.
 * Available methods for customizing the configuration:
 * * contentType
 * * delimiter
 * * c3auth
 * Available methods for making curls:
 * * makeCurl
 * * makeCurls
 * * makeCurlAllFSC
 * * makeCurlAllCanonical
 * @constructor
 * @example
 * //Overwrite default configurations.
 * var curl = new CurlMaker()
 * curl.contentType('text/csv').delimiter(',').c3auth('ExistingAuthToken')
 * @example
 * //Make a curl command
 * var curl = new CurlMaker()
 * curl.makeCurl('CanonicalMyCanonical','MyFileName.csv')
 * @example
 * //Make multiple curl commands
 * var curl = new CurlMaker()
 * curl.makeCurls({
 *   'Canonical1': 'FileName1.csv',
 *   'Canonical2': 'FileName2.csv',
 *   'Canonical3': 'FileName3.csv'
 * })
 */
function CurlMaker(){
  /* If 'new' was not used, use it. Makes sure 'this' refers to instance scope */
  if ( ! (this instanceof CurlMaker) ){
    return new CurlMaker()
  }
  //Some Config Things
  var _tokenMinutes = 240
  var _contentType = 'text/csv'
  var _delimiter  = ','
  //Current Context
  var _context = ActionContext.dump()
  var _user = _context.userName
  var _tenant = _context.tenant
  var _tag = _context.tag
  var _host = _context.hostUrl
  //Auth Token
  var _c3auth = null
  /**
   * @function makeCurl
   * Make a curl command for a single canonical and filename.
   * @param {string} canonical Optional. Name of the canonical.
   * Defaults to 'CanonicalName' for easy find/replace.
   * @param {string} fileName Optional. Name of the file.
   * Defaults to 'FileName.csv' for easy find/replace.
   * @returns {string} The curl command.
   */
  var _makeCurl = function(canonical, fileName) {
    canonical = canonical || 'CanonicalName'
    fileName = fileName || 'FileName.csv'
    if ( !_c3auth ) {
      _c3auth = Authenticator.generateC3AuthToken(_user,null,_tokenMinutes)
    }
    let url = _curlUrl(canonical, fileName)
    let contentType = 'Content-Type: '+_contentType+';delimiter="'+_delimiter+'"'
    let c = 'curl -v -H \''+contentType+'\' -X PUT --data-binary @./'+fileName
      +' '+url+' --cookie "c3auth='+_c3auth+'"'
    return c
  }
  /**
   * @function makeCurls
   * Make multiple curl commands based on a dictionary of canonicals and files.
   * @param {Object} canonicalFileName Dictionary of cannical name and filename.
   * For Each key, will create a curl for a canonical of that key and filename of its value.
   * @returns {[string]} Array of curl commands.
   */
  var _makeCurls = function(canonicalFileName) {
    canonicalFileName = canonicalFileName || {}
    var canonicals = Object.keys(canonicalFileName)
    return canonicals.map((o)=>_makeCurl(o,canonicalFileName[o]))
  }
  /**
   * @function makeCurlAllFSC
   * Makes a curl command for each FileSourceCollection that
   * was not created by 'authorizer'.
   * @returns {[string]} Array of curl commands.
   */
  var _makeCurlAllFSC = function() {
    let fsc = _allFileSourceCollection() || []
    return fsc.map((o)=>_makeCurl(o,null))
  }
  /**
   * @function makeCurlAllCanonical
   * Makes a curl command for each canonical of the current package.
   * Assumes a FileSourceCollection exists for each.
   * @returns {[string]} Array of curl commands.
   */
  var _makeCurlAllCanonical = function() {
    let c = _packageCanonicals() || []
    return c.map((o)=>_makeCurl(o,null))
  }
  /**
   * Make the file import url for a curl command.
   * @private
   * @param {string} canonical Canonical name, defaults to 'CanonicalName'
   * @param {string} fileName File anem, defaults to 'FileName.csv'
   */
  var _curlUrl = function(canonical, fileName) {
    canonical = canonical || 'CanonicalName'
    fileName = fileName || 'FileName.csv'
    return _host + '/import/1/' + _tenant + '/' + _tag + '/' + canonical + '/' + fileName
  }
  /**
   * Get the id of all FileSourceCollection not made by 'authorizer' (default ones).
   * @private
   * @returns {[string]} Array of ids
   */
  var _allFileSourceCollection = function() {
    //Get all FileSourceCollections not made by 'authorizer' (default ones)
    let objs = FileSourceCollection.fetch({filter: 'meta.createdBy!="authorizer"'}).objs || []
    return objs.map((o)=>o.id)
  }
  /**
   * Gets all canonicals in the current package.
   * @private
   * @returns {[string]} Array of Canonical names
   */
  var _packageCanonicals = function() {
    //Get the root package (deployed package) for the current tag
    let tag = MetadataStore.tag()
    let package = tag.rootPackage()
    package = package.name || null
    //List all types in this package
    let allTypes = package ? tag.typesByPackage(package) : []
    //List all 'canonical' types
    let cTypes = tag.typesThatMixin({typeName:'Canonical'})
    //Filter canonicals types down to only ones in current package
    let typeDict = _.indexBy(allTypes,'typeName')
    cTypes = cTypes.filter((f)=>{return typeof typeDict[f.typeName] !== 'undefined'})
    cTypes = cTypes.map((m)=>m.typeName)
    return cTypes
  }
  /* Make the object that will be returned */
  var curl = {
    contentType: function(_) {
      if (_) { _contentType = _; return this }
      return _contentType
    }
    ,delimiter: function(_) {
      if (_) { _delimiter = _; return this }
      return _delimiter
    },c3auth: function(_) {
      if (_) { _c3auth = _; return this }
      return _c3auth
    }
  }
  //Expose functions that need to be exposed
  curl.makeCurl = _makeCurl
  curl.makeCurls = _makeCurls
  curl.makeCurlAllFSC = _makeCurlAllFSC
  curl.makeCurlAllCanonical = _makeCurlAllCanonical
  /* Set the returned object's prototype to CurlMaker's prototype
   * All it really does is make instanceof CurlMaker return true */
  curl.__proto__ = this.__proto__
  //Return the object
  return curl
}