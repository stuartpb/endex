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
    tables[name] = tables[name] || {indexes: Object.create(null)};
    tables[name].opts = opts || tables[name].opts || {},
    currentTable = name;
    return obj;
  };
  obj.index = function endexSpecifyIndex(name, opts) {
    if (!currentTable) throw new Error('no table specified');
    tables[currentTable].indexes[name] = opts ||
      tables[currentTable].indexes[name] || {};
    return obj;
  };

  // Execution.
  obj.run = function endexRun(conn, cb) {
    // Each r.branch for the expr to run.
    var exprObject = {tables: {}, indexes: {}};

    // If we're starting with a named DB
    if (dbName) {
      // Use the DB in the connection
      conn.use(dbName);
      // Push a branch to ensure the DB exists
      exprObject.db = r.branch(
        r.dbList().contains(dbName),
        r.expr({config_changes: [], dbs_created: 0}),
        r.dbCreate(dbName));
    }

    var tableNames = Object.keys(tables);
    var i, j, tableName, indexName;

    // For each table
    for (i=0; i < tableNames.length; i++) {
      tableName = tableNames[i];
      var tableOpts = tables[tableName].opts;
      // Add a branch ensuring it exists
      exprObject.tables[tableName] = r.branch(
        r.tableList().contains(tableName),
        r.expr({config_changes: [], tables_created: 0}),
        r.tableCreate(tableName, tableOpts));
    }

    // For each table (now that we've created all the tables)
    for (i=0; i < tableNames.length; i++) {
      tableName = tableNames[i];
      var indexes = tables[tableName].indexes;
      var indexNames = Object.keys(indexes);
      if (indexNames.length > 0) {
        var exprTableIndexes = {};
        exprObject.indexes[tableName] = exprTableIndexes;
      }
      // For each index to create under that table
      for (var j=0; j < indexNames.length; j++) {
        indexName = indexNames[j];
        var indexOpts = indexes[indexName];
        // Add a branch ensuring that index exists
        exprTableIndexes[indexName] = r.branch(
          r.table(tableName).indexList().contains(indexName),
          r.expr({created: 0}),
          r.table(tableName).indexCreate(indexName, indexOpts).merge(
            r.table(tableName).indexStatus(indexName)));
      }
    }

    // Use callback or return promise
    if (cb) r.expr(exprObject).run(conn, function(err, response) {
      if (err) return cb(err);
      else return cb(null, response);
    });
    else return new Promise(function(resolve, reject) {
      r.expr(exprObject).run(conn).then(resolve, reject);
    });
  };
  return obj;
}

module.exports = EndexObject;
module.exports.db = function EndexDb(name) {
  return EndexObject().db(name);
};
