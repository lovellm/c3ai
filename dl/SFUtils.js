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
   * @param {(string|string[])} options.status If given, only SourceFiles with this status
   * @param {(string|Date)} options.oldest If given, only SourceFiles updated or or newer than this date
   * @param {int} options.limit If given, limit to this number of results. Default 30
   * @returns
   * An array of SourceFile instances.
   */
  function getSourceFiles (options) {
    options = options || {};
    let filter = '(1==1)';
    let limit = options.limit || 30;
    let order = 'descending(meta.updated)';
    if ( options.canonical ) {
      filter += '&&(sourceCollection=="'+options.canonical+'")';
    }
    if ( options.status ) {
      if ( Array.isArray(options.status) ) {
        filter += '&&(intersects(status,["'+options.status.join('","')+'"]))';
      } else {
        filter += '&&(status=="'+options.status+'")';
      }
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
   * @param {(string|string[])} canonicals
   * A string representing a Canonical Name
   * or
   * An array of strings representing multple Canonical names
   * @param {(boolean|number)} process
   * If falsey, will not process the syncd canonicals, will need to done manually.
   * If the boolean `true`, will process all newly synced files.
   * If a number, it is an age in days. 1 means 1 day ago, 7 means 7 days ago, etc.
   * Any file older will not be processed, newer will be.
   * If given and neither a boolean or a number, will default to 1.
   * @param {string} contentType
   * If provided, attempts to replace the pysical file's content type with the given one, before syncing.
   * For example: `text/csv;delimiter=","` if the file should be a csv delimited by comma.
   * @returns Array of strings, the filenames of files that were synced
   */
  function syncFiles (canonicals, process, contentType) {
    if (!canonicals) { throw ERR_NO_CANONICAL }
    if ( typeof canonicals === 'string' ) { canonicals = [canonicals.toString()] }
    if ( !Array.isArray(canonicals ) ) { throw ERR_NO_CANONICAL }
    process = process || false;
    var newFiles = [];
    //Check each provided canonical
    canonicals.forEach(function(c) {
      //Get the actual files and the sourceFile records
      let files = getActualFiles(c) || [];
      let sf = SourceFile.fetch({filter:'sourceCollection=="'+c+'"', include:'id' }).objs || [];
      //Make a dictionary of SourceFiles, for easy lookup checks
      let sfDict = {};
      sf.forEach((f)=>{ sfDict[f.id]=true });
      //Track any actual file that is not a SourceFile
      files.forEach((f)=>{
        if ( !sfDict[f] ) { newFiles.push(f); }
      });
    });//END forEach canonicals
    //Handle all the new files
    newFiles.forEach((f)=>{
      if ( contentType ) {
        //Content Type was given, update the file with it
        console.log('Setting '+contentType+' for '+f);
        let file = File.make({url: f});
        //Read existing metadata
        file = file.readMetadata();
        if ( file.contentType !== contentType ) {
          //Only update contentType if different
          file.replaceContentType(contentType);
        }
      }//End if contentType
      console.log('Sync: '+f);
      //Sync the new file
      let sf = SourceFile.syncFile({url:f});
      if ( process ) {
        //Process is truthy, maybe process it
        if ( process !== true) {
          //It is not the boolean true, assume days old
          //Default to 1 if not a number
          if ( isNaN(process) ) { process = 1 }
          let dt = (new DateTime()).withoutZone().clearTime();
          dt = dt.addDays(-1*process);
          //Do nothing if the file is older than the date
          if ( sf.lastModified < dt ) { return; }
        }
        console.log('Process: ' +f);
        //Made it this far, process the file
        //sf.process();
      }
    });//END forEach newFiles
    return newFiles;
  }
  utils.syncFiles = syncFiles;

  /**
   * Physically deletes a file from the storage mechanism (blob).
   * The file must exist within the path of the given canonical or it will not delete.
   * @param {string} canonical A valid FileSourceCollection id, to which the given url belongs
   * @param {string} url fully qualified encoded path, including scheme
   * @returns true if it called `delete`, false otherwise
   */
  function deleteActualFile (canonical, url) {
    if (!url) { return false }
    //Get the canonical root url for verification
    if (!canonical) { throw ERR_NO_CANONICAL }
    let fsc = FileSourceCollection.get(canonical);
    if (!fsc) { throw ERR_NO_CANONICAL }
    let root = fsc.rootUrl();
    //If url does not belong to canonical, do nothing
    if ( !url.startsWith(root) ) { return false }
    let file = File.make({url: url});
    //If file does not exist, do nothing
    if ( !file.exists() ) { return false }
    //file.delete();
    return true;
  }
  utils.deleteActualFile = deleteActualFile;

  /**
   * Delete the given SourceFile record
   * @param {string} id SourceFile id
   * @returns true if it called remove, otherwise false
   */
  function deleteSourceFile (id) {
    if (!id) { return false }
    let sf = SourceFile.get(id);
    if ( !sf ) { return false }
    sf.remove();
    return true;
  }
  utils.deleteSourceFile = deleteSourceFile;

  /**
   * Process (or re-process) a SourceFile record.
   * If the status is currently `initial`, it will process it.
   * Otherwise it will first resume it to reset it to `initial`, then process it.
   * @param {string} id SourceFile id
   * @returns true if process was called
   */
  function processFile (id) {
    if (!id) { return false }
    let sf = SourceFile.get(id);
    if (!sf) { return false }
    if ( sf.status !== SourceFileStatus.INITIAL ) {
      sf = sf.resume();
    }
    //Make sure resume resulted in initial
    if ( sf.status === SourceFileStatus.INITIAL ) {
      sf.process();
      return true;
    }
    //Could happen if resume resulted in a rejected status
    return false;
  }
  utils.processFile = processFile;

  /**
   * Calls `stop` on the given file.
   * @param {string} id SourceFile id
   * @returns true if stop was called
   */
  function stopFile (id) {
    if (!id) { return false }
    let sf = SourceFile.get(id);
    if (!sf) { return false }
    sf.stop();
    return true;
  }
  utils.stopFile = stopFile;

  utils.__proto__ = this.__proto__;
  //Return the object
  return utils;
}