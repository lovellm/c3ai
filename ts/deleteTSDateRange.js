/**
 * Deletes a date range (via MapReduce) from one or more Timeseries types based on a filter.
 * @param {object} types Dictionary of Header and Data types. Required or nothing will happen.
 * Example: 
 * `{'TimeseriesHeader_type1':'TimeseriesDataPoint_type1','TimeseriesHeader_type2':'TimeseriesDataPoint_type2'}`
 * @param {string} filter Optional. A valid filter string for the TimeseriesHeader types.
 * Will default to empty string if null.
 * Example: `'id=="HeaderId"||someField=="someValue"'`
 * @param {Date} startDate Optional. First date to delete (inclusive).
 * Expects Javascript Date object, ignores time component.
 * Will default to yesterday if null/falsey.
 * Give the string 'ALL' to ignore start date.
 * @param {Date} endDate Optional. Last date to delete (inclusive).
 * Expects Javascript Date object, ignores time component.
 * Will default to tomorrow if null/falsey.
 * Give the string 'ALL' to ignore end date.
 * @return {[JSMapReduceJob]} Array of JSMapReduceJob instances that this created.
 * @example
 * //This will delete data for a specific header starting on 2018-08-20:
 * deleteTSDateRange({'HeaderType':'DataPointType'},'id=="SomeIdValue"', new Date('2018-08-20'), 'ALL');
 * @example
 * //This will delete all data for two Timeseries types from 2018-08-25 to 2018-08-31 (inclusive):
 * deleteTSDateRange(
 *  {'HeaderType1':'DataPointType1','HeaderType2':'DataPointType2'},
 *  '', new Date('2018-08-25'), new Date('2018-08-31')
 * );
 * @example
 * //Check status using the following console command. Most recently created at top:
 * //If you had multiple types, there will be one job for each.
 * c3Grid(JSMapReduceJob.fetch({order:'descending(meta.created)',limit:10}));
 */
function deleteTSDateRange(types, filter, startDate, endDate) {
  //Hold this list of jobs this creates
  var jobs = [];
  //Set the types to be either given types or empty object
  var runTypes = types || {};
  //Set filter as given filter or empty string
  var runFilter = filter || '';
  //Decide upon and format the start date
  var runStartDate = startDate || (new Date()).addDays(-1);
  if ( runStartDate === 'ALL' ) { runStartDate = null; }
  else { runStartDate = runStartDate.toISOString().substring(0,10); }
  //Decide upon and format the end date
  var runEndDate = endDate || (new Date()).addDays(1);
  if ( runEndDate === 'ALL' ) { runEndDate = null; }
  else { runEndDate = runEndDate.toISOString().substring(0,10); }
  //The map function to run
  var map = function(batch, objs, job, subBatch) {
    //Get the type, firstDate and lastDate from the context
    var type = job.context.value.t.value;
    //Default the next two to null if not defined
    var firstDate = null;
    if ( job.context.value.s ){
      firstDate = job.context.value.s.value
    }
    var lastDate = null;
    if ( job.context.value.e ){
      lastDate = job.context.value.e.value;
    }
    //Convert the type string to a type object
    var tsType = (TypeRef.make({typeName: type})).toType();
    //Initialize the filter string
    var deleteFilter = '';
    //Add first date filter if needed
    if ( firstDate ){
      deleteFilter += 'start>=dateTime("'+firstDate+'")';
    }
    //Add last date filter if needed
    if ( lastDate ){
      if ( firstDate ) { deleteFilter += '&&'; }
      deleteFilter += 'end<=dateTime("'+lastDate+'")';
    }
    //If we have some filters already add && here to simplify next part
    if ( deleteFilter.length > 0 ) {
      deleteFilter += '&&';
    }
    //Iterate each object in this map batch
    for (var i = 0; i < objs.length; i++){
      //Get the object
      var obj = objs[i];
      //Call removal all with the date filters and the current object's id.
      tsType.removeAll(deleteFilter+'parent.id=="'+obj.id+'"', true);
    }
  }; //End of map function definition
  //Iterate each of the provided Header types
  Object.keys(runTypes).forEach(function(type){
    //Make a new map reduce spec
    var jobSpec = JSMapReduceSpec.make({
      targetType: type,
      include: "id",
      filter: runFilter,
      map: map,
      batchSize: 100,
      context: {
        's': runStartDate,
        'e' : runEndDate,
        't': runTypes[type]
      }
    });
    //Run the map reduce job
    var job = JS.mapReduce(jobSpec);
    jobs.push(job);
  });
  //Return the array of jobs
  return jobs;
}