Syncopate Asynchronous Abstraction Layer
========================================

Syncopate is a simple abstraction layer on top of HTML5/Web Database (and perhaps additional async databases in the future) which can be used to easily read, write, erase, update and count rows from the db, create, drop, and rename tables, add columns, create/drop indices, and performing multiples of these actions nested in transactions.

Syncopate comes with a set of automated unit tests written with [QUnit](http://docs.jquery.com/QUnit).

Syncopate is free and open-source software, licensed under [MIT License](http://www.opensource.org/licenses/mit-license.php)

Documentaion of Functions
=========================

All functionality in Syncopate is handled as methods on instances of the Storage class. To begin using it, you must first instantiate Storage like so:

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

Schema Operations
-----------------

Syncopate can currently create and drop tables via `createTable()` and `dropTable()`. You can also add columns and rename tables with `addColumn()` and `renameTable()`. Indices to speed selecting on columns can be added/removed from the table via `createIndex()` and `dropIndex()`.

`createTable(tableName, columnsObj, success, failure)`: `tableName` is name of table to be created. Tables will only be created if they do not already exist in the database. `columnsObj` is an object literal with properties matching the names of the table you intend to create, and values matching the column types. Note that SQLite (the database used by most Syncopate-capable browsers and runtimes) does not internally respect/enforce these column types, but other systems may. Also note that a column named `id` will automatically be included and should *not* be manually included in the columnsObj. This column will autoincrement and is a unique identifier for rows in the table.

`dropTable(tableName, success, failure)`: `tableName` is the name of the table to be dropped.

`renameTable(oldName, newName, success, failure)`: `oldName` is the name of the table to be renamed. `newName` is the new name for the table.

`addColumn(tableName, colName, colType, success, failure)`: `tableName` is the name of the table on which to add a column. `colName` and `colType` describe the name/type of the column.

`createIndex(tableName, colName, success, failure)`: `tableName` is the name of table on which to add an index, and `colName` is the column to index.

`dropIndex(tableName, colName, success, failure)`: `tableName` is the name of table on which to add an index, and `colName` is the column to index.

Writing a Row to a Table
------------------------

`write(tableName, data, success, failure)`: `tableName` is name of table to write to. `data` is an object literal with property names matching column names in the table, and values indicating values you want written to a row. If a property/column name of `id` is present in the `data` object, an UPDATE will be performed. If this property is *not* present, an INSERT will be performed.

Reading Rows from a Table
-------------------------

`read(tableName, conditions, options, success, failure)`: `tableName` is name of table to read from. `conditions` is an object literal with properties matching column names in the table being queried and values matching conditional values on those specific columns. When passing in simple scalar values, these conditions will be made as equality conditions. When being passed an array, the first element of the array should be a string containing the comparison operator of choice, and the second element should be the comparison value. `options` is an object literal with properties matching a number of available SELECT statement modifiers (group, order, limit and offset are available) and properties matching the values to pass into these SQL clauses. The success callback of a `read()` call

An example may help to illustrate. Here we read up the first box whose contents is set to "Empty" and change a few column values before writing them back down, updating the existing record.

    s.read("boxes", {contents: "Empty"}, {limit: 1}, function(rows) {
      rows[0].label = "Empty box";
      rows[0].contents = "";
      s.write("boxes", rows[0]);
    });
      
This example shows a query on the boxes table. Once the data are obtained, they are passed back to the success callback as the `rows` parameter, and can be looped over, have their individual contents inspected, etc. Any row data processed within the callback will have its `id` property set ahead of time, and so writing it back down causes an UPDATE, not an INSERT.

An example of arbitrary comparison operators:

    s.read("boxes", {contents: ["NOT LIKE", "%crap%"]}, null, function(rows) {
      //do stuff
    });
      
This will find all boxes whose contents is NOT LIKE '%crap%'. The SQL will be generated appropriately and results passed into the callback as with the previous example. Also note the passing in of a null value for the options object, since we have no need to modify the query beyond the conditions.

Updating Rows in a Table Conditionally
--------------------------------------

`update(tableName, data, conditions, success, failure)`: `tableName` is name of table to update. `data` describes the columns to update and the values for those columns. Not all columns need be specified. `conditions` is an object literal as explained in `read()` description. All rows matching conditions specified will be updated accordingly.

Obtaining the Number of Rows in a Table
---------------------------------------

`count(tableName, conditions, success, failure)`: `tableName` is name of table to count in. `conditions` is an object literal exactly as specified for the `read()` method. `success` callback takes a number representing the number of matching rows, or count of all rows in table if no conditions are passed in.

Erasing Data from a Table
-------------------------

`erase(tableName, conditions, success, failure)`: `tableName` is name of table to erase from. `conditions` matches the object described in `read()` description. DELETEs all rows matching conditions, or all rows if no conditions are passed in.

Optimizing Sequential Operations with Transactions
--------------------------------------------------

Transactions group related operations together and ensure than either all or none of the operations are run. If any error is encountered, a ROLLBACK occurs, ensuring data never reaches a "partially modified" state. In addition to ensuring this all or none requirement, grouping operations in a single transaction requires less overhead than running them separately, which incurs a new transaction overhead for every operation. Transactions are vital for representing any transfer of value from one column to another.

`transact(func, success, failure)`: func is an arbitrary function provided by the user, which groups multiple operations together. This function should take a transaction object, conventially passed as `tx`, and pass it along to any operations performed within the function. All public functions available in Syncopate can be passed an optional final argument representing a running transaction, which will allow the system to treat these operations as part of the combined transaction. As usual, sequential dependent actions must be called as the success callback for their independent predecessors. In order to programmatically trigger rollback of the database, throw an error anywhere within `func`.

    s.transact(function(tx) {
      s.erase("boxes", null, function() {
        s.write("boxes", {label: "A", contents: "nothing much"}, function() {
          s.write("boxes", {label: "B", contents: "a whole lot"}, function() {
            s.count("boxes", null, function(rowCount) {
              console.log(rowCount + " boxes in total");
            }, null, tx);
          }, null, tx);
        }, null, tx);
      }, null, tx);
    }, function() {console.log("success")}, function() {console.log("failure")});

This transaction consists of the erasure of all existing boxes, followed by the writing of two separate boxes (A and B), followed by a count of boxes which is printed to console. At the end a success callback is fired, as transactions, like their component operations, can have optional `success` and `failure` callbacks.