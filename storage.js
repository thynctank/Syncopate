function Storage(name) {
  this.db = openDatabase(name);
} 

Storage.prototype = {
  _buildRows: function(resultSet) {
    var rows = [];
    for(var i = 0, j = resultSet.rows.length; i < j; i++) {
      rows.push(resultSet.rows.item(i));
    }
    return rows;
  },
  // success always takes an array of row objects, failure takes an error string
  run: function(sql, success, failure) {
    var self = this;
    if(success) {
      var oldSuccess = success;
      success = function(resultSet, insertId) {
        if(insertId)
          oldSuccess(insertId);
        else
          oldSuccess(self._buildRows(resultSet));
      };
    }
    else {
      var success = function(resultSet) {
        if(resultSet.length > 0)
          console.log(self._buildRows(resultSet));
      };
    }
    
    console.log(sql);
    this.db.transaction(function(tx) {
      tx.executeSql(sql, [],
        function(tx, resultSet) {
          if(sql.search("INSERT") !== -1)
            success(resultSet, resultSet.insertId);
          else
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
  // conditions is obj literal with {colName: reqVal, colName: reqVal}
  read: function(table, conditions, options, success, failure) {
    var conditionSql = "";
    for(colName in conditions) {
      if(typeof conditions[colName] === "string")
        conditionSql += colName + " = '" + conditions[colName] + "' AND ";
      else
        conditionSql += colName + " = " + conditions[colName] + " AND ";
    }
    conditionSql = conditionSql.slice(0, -4);
    
    var sql = "SELECT * FROM " + table;
    if(conditions)
      sql += " WHERE " + conditionSql;
      
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
      success = function(rows) {
        oldSuccess(rows.length);
      };
    }
    else {
      var success = function(rows) {
        console.log(rows.length);
      };
    }
    this.read(table, conditions, success, failure);
  },
  // data is obj literal with {colName: colVal, colName: colVal}
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
    }
    this.run(sql, success, failure);
  },
  // conditions is an obj literal with {colName: reqVal, colName: reqVal}
  erase: function(table, conditions, success, failure) {
    var conditionSql = "";
    if(conditions) {
      for(colName in conditions) {
        if(typeof conditions[colName] === "string")
          conditionSql += colName + " = " + "'" + conditions[colName] + "' AND ";
        else
          conditionSql += colName + " = " + conditions[colName] + " AND ";
      }
      conditionSql = " WHERE " + conditionSql.slice(0, -4);
    }
    var sql = "DELETE FROM " + table + conditionSql;
    this.run(sql, success, failure);
  },
  // func takes a tx obj and has a series of tx.executeSql calls and throws an exception at some point if unhappy path is found
  transact: function(func) {
    this.db.transaction(func);
  }
};