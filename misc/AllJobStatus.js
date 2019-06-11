/**
 * List the status of all BatchJobs and MapReduceJobs in the current package since the given date.
 * @example
 * //Display status of all jobs started on or after 2019-06-10.
 * c3Grid(AllJobStatus("2019-06-10"));
 * @param {string} startDate ISO String representation of the start date. Limited to >= this date.
 * Exmample: '2019-06-10'
 * @returns
 * Array of Objects with the following fields:
 * * typeName - string - Name of the Type for the job
 * * started - DateTime - Start date of the run
 * * completed - DateTime - Completion date of the run (null if did not complete)
 * * status - string - Status of the job
 * * duration - number - Duration in minutes of the run (NaN if did not complete)
 */
function AllJobStatus(startDate) {
  var tag = MetadataStore.tag();
  var p = tag.rootPackage();
  p = p.name || null;
  //List all types in this package
  var allTypes = p ? tag.typesByPackage(p) : [];
  //List all job types
  var batchTypes = tag.typesThatMixin({typeName:'BatchJob'});
  var mrTypes = tag.typesThatMixin({typeName:'MapReduce'});
  //Filter types to only ones in current package
  var typeDict = _.indexBy(allTypes,'typeName');
  batchTypes = batchTypes.filter((f)=>{return typeof typeDict[f.typeName] !== 'undefined';}).map((m)=>m.typeName);
  mrTypes = mrTypes.filter((f)=>{return typeof typeDict[f.typeName] !== 'undefined';}).map((m)=>m.typeName);
  var jobTypes = batchTypes.concat(mrTypes);
  var allRuns = [];
  //Get status of each
  _.each(jobTypes, (t)=>{
    var type = c3Type(t);
    var hist = type.fetch(
      {include: 'meta.created,run.status.started,run.status.completed,run.status.status', filter: 'meta.created>=dateTime("'+startDate+'")', limit:20}
    )||{};
    hist=hist.objs||[];
    hist.forEach((o)=>{
      allRuns.push({
        typeName: t, started: o.run.status.started, completed: o.run.status.completed,
        status: o.run.status.status, duration: ((o.run.status.completed-o.run.status.started)/60000)
      });
    });
  });
  allRuns=allRuns.sort((a,b)=>a.started-b.started);
  return allRuns;
}
