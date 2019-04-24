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
  //Processed data
  var _data = {values: {}, series: {}, rel: {}, norm: {}};
  //Raw input Transaction data
  var _objs = {objs: null, group: null, props: null};
  //Raw input Timeseries data
  var _ts = {};
  //Keep track of processed data state to prevent re-processing when not needed
  var _valid = {objs: false, ts: false, rel: false, norm: false};
  //Utility function to Get Nested key by string
  var _get = function( obj, accessor ) {
    return ( accessor || undefined )
      && _.reduce(
          accessor.split('.'),
          function (prev, curr) { return prev && prev[curr] },
          obj
      );
  }
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
   * If either the transaction data or timeseries data are marked as invalid,
   * sets bot has invalid and removes processed data for them.
   * Can be invalid if for the following reasons:
   * * Never Processed Yet
   * * New data was given
   * * Group or properties were updated
   */
  var _clear = function() {
    if ( !_valid.objs || !_valid.ts ) {
      _valid.objs = false;
      _valid.ts = false;
      _data = {values: {}, series: {}};
      _invalidateDerived();
    }
  }
  /**
   * Mark the derived series (relative/normalized) as invalid.
   * Set them to an empty object, ready to be re-created when needed.
   * This should be called any time _data.values is changed.
   */
  var _invalidateDerived = function(){
    _valid.rel = false;
    _valid.norm = false;
    _data.rel = {};
    _data.norm = {};
  }
  /**
   * Updates the series data with an EvalMetricsResult
   */
  var _processTs = function() {
    if ( _valid.ts ) { return this;}
    _valid.ts = true;
    _invalidateDerived();
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
    _invalidateDerived();
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
      var date = _get(o,dateProp);
      if ( !(date instanceof Date) ) {
        date = new Date(date);
      }
      var dateKey = date.toISOString().substring(0,7)+'-01';
      var period = _checkDateKey(dateKey);
      //Create Key/Series Related Things
      var key = '';
      if ( group && group.length > 0) {
        group.forEach(function(g) {
          key += (_get(o,g) || '');
        })
      } else { key = 'ALL'; }
      if ( typeof _data.series[key] === 'undefined' ) {
        //Initialize a Series Entry
        _data.series[key] = {
          names: {},
          points: {}
        };
        _.each(group, function(g) {
          _data.series[key].names[g] = (_get(o,g) || '');
        });
        if (valueProp) { _data.series[key].points.value = key; }
        if (qtyProp) { _data.series[key].points.qty = key+'Q'; }
        if (spendProp) { _data.series[key].points.spend = key+'S'; }
        if (qtyProp&&spendProp) { _data.series[key].points.price = key+'P'; }
      }
      //Add up data
      if ( valueProp ) {
        if ( typeof period[key] === 'undefined' ) { period[key] = 0; }
        period[key] += (_get(o,valueProp) || 0);
      }
      if ( qtyProp ) {
        if ( typeof period[key+'Q'] === 'undefined' ) { period[key+'Q'] = 0; }
        period[key+'Q'] += (_get(o,qtyProp) || 0);
      }
      if ( spendProp ) {
        if ( typeof period[key+'S'] === 'undefined' ) { period[key+'S'] = 0; }
        period[key+'S'] += (_get(o,spendProp) || 0);
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
    return {
      values: _data.values,
      series: _data.series
    };
  }
  /**
   * Makes a version of _data.values where each value is a relative change from a reference point
   */
  var _relativeChange = function(ref) {
    if ( _valid.rel !== false && ((ref||true) === _valid.rel ) ) { 
      return { rel: _data.rel, series: _data.series };
    }
    _process();
    _valid.rel = ref || true;
    var base = {};
    _data.rel = {}; //Should already be an empty object, but just incase...
    if ( ref ) {
      base = _.find(_data.values, function(o){ return o.key===ref; }) || {};
    }
    var values = _.sortBy(_data.values, 'key');
    //Iterate all period values
    _.each(values, function(period) {
      //Make sure this period exist sin the relative data
      if ( typeof _data.rel[period.key] === 'undefined' ) {
        _data.rel[period.key] = {};
      }
      var relPeriod = _data.rel[period.key];
      //Iterate all series
      _.each(_data.series, function(series) {
        //Iterate each point within the series
        _.each(series.points, function(point) {
          if ( typeof period[point] !== 'undefined' ) {
            //No base value for this point, set it as the base
            if ( typeof base[point] === 'undefined' ) {
              base[point] = period[point];
            }
            //If no base, set relative point as null
            if ( !base[point] ) { relPeriod[point] = null; }
            //Otherwise, set relative point as difference from base point
            else { 
              relPeriod[point] = (period[point] - base[point]) / base[point];
            }
          } else {
            //Set to null if no point
            relPeriod[point] = null;
          }
        });
      });
    });
    return {
      rel: _data.rel,
      series: _data.series
    };
  }
  /**
   * Normalize the data (all values between 0=Min of the series and 1=Max of the series)
   */
  var _normalize = function() {
    if ( _valid.norm ) { 
      return { norm: _data.norm, series: _data.series };
    }
    _process();
    _valid.norm = true;
    _data.norm = {}; //Should already be an empty object, but just incase...
    var ranges = {};
    //First Pass, get ranges
    //Iterate all period values
    _.each(_data.values, function(period) {
      //Iterate all series
      _.each(_data.series, function(series) {
        //Iterate each point within the series
        _.each(series.points, function(point) {
          if ( typeof ranges[point] === 'undefined' ) {
            ranges[point] = { min: null, max: null };
          }
          //Make sure this point has data, otherwise ignore it
          if ( typeof period[point] !== 'undefined' && period[point] !== null ) {
            //Update min/max as needed
            if ( ranges[point].min === null || period[point] < ranges[point].min ) {
              ranges[point].min = period[point];
            }
            if ( ranges[point].max === null || period[point] > ranges[point].max ) {
              ranges[point].max = period[point];
            }
          }
        }); //End each point
      }); //End each series
    }); //End each period
    //Second Pass, Make Norms
    //Iterate all period values
    _.each(_data.values, function(period) {
      //Make sure this period exist sin the relative data
      if ( typeof _data.norm[period.key] === 'undefined' ) {
        _data.norm[period.key] = {};
      }
      var normPeriod = _data.norm[period.key];
      //Iterate all series
      _.each(_data.series, function(series) {
        //Iterate each point within the series
        _.each(series.points, function(point) {
          if ( typeof ranges[point] === 'undefined' || !ranges[point].max ) {
            //Somehow no ranges for this point, make null
            normPeriod[point] = null;
          } else {
            var p = period[point];
            if ( p === null || typeof p === 'undefined' ) {
              normPeriod[point] = null;
            } else {
              p -= ranges[point].min;
              p /= (ranges[point].max-ranges[point].min);
              normPeriod[point] = p;
            }
          }
        });
      });
    });
    return {
      norm: _data.norm,
      series: _data.series,
      ranges: ranges
    };
  }
  /**
   * The returned object.
   * @borrows _normalize as normalized
   * @borrows _relativeChange as relative
   * @borrows _process as series
   */
  var _self = {
    /**
     * Set or Get the transaction data
     * @param {Object[]} _ Array of Objects, each representing a transaction
     * @returns if _ given, returns `this` for chaining.
     * Otherwise, returns the current transaction data.
     */
    data: function(_) {
      if (_) {
        _objs.objs = _;
        _valid.objs = false;
        return this;
      }
      return _objs.objs;
    },
    /**
     * Set or Get the grouping fields to use for transaction data
     * @param {string[]} _ Array of strings, each being part of the aggregation group for transactions.
     * @returns if _ given, returns `this` for chaining.
     * Otherwise, returns the current group data.
     */
    group: function(_) {
      if (_) {
        _objs.group = _;
        _valid.objs = false;
        return this;
      }
      return _objs.group;
    },
    /**
     * Set/Get the props related to Transaction processing.
     * At least one of prop.value, props.qty, props.spend is required.
     * If both props.qty and props.spend are given, a price value will be automatically generated.
     * @param {Object} props Properties to Drive Behavior.
     * @param {string} props.dateField Required. Which property in the data represents the date
     * @param {string} props.value Which property in the data to use as a generic value
     * @param {string} props.qty Which property in the data to use as a quantity value
     * @param {string} props.spend Which property in the data to use as a spend value
     * @returns if _ given, returns `this` for chaining.
     * Otherwise, returns the current props data.
     */
    props: function(_) {
      if (_) {
        _objs.props = _;
        _valid.objs = false;
        return this;
      }
      return _objs.props;
    },
    /**
     * Set/Get the Timeseries data.
     * @param {EvalMetricsResult} _ The result of an `evalMetrics` call. Must contain the `result` property.
     * @returns if _ given, returns `this` for chaining.
     * Otherwise, returns the current ts data.
     */
    ts: function(_) {
      if (_) {
        _ts = _;
        _valid.ts = false;
        return this;
      }
      return _ts;
    },
    _objs: function() { return _objs; },
    _ts: function() { return _ts; },
    _data: function() { return _data; },
    _valid: function() { return _valid; },
    series: _process,
    relative: _relativeChange,
    normalized: _normalize
  }
  /* Set the returned object's prototype to this prototype
   * All it really does is make instanceof return true */
  _self.__proto__ = this.__proto__;
  //Return the object
  return _self;
}