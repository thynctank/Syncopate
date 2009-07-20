function Storage(name) {
  this.db = openDatabase(name);
} 

Storage.prototype = {
  _buildRows: function(resultSet) {
    var rows = [];
    for(var i = 0, j = resultSet.rows.length; i < j; i++) {
      var currentRow = resultSet.rows.item(i);
      var usableRow = {};
      for(var col in currentRow) {
        usableRow[col] = currentRow[col];
      }
      rows.push(usableRow);
    }
    return rows;
  },
  // success always takes an array of row objects, failure takes an error string
  run: function(sql, success, failure) {
    console.log(sql);
    this.db.transaction(function(tx) {
      tx.executeSql(sql, [],
        function(tx, resultSet) {
          if(success)
            success(resultSet);
        },
        function(tx, error) {
          if(failure)
            failure(error.message);
        }
      );
    });
  },
  // cols should be obj literal with {colName: colType, colName: colType}
  createTable: function(name, cols, success, failure) {
    var colSql = "";
    for(colName in cols) {
      colSql += ", " + colName + " " + cols[colName];
    }
    
    var sql = "CREATE TABLE IF NOT EXISTS " + name + " (id INTEGER PRIMARY KEY AUTOINCREMENT" + colSql + ")";
    this.run(sql, success, failure);
  },
  dropTable: function(name, success, failure) {
    var sql = "DROP TABLE " + name;
    this.run(sql, success, failure);
  },
  _buildConditionSql: function(conditions) {
    var conditionSql = "";
    for(colName in conditions) {
      if(typeof conditions[colName] === "string")
        conditionSql += colName + " = '" + conditions[colName] + "' AND ";
      else
        conditionSql += colName + " = " + conditions[colName] + " AND ";
    }
    conditionSql = conditionSql.slice(0, -4);

    return (" WHERE " + conditionSql);
  },
  // conditions is obj literal with {colName: reqVal, colName: reqVal}
  read: function(table, conditions, options, success, failure) {
    var self = this;
    if(success) {
      var oldSuccess = success;
      success = function(resultSet) {
        var rows = self._buildRows(resultSet);
        oldSuccess(rows);
      };
    }
    else {
      var success = function(resultSet) {
        var rows = self._buildRows(resultSet);
        console.log(rows);
      };
    }
    
    var sql = "SELECT * FROM " + table;
    if(conditions)
      sql += this._buildConditionSql(conditions);
      
    if(options) {
      if(options.group)
        sql += " GROUP BY " + options.group;
      if(options.order)
        sql += " ORDER BY " + options.order;
      if(options.limit)
        sql += " LIMIT " + options.limit;
      if(options.offset)
        sql += " OFFSET " + options.offset;
    }

    this.run(sql, success, failure);
  },
  // success always takes rowCount
  count: function(table, conditions, success, failure) {
    if(success) {
      var oldSuccess = success;
      success = function(resultSet) {
        var rowCount = resultSet.rows.item(0)["COUNT(*)"];
        oldSuccess(rowCount);
      };
    }
    else {
      var success = function(resultSet) {
        var rowCount = resultSet.rows.item(0)["COUNT(*)"];
        console.log(rowCount);
      };
    }
    
    var sql = "SELECT COUNT(*) FROM " + table;
    if(conditions)
      sql += this._buildConditionSql(conditions);
    
    this.run(sql, success, failure);
  },
  // data is obj literal with {colName: colVal, colName: colVal}
  // success takes no params for update, insertId if insert
  write: function(table, data, success, failure) {
    if(data.id) {
      // build assignment pairs and trim trailing comma
      var setSql = "";
      for(colName in data) {
        if(typeof data[colName] === "string")
          setSql += colName + " = '" + data[colName] + "', ";
        else
          setSql += colName + " = " + data[colName] + ", ";
      }
      setSql = setSql.slice(0, -2);
      
      var sql = "UPDATE " + table + " SET " + setSql + " WHERE id = " + data.id;
      
      if(success) {
        var oldSuccess = success;
        success = function(resultSet) {
          oldSuccess();
        };
      }
      else {
        var success = function(resultSet) {
          console.log(resultSet);
        };
      }
    }
    else {
      var colSql = "", valSql = "";
      for(colName in data) {
        colSql += colName + ", ";
        if(typeof data[colName] === "string")
          valSql += "'" + data[colName] + "', ";
        else
          valSql += data[colName] + ", ";
      }
      colSql = colSql.slice(0, -2);
      valSql = valSql.slice(0, -2);
      
      var sql = "INSERT INTO " + table + " (" + colSql + ") VALUES(" + valSql + ")";
      
      if(success) {
        var oldSuccess = success;
        success = function(resultSet) {
          oldSuccess(resultSet.insertId);
        };
      }
      else {
        var success = function(resultSet) {
          console.log(resultSet.insertId);
        };
      }
    }
    this.run(sql, success, failure);
  },
  // conditions is an obj literal with {colName: reqVal, colName: reqVal}
  erase: function(table, conditions, success, failure) {
    var sql = "DELETE FROM " + table;
    if(conditions)
      sql += this._buildConditionSql(conditions);
    this.run(sql, success, failure);
  },
  // func takes a tx obj and has a series of tx.executeSql calls and throws an exception at some point if unhappy path is found
  transact: function(func) {
    this.db.transaction(func);
  }
};