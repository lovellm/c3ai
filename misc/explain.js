/**
 * Generates a Query Plan for a `fetch` or `evaluate` without executing the full query.
 * Supplements the query plan with the index definition for any used indexes on the primary type
 * (but not any references types).
 * 
 * **Will not work if the query generates more than 1 sql statement.**
 * @param {Persistable} type A persistable type
 * @param {FetchSpec|EvaluateSpec} spec Either a FetchSpec or EvaluateSpec or something similar.
 * Basically, if it contains a `projection` field, it will be treated as an evaluate.
 * Otherwise it will be treated as a fetch.
 * @returns Object containing the properties:
 * * plan - DB Execution Plan
 * * sql - SQL Statement
 * * binds - Object containing parameter bindings
 * @example
 * //Evaluate Statement
 * Explain(CountryCode,{projection:'name'})
 * @example
 * //Fetch Statement with a filter
 * Explain(Currency, {filter:'startsWith(id,"A")'})
 */
function Explain(type, spec){
  if ( !spec ) { return {}; }
  if ( !spec.filter && !spec.include && !spec.projection ) {
    return {}; 
  }
  var isEval = spec.projection && spec.projection.length > 1;
  //Append short-circuit condition so it does not need to run
  if ( spec.filter && spec.filter.length > 1 ) {
    spec.filter += '&&1==0';
  } else {
    spec.filter = '1==0';
  }
  spec.explain = true;
  //'Execute' it
  if ( isEval ) {
    var result = type.evaluate(spec);
  } else {
    var result = type.fetch(spec);
  }
  //Get the query plan
  var plan = result.queryPlans;
  if ( plan.length > 1 ) {
    throw "More Than 1 Query Plan - Too Complex For Me";
  }
  plan = plan[0];
  //Convert bindVars to plain Java Object
  var binds = {};
  _.each(plan.bindVars,(o,i)=>{binds[i]=o.value})
  //Replace short-circuit condition
  var sql = plan.sql;
  sql = sql.replace(/1=0 AND | AND 1=0|\(1=0\) AND/,'');
  //Get the plan
  var dbPlan = DbAdmin.explainStmt(sql,binds);
  //See if any indexes were used
  var indexMatch = dbPlan.matchAll(/ using ([\w]+) on /g)
  var usedIndex = {};
  var hasIndex = false;
  while (true) {
    var match = indexMatch.next();
    if ( !match || !match.value || match.done ) { break; }
    var index = match.value[1];
    if (!index) { break; }
    index=index.toUpperCase();
    usedIndex[index] = true;
    hasIndex = true;
  }
  //If so, get the index columns
  if ( hasIndex ) {
    var table = type.schema().rootTableName;
    var tableIndex = DbAdmin.getTableIndexes(table);
    _.each(tableIndex,(o)=>{
      if (usedIndex[o.indexName] ) {usedIndex[o.indexName]=o.indexCols;}
    });
    //Add the columns to the plan text.
    _.each(usedIndex, (v,k)=>{
      if (typeof v !== 'boolean') {
        dbPlan = dbPlan.replace(new RegExp(k.toLowerCase(),'gi'),k+' <'+v+'>');
      }
    });
  }
  return {
    plan: dbPlan,
    sql: sql,
    bindVars: binds
  };
}