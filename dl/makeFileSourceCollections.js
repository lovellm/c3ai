/**
 * Create/Update FileSourceCollections for 
 * all canonicals in the root package of the current tag.
 * @param {string} fileSystem Optional, id from FileSourceSystem.
 * If given, created FileSourceCollections will use this FileSourceSystem.
 * If not given, uses the first listed FileSourceSystem.
 * @param {boolean} external Optional. Only works in 7.9 and new, otherwise will give an error.
 * If true, the FileSourceCollection will be set with external=true.
 * If false, will be set to false.
 * If null or undefined, will not be set/changed.
 * @example
 * //Make a FileSourceCollection for each canonical in the first listed FileSourceSystem
 * makeFileSourceCollections()
 * @returns Nothing
 */
function makeFileSourceCollections(fileSystem,external) {
  //Get the root package (deployed package) for the current tag
  var tag = MetadataStore.tag();
  var p = tag.rootPackage();
  p = p.name || null;
  //List all types in this package
  var allTypes = p ? tag.typesByPackage(p) : [];
  //List all 'canonical' types
  var cTypes = tag.typesThatMixin({typeName:'Canonical'});
  //Filter canonicals types down to only ones in current package
  var typeDict = _.indexBy(allTypes,'typeName');
  cTypes = cTypes.filter((f)=>{return typeof typeDict[f.typeName] !== 'undefined';});
  cTypes = cTypes.map((m)=>m.typeName);
  //Get the FileSourceSystem
  fileSystem = fileSystem ? 'id=="'+fileSystem+'"' : '';
  fss = FileSourceSystem.fetch({filter:fileSystem});
  fss = fss.objs || [];
  if ( fss.length < 1 ) { return; }
  fss = fss[0];
  //Make the FileSourceCollection for each Canonical
  cTypes.forEach((type)=>{
    var fsc = FileSourceCollection.make({
      id:type
      ,name:type
      ,sourceSystem: fss
      ,source:{typeName:type}
      ,typeIdent:"FILE"
    });
    if ( typeof external  !== 'undefined' && external !== null ) { fsc.external = external; }
    fsc.merge();
  });
}