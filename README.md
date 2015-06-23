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
    .run(connection);
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
  return endex({ r: r }).db('example')
    .table('etc')
      .index('yadda_yadda_yadda')
    .run(connection);
}).then(function(results){
  // set up routes or whatever
});
```

## Using the driver itself as the options object

Because the `rethinkdb` driver contains a reference to itself as `r.r`,
you may use `r` as your options argument to the `endex` constructor:

```js
var endex;
var r = require('rethinkdb');
endex = require('endex')(r);
// will work the same as
endex = require('endex')({r:r});
```

Depending on your `r` implementation, this *may* break if `endex` ever
goes on to look for options that have the same name as a method or
property of the driver: in this case, you will need to create an
explicit options object with `{r:r}` to pass in instead.
