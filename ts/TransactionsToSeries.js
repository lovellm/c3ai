/**
 * WIP - NOT COMPLETE
 * Transform transaction and/or Timeseries data into a formated simplified for charting.
 * One record per time period with fields for each value for that time period.
 * A separate series dict maps those fields to what the mean.
 */
function TransactionsToSeries(){
  /* If 'new' was not used, use it. Makes sure 'this' refers to instance scope */
  if ( ! (this instanceof TransactionsToSeries) ){
    return new TransactionsToSeries()
  }

  var _data = {values: {}, series: {}};
  var _objs = {objs: null, group: null, props: null};
  var _ts = {};
  var _valid = {objs: false, ts: false};

  /**
   * Makes sure the key exists in _data.values.
   * @param {string} dateKey String representation of the date key
   * @param {Date} dateObject Optional. Date object. Will be constructed from dateKey if not given.
   */
  var _checkDateKey = function(dateKey, dateObject) {
    //Make sure there is an entry for this date
    if ( typeof _data.values[dateKey] === 'undefined' ) {
      if ( !dateObject ) { dateObject = new Date (dateKey); }
      _data.values[dateKey] = {
        key: dateKey,
        ms: dateObject.getTime()
      };
    }
    return _data.values[dateKey];
  }
  /**
   * If data is invalid (needs to be recalculated), resets it to empty state
   */
  var _clear = function() {
    if ( !_valid.objs || !_valid.ts ) {
      _valid.objs = false;
      _valid.ts = false;
      _data = {values: {}, series: {}};
    }
  }
  /**
   * Updates the series data with an EvalMetricsResult
   */
  var _processTs = function() {
    if ( _valid.ts ) { return this;}
    _valid.ts = true;
    var data = _ts;
    if( !data.result ) {
      return this;
    }
    var resultIds = _.keys(data.result)
    if ( resultIds.length < 1 ) {
      return this;
    }
    //Iterate Each Result ID
    _.each(data.result, function(idData, id) {
      //Iterate Each Metric within the Result ID
      _.each(idData, function(metricData, metric) {
        var series = id+'|'+metric;
        if ( typeof _data.series[series] === 'undefined' ) {
          _data.series[series] = {
            names: { id: id, metric: metric },
            points: { value: series } 
          };
        }
        //metricData will be different depending on whether run from static/console or from API
        var dates = null;
        var data = null;
        var missing = null;
        if ( typeof metricData.dates === 'function' ) {
          dates = metricData.dates();
        } else { dates = metricData.dates }
        if ( typeof metricData.data === 'function' ) {
          data = metricData.data();
        } else { data = metricData.data; }
        if ( typeof metricData.missing === 'function' ) {
          missing = metricData.missing();
        } else { missing = metricData.missing; }
        //Iterate each data point
        _.each(dates, function(date,i) {
          var oDate = null;
          //From console, will be DateTime object, from API, will be JSON string
          if ( date instanceof Date ) {
            oDate = date;
          } else { oDate = new Date(date); }
          //Convert to YYYY-MM-DD string
          var dateKey = oDate.toISOString().substring(0,10);
          //Make sure there is an entry for this date
          _checkDateKey(dateKey,oDate);
          if ( missing[i] === 0 ) { 
            _data.values[dateKey][series] = data[i];
          } else {
            _data.values[dateKey][series] = null;
          }
        }); //End each dates
      }); //End each idData
    }); //End each data.result
    return this;
  }
  /**
   * Converts transaction records in to series information
   */
  var _processObjs = function() {
    if ( _valid.objs ) { return this; }
    _valid.objs = true;
    if ( !_objs.objs || _objs.objs.length < 1 ) { return this; }
    var props = _objs.props;
    var group = _objs.group;
    if ( !props ) { return this; }
    if ( !props.dateField ) { return this; }
    if ( !props.value && !props.qty && !props.spend ) { return this; }
    var dateProp = props.dateField;
    var valueProp = props.value || null;
    var qtyProp = props.qty || null;
    var spendProp = props.spend || null;
    //Iterate Each Transaction
    _.each(_objs.objs, function(o) {
      //Prepare Date Related Things
      var date = o[dateProp];
      if ( !(date instanceof Date) ) {
        date = new Date(date);
      }
      var dateKey = date.toISOString().substring(0,7)+'-01';
      var period = _checkDateKey(dateKey);
      //Create Key/Series Related Things
      var key = '';
      if ( group && group.length > 0) {
        group.forEach(function(g) {
          key += (o[g] || '');
        })
      } else { key = 'ALL'; }
      if ( typeof _data.series[key] === 'undefined' ) {
        //Initialize a Series Entry
        _data.series[key] = {
          names: {},
          points: {}
        };
        _.each(group, function(g) {
          _data.series[key].names[g] = (o[g] || '');
        });
        if (valueProp) { _data.series[key].points.value = key; }
        if (qtyProp) { _data.series[key].points.qty = key+'Q'; }
        if (spendProp) { _data.series[key].points.spend = key+'S'; }
        if (qtyProp&&spendProp) { _data.series[key].points.price = key+'P'; }
      }
      //Add up data
      if ( valueProp ) {
        if ( typeof period[key] === 'undefined' ) { period[key] = 0; }
        period[key] += (o[valueProp] || 0);
      }
      if ( qtyProp ) {
        if ( typeof period[key+'Q'] === 'undefined' ) { period[key+'Q'] = 0; }
        period[key+'Q'] += (o[qtyProp] || 0);
      }
      if ( spendProp ) {
        if ( typeof period[key+'S'] === 'undefined' ) { period[key+'S'] = 0; }
        period[key+'S'] += (o[spendProp] || 0);
      }
      if ( qtyProp && spendProp ) {
        if ( !period[key+'Q'] ) { period[key+'P'] = null; }
        else { period[key+'P'] = period[key+'S']/period[key+'Q']; }
      }
    }); //End each objs
    return this;
  }
  /**
   * Calls: clear, processObjs, processTs
   */
  var _process = function(){
    _clear();
    _processObjs();
    _processTs();
  }
  //Make the Object to return
  //Define Getter/Setters
  var _self = {
    data: function(_) {
      if (_) {
        _objs.objs = _;
        _valid.objs = false;
        return this;
      }
      return _objs.objs;
    },
    group: function(_) {
      if (_) {
        _objs.group = _;
        _valid.objs = false;
        return this;
      }
      return _objs.group;
    },
    /**
     * Set/Get the props related to Transaction processing
     * @param {Object} props Properties to Drive Behavior.
     * Must contain a property specifiying the date column
     * * dateField
     * 
     * At least one of the following must exist, representing the associated column name in the data.
     * * value
     * * qty
     * * spend
     * @returns reference to this if param was given, otherwise current props
     */
    props: function(_) {
      if (_) {
        _objs.props = _;
        _valid.objs = false;
        return this;
      }
      return _objs.props;
    },
    ts: function(_) {
      if (_) {
        _ts = _;
        _valid.ts = false;
        return this;
      }
      return _ts;
    },
    series: function() {
      _process();
      return _data;
    }
  }
  //Expose other functions that need to be exposed

  /* Set the returned object's prototype to this prototype
   * All it really does is make instanceof return true */
  _self.__proto__ = this.__proto__;
  //Return the object
  return _self;
}