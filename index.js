var Promise = require('bluebird');

function EndexObject(opts) {
  // See https://github.com/stuartpb/endex/issues/1
  var r = opts.r || require('rethinkdb');

  // Local vars.
  var obj = {};
  var tables = Object.create(null);
  var currentTable = null;
  var dbName = null;

  // Specification interface.
  obj.db = function endexSpecifyDb(name, opts) {
    dbName = name;
    return obj;
  };
  obj.table = function endexSpecifyTable(name, opts) {
    tables[name] = tables[name] || {
      indexOpts: Object.create(null), indexFunctions: Object.create(null)};
    tables[name].opts = opts || tables[name].opts || {},
    currentTable = name;
    return obj;
  };
  obj.index = function endexSpecifyIndex(name, func, opts) {
    if (!currentTable) throw new Error('no table specified');
    tables[currentTable].indexOpts[name] = opts || func ||
      tables[currentTable].indexOpts[name] || {};
    tables[currentTable].indexFunctions[name] = opts && func;
    return obj;
  };

  // Execution.
  obj.run = function endexRun(conn, cb) {
    // Each r.branch for the expr to run.
    var branches = [];

    // If we're starting with a named DB
    if (dbName) {
      // Use the DB in the connection
      conn.use(dbName);
      // Push a branch to ensure the DB exists
      branches.push(r.branch(
        r.dbList().contains(dbName),
        r.expr({config_changes: [], dbs_created: 0}).merge(
          r.db(dbName).config()),
        r.dbCreate(dbName).merge(
          r.db(dbName).config())));
    }

    var tableNames = Object.keys(tables);
    var i, j, tableName, indexName;

    // For each table
    for (i=0; i < tableNames.length; i++) {
      tableName = tableNames[i];
      var tableOpts = tables[tableName].opts;
      // Add a branch ensuring it exists
      branches.push(r.branch(
        r.tableList().contains(tableName),
        r.expr({config_changes: [], tables_created: 0}).merge(
          r.table(tableName).config()),
        r.tableCreate(tableName, tableOpts).merge(
          r.table(tableName).config())));
    }

    // For each table (now that we've created all the tables)
    for (i=0; i < tableNames.length; i++) {
      tableName = tableNames[i];
      var indexOpts = tables[tableName].indexOpts;
      var indexFunctions = tables[tableName].indexFunctions;
      var indexNames = Object.keys(indexOpts);
      // For each index to create under that table
      for (var j=0; j < indexNames.length; j++) {
        indexName = indexNames[j];
        var indexOptObj = indexOpts[indexName];
        var indexFunc = indexFunctions[indexName];
        // Add a branch ensuring that index exists
        branches.push(r.branch(
          r.table(tableName).indexList().contains(indexName),
          r.expr({created: 0}).merge(
            r.table(tableName).indexStatus(indexName)),
          (indexFunc ?
            r.table(tableName).indexCreate(indexName, indexFunc, indexOptObj) :
            r.table(tableName).indexCreate(indexName, indexOptObj)).merge(
            r.table(tableName).indexStatus(indexName))));
      }
    }

    // Convert the expr response to something simpler
    function convertResponse(response) {
      var results = {tables: [], indexes: []};
      var i=0;
      var start=0;
      if (dbName) {
        results.db = response[0];
        start++;
        i++;
      }
      while (i < start + tableNames.length) {
        tableName = tableNames[i-start];
        results.tables[i-start]=response[i];
        i++;
      }
      start = start + tableNames.length;
      if (tableNames.length > 0) {
        var j = 0;
        var indexNames = Object.keys(tables[tableNames[j]].indexOpts);
        var indexResults;
        indexResults = [];
        results.indexes[j] = indexResults;
        while (i < response.length) {
          indexResults[i-start] = response[i];
          i++;
          while (i-start >= indexNames.length && i < response.length){
            j++;
            indexNames = Object.keys(tables[tableNames[j]].indexOpts);
            indexResults = [];
            results.indexes[j] = indexResults;
            start = i;
          }
        }
      }
      return results;
    }

    // Use callback or return promise
    if (cb) r.expr(branches).run(conn, function(err, response) {
      if (err) return cb(err);
      else return cb(null, convertResponse(response));
    });
    else return new Promise(function(resolve, reject) {
      r.expr(branches).run(conn).then(
        function(response){return resolve(convertResponse(response))},
      reject);
    });
  };
  return obj;
}

module.exports = EndexObject;
module.exports.db = function EndexDb(name) {
  return EndexObject().db(name);
};
