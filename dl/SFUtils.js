/**
 * A set of utility functions for managing SourceFiles.
 */
function SFUtils(){
  if ( !(this instanceof SFUtils) ){ return new SFUtils() }
  var utils = {};
  var ERR_NO_CANONICAL = 'Must specify a canonical with a valid FileSourceCollection';

  /**
   * Gets a list of FileSourceCollections
   * @param {string} name Partial Canonical name
   * @returns Array of FileSourceCollection
   */
  function getFileSourceCollections (name) {
    let filter = 'meta.createdBy!="authorizer"';
    if (name) {
      name = name.replace(/"/g,'');
      filter += '&&contains(id,"'+name+'")';
    }
    return FileSourceCollection.fetch({filter: filter}).objs || [];
  }
  utils.getFileSourceCollections = getFileSourceCollections;

  /**
   * Gets a list of FileSourceCollection ids
   * @param {string} name Partial Canonical name
   * @returns Array of string for FileSourceCollection/Canonical ids
   */
  function getCanonicalNames (name) {
    let fsc = getFileSourceCollections(name);
    fsc = fsc.map((o)=>o.id);
    return fsc;
  }
  utils.getFSCNames = getCanonicalNames;

  /**
   * Returns SourceFile status information
   * @param {Object} options Optional Parameters that drive behavior
   * @param {string} options.canonical If given, only SourceFiles for this canonical
   * @param {string} options.status If given, only SourceFiles with this status
   * @param {string|Date} options.oldest If given, only SourceFiles updated or or newer than this date
   * @param {int} options.limit If given, limit to this number of results. Default 100
   * @returns
   * An array of SourceFile instances.
   */
  function getSourceFiles (options) {
    options = options || {};
    let filter = '(1==1)';
    let limit = options.limit || 100;
    let order = 'descending(meta.updated)';
    if ( options.canonical ) {
      filter += '&&(sourceCollection=="'+options.canonical+'")';
    }
    if ( options.status ) {
      filter += '&&(status=="'+options.status+'")';
    }
    if ( options.oldest ) {
      if ( options.oldest.toISOString ) { options.oldest = options.oldest.toISOString() }
      filter += '&&(meta.updated>=dateTime("'+options.oldest+'"))';
    }
    let objs = SourceFile.fetch({
      filter: filter,
      limit: limit,
      order: order
    }).objs || [];
    return objs;
  }
  utils.getSourceFiles = getSourceFiles;

  /**
   * Lists all files that are physically present for a canonical.
   * @param {string} canonical A Canonical name that is also a valid FileSourceCollection (id)
   * @returns Array of strings, representing the full file url.
   */
  function getActualFiles (canonical) {
    if (!canonical) { throw ERR_NO_CANONICAL }
    let fsc = FileSourceCollection.get(canonical);
    if (!fsc) { throw ERR_NO_CANONICAL }
    let fileStream = fsc.listFiles();
    let files = fileStream.collect();
    fileStream.close();
    files = files.map((f)=>f.url);
    return files;
  }
  utils.getActualFiles = getActualFiles;

  /**
   * Checks for any physically existing files that do not
   * have a SourceFile record and creates a record for them.
   * Conditionally processes those files based on the parameter.
   * @param {string|string[]} canonicals
   * A string representing a Canonical Name
   * or
   * An array of strings representing multple Canonical names
   * @param {boolean|string|Date} process
   * If falsey, will not process the syncd canonicals, will need to done manually.
   * If the boolean `true`, will process all newly synced files.
   * If a string or Date, will attempt to cast as a date (`new Date()`).
   * Any file older than the date will not be processed,
   * on or newer than the date will be processed.
   * @returns Count of files that were synced
   */
  function syncFiles (canonicals, process) {
    if (!canonicals) { throw ERR_NO_CANONICAL }
    if ( typeof canonicals === 'string' ) { canonicals = [canonicals.toString()] }
    if ( !Array.isArray(canonicals ) ) { throw ERR_NO_CANONICAL }
    process = process || false;
    var count = 0;
    //Check each provided canonical
    canonicals.forEach(function(c) {
      //Get the actual files and the sourceFile records
      let files = getActualFiles(c) || [];
      let sf = SourceFile.fetch({filter:'sourceCollection=="'+c+'"', include:'id' }).objs || [];
      //Make a dictionary of SourceFiles, for easy lookup checks
      let sfDict = {};
      sf.forEach((f)=>{ sfDict[f.id]=true });
      //Track any actual file that is not a SourceFile
      var newFiles = [];
      files.forEach((f)=>{
        if ( !sfDict[f] ) { newFiles.push(f); }
      });
    });//END forEach canonicals
    //Handle all the new files
    newFiles.forEach((f)=>{
      console.log('Sync: '+f);
      //Sync the new file
      let sf = SourceFile.syncFile({url:f});
      count++;
      if ( process ) {
        //Process is truthy, maybe process it
        if ( process !== true) {
          //It is not the boolean true, assume a date-like thing
          let dt = null;
          //For simplicity, just make a new date from it
          try { dt = new DateTime(fileDate); }
          //Do nothing if a date cannot be made
          catch (e) { return; }
          //Do nothing if the file is older than the date
          if ( sf.lastModified < dt ) { return; }
        }
        console.log('Process: ' +f);
        //Made it this far, process the file
        //sf.process();
      }
    });//END forEach newFiles
    return count;
  }
  utils.syncFiles = syncFiles;

  utils.__proto__ = this.__proto__;
  //Return the object
  return utils;
}