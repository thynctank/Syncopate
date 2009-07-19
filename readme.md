Syncopate Asynchronous Abstraction Layer
========================================

Syncopate is a simple abstraction layer on top of HTML5 (and perhaps additional async databases in the future) which can be used to easily read, write, and erase rows from the db, create and drop tables, and eventually will provide easy functionality for performing multiples of these actions nested in transactions.

Syncopate is free and open-source software, licensed under [MIT License](http://www.opensource.org/licenses/mit-license.php)

Documentaion of Functions
=========================

All functionality in Syncopate is handled as methods of the Storage class. To begin using it, you must first instantiate Storage like so:

      var s = new Storage('myDbName');

Once you have an instance, you can call on the functionality like so:

      var initialData = [
        {label: "Box One", contents: "Empty"},
        {label: "Box Thirty", contents: "It's a Secret!"},
        {label: "Box One More", contents: "Socks"}
      ];

      s.createTable("boxes", {label: "string", contents: "string"}, function() {
        for(var i = 0, j = initialData.length; i < j; i++) {
          s.write("boxes", initialData[i]);
        }
      });
      
This sample demonstrates the usage pattern for all calls in Syncopate, which is that *dependent actions must occur as calls nested inside of their independent predecessors*. In the example, we could not write the box data into a table if the table didn't first exist, so we call `createTable` and as its success callback we loop through the initialData object and `write` the individual records to the table. Note the inner function which calls on Syncopate does not use a callback, and we are in fact *launching multiple asynchronous processes* via this loop.

Methods of the Storage class all behave in a similar fashion: They take one to three parameters with which to run their functionality, and optionally they take a success callback and a failure callback. These callbacks are executed when the database has been updated (or failed to update) by the wrapping function call.

Running Raw SQL
---------------

Syncopate can run raw SQL queries using `run()`. This method takes a query string as its required parameter.

`run(sql, success, failure)`: `sql` is a raw SQL query. `success` callback can optionally take a "rows" or "lastInsertedId" parameter if the query being run is a SELECT or an INSERT. Generally speaking, `run()` can be avoided, but it's there if you need to run custom queries. `failure` callback takes a string indicating the error message generated.

Schema
------

Syncopate can currently create and drop tables via `createTable()` and `dropTable()`.

`createTable(tableName, columnsObj, success, failure)`: `tableName` is name of table to be created. Tables will only be created if they do not already exist in the database. `columnsObj` is an object literal with properties matching the names of the table you intend to create, and values matching the column types. Note that SQLite (the database used by most Syncopate-capable browsers and runtimes) does not internally respect/enforce these column types, but other systems may. Also note that a column named `id` will automatically be included and should *not* be manually included in the columnsObj. This column will autoincrement and is a unique identifier for rows in the table.

`dropTable(tableName, success, failure)`: `tableName` is the name of the table to be dropped.

Writing a Row to a Table
-----------------------

`write(tableName, data, success, failure)`: `tableName` is name of table to write to. `data` is an object literal with property names matching column names in the table, and values indicating values you want written to a row. If a property/column name of `id` is present in the `data` object, an UPDATE will be performed. If this property is *not* present, an INSERT will be performed.

Reading Rows from a Table
-------------------------

`read(tableName, conditions, options, success, failure)`: `tableName` is name of table to read from. `conditions` is an object literal with properties matching column names in the table being queried and values matching conditional values on those specific columns. `options` is an object literal with properties matching a number of available SELECT statement modifiers (group, order, limit and offset are available) and properties matching the values to pass into these SQL clauses. The success callback of a `read()` call 

An example may help to illustrate.

      s.read("boxes", {contents: "Empty"}, {}, function(rows) {
        for(var i = 0, j = rows.length; i < j; i++) {
          // do something with this row's data
        }
      });
      
This example shows a query on the boxes table, requiring that rows match a contents of "Empty" to be returned. Once these rows are obtained, they are passed back to the success callback as the `rows` parameter, and can be looped over, have their individual contents inspected, etc.

Obtaining the Number of Rows in a Table
---------------------------------------

`count(tableName, conditions, success, failure)`: `tableName` is name of table to count in. `conditions` is an object literal exactly as specified for the `read()` method. `success` callback takes a number representing the number of matching rows, or count of all rows in table if no conditions are passed in.

Erasing Data from a Table
-------------------------

`erase(tableName, conditions, success, failure)`: `tableName` is name of table to erase from. `conditions` matches the object described in `read()` description. DELETEs all rows matching conditions, or all rows if no conditions are passed in.