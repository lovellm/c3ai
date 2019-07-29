/**
 * createFile
 * @param {ReferenceFile} file 
 * @param {binary} content 
 */
function createFile(file, content) {
  //Make sure the required properties exists
  if ( !file || !file.page || !file.page.id ) { return null; }
  if ( !file.name || !file.contentType ) { return null; }
  if ( !content ) { return null; }
  //Set some defaults
  if ( !file.lastModified ) { file.lastModified = new DateTime(); }
  if ( !file.size ) { file.size = 0; }
  if ( !file.effectiveDate ) { file.effectiveDate = new DateTime(); }
  //Get tenant/tag
  //This is needed for multi-tag environments that are setup with a single FileSystem definition common to all.
  var ac = ActionContext.dump();
  var tag = (ac.tenant ? ac.tenant + '/' : '') + (ac.tag || '');
  //Create the File URL
  var fs = FileSystem.defaultInstance();
  var mountName = fs.mountName('DEFAULT');
  var path = 'ref/'+tag+'/'+file.page.id+'/'+file.name;
  var url = fs.urlFromMountNameAndRelativeEncodedPath(mountName,path);
  file.id = url;
  //Create the file in the file system.
  File.createFile(url,content,file.contentType);
  //Create the file record
  file.merge();
  return file.id;
}
/**
 * editFile
 * @param {ReferenceFile} file 
 * @param {boolean} remove 
 */
function editFile(file,remove) {
  //No current file, return null.
  if ( !file || !file.id ) { return null; }
  //Make sure the given file id exists.
  var current = ReferenceFile.get(file.id);
  //If Not, return null.
  if ( !current ) { return null; }
  if ( remove ) {
    current.remove();
    var fs = FileSystem.defaultInstance();
    fs.deleteFiles(file.id,true);
    return null;
  }
  //Merge the given file and return it.
  //Force description/note to be updated, so they can be nulled out.
  var include = 'description,note';
  //Only update effective date if not null to not remove.
  if ( file.effectiveDate ) { include +=',effectiveDate'; }
  file = file.merge({include:include});
  return file;
}