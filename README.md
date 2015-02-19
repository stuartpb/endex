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
