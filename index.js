var r = require('rethinkdb');
var Promise = require('bluebird');

function EndexObject() {
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
    tables[name] = tables[name] || {indices: Object.create(null)};
    tables[name].opts = opts || tables[name].opts || {},
    currentTable = name;
    return obj;
  };
  obj.index = function endexSpecifyIndex(name, opts) {
    if (!currentTable) throw new Error('no table specified');
    tables[currentTable].indices[name] = opts ||
      tables[currentTable].indices[name] || {};
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
        r.expr({config_changes: [], dbs_created: 0}),
        r.dbCreate(dbName)));
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
        r.expr({config_changes: [], tables_created: 0}),
        r.tableCreate(tableName, tableOpts)));
    }

    // For each table (now that we've created all the tables)
    for (i=0; i < tableNames.length; i++) {
      tableName = tableNames[i];
      var indices = tables[tableName].indices;
      var indexNames = Object.keys(indices);
      // For each index to create under that table
      for (var j=0; j < indexNames.length; j++) {
        indexName = indexNames[j];
        var indexOpts = indices[indexName];
        // Add a branch ensuring that index exists
        branches.push(r.branch(
          r.table(tableName).indexList().contains(indexName),
          r.expr({created: 0}),
          r.table(tableName).indexCreate(indexName, indexOpts)));
      }
    }

    // Convert the expr response to something simpler
    function convertResponse(response) {
      var results = {tables: []};
      var i=0;
      var start=0;
      if (dbName) {
        results.dbCreated = (response[0].dbs_created > 0);
        start++;
        i++;
      }
      while (i < start + tableNames.length) {
        tableName = tableNames[i-start];
        results.tables[i-start]={
          name: tableName,
          created: (response[i].tables_created > 0),
          indexList: []
        };
        i++;
      }
      start = start + tableNames.length;
      if (tableNames.length > 0) {
        var j = 0;
        var indexNames = Object.keys(tables[tableNames[j]].indices);
        while (i < response.length) {
          results.tables[j].indexList[i-start] = {
            name: indexNames[i-start],
            created: (response[i].created > 0)
          };
          i++;
          if (i-start >= indexNames.length && i < response.length){
            j++;
            indexNames = Object.keys(tables[tableNames[j]].indices);
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
