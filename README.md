# endex
Ensure that indices exist

This library is currently designed for RethinkDB databases:

```js
var rdb = require('rethinkdb');
var db = rdb.connect();
var endex = require('endex');
endex().table
```

This approach could, conceivably, be extended to systems like MongoDB.
