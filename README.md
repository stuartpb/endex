# endex

Ensure indexes (and tables, and DBs...) exist

This library is designed for initializing RethinkDB databases, although the
approach / interface could, conceivably, be extended or copied for systems like
MongoDB.

## Example

```js
var r = require('rethinkdb');
var endex = require('endex');
r.connect().then(function(connection){
  return endex.db('example')
    .table('users', {primaryKey: 'username'})
      .index('email')
      .index('regDate')
      .index('location', {geo: true})
    .table('posts')
      .index('posterId')
    .table('teams')
      .index('members', {multi: true})
    .run(conn);
}).then(function(results){
  // set up routes or whatever
});
```

## Ensuring the same `r`

As the RethinkDB driver [currently requires the same exact module be used][1]
to construct queries as the connections they're run on, this module has two
mechanisms to ensure this is the case.

[1]: https://github.com/stuartpb/endex/issues/1

Firstly, this module (as of 0.2.0) does not include its own `rethinkdb`: it
only lists `rethinkdb` in `peerDependencies`, so as to defer to whatever
`rethinkdb` instance is included above it in the tree.

Secondly, if your package situation is more complex than this (or if you're
using an alternative implementation like `reqlite` or `rethinkdbdash`), you
may provide your `rethinkdb` (compatible) instance via the "r" option to the
main `endex` constructor:

```js
var r = require('rethinkdbdash')(
  pool: false,
  cursor: true
);
var endex = require('endex');
r.connect().then(function(connection) {
  return endex(r).db('example')
    .table('etc')
      .index('yadda_yadda_yadda')
    .run(conn);
}).then(function(results){
  // set up routes or whatever
});
```
