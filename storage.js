function Storage(name, size) {
  // default to 5MB, passing all params in case browsers start getting more stingy
  size = size || 5 * 1024 * 1024;
  if(navigator.userAgent.indexOf("webOS") != -1)
    this.db = openDatabase(name + ".syncopate.db");
  else
    this.db = openDatabase(name + ".syncopate.db", "", "", size, function(){});
} 

Storage.prototype = {
  logging: false,
  _log: function(obj) {
    if(!this.logging)
      return;
    // branch the lazy definition of _log (jacked from JazzRecord)
    if(typeof Titanium !== "undefined") {
      this._log = function(obj) {
        Titanium.API.debug(obj);
      };
    }
    
    else if(typeof Mojo !== "undefined") {
      this._log = function(obj) {
        Mojo.Log.error(obj);
      };
    }
    
    else if(typeof console !== "undefined" && typeof console.log === "function") {
      this._log = function(obj) {
        console.log(obj);
      };
    }
    this._log(obj);
  },
  // copy all col data from read-only row object into new writable object
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
  _escapeString: function(str) {
    return "'" + str.replace(/'/g, "''") +  "'";
  },
  _buildConditionSql: function(conditions) {
    var conditionSql = "",
        sqlParts = [],
        condition,
        operator,
        operand,
        element;
    if(!conditions)
      return conditionSql;
    
    for(colName in conditions) {
      condition = conditions[colName];
      if(typeof condition === "string") {
        sqlParts.push(colName + " = " + this._escapeString(condition));
      }
      else if(condition.constructor === Array) {
        operator = condition[0];
        operand = condition[1];
        if(typeof operand === "string") {
          if(operator.toLowerCase() != "in")
            operand = this._escapeString(operand);
        }
        else if(operand.constructor === Array) {
          for(i = 0, j = operand.length; i < j; i++) {
            element = operand[i];
            if(typeof element === "string")
              operand[i] = this._escapeString(element);
          }
          operand = "(" + operand.join(",") + ")";
        }
        sqlParts.push(colName + " " + operator + " " + operand);
      }
      else
        sqlParts.push(colName + " = " + condition);
    }
    conditionSql = sqlParts.join(" AND ");

    if(conditionSql)
      conditionSql = " WHERE " + conditionSql;
      
    return conditionSql;
  },
  _buildUpdateSql: function(table, data) {
    var setSql = "";
    for(colName in data) {
      if(typeof data[colName] === "string")
        setSql += colName + " = '" + data[colName].replace(/'/g, "''") + "', ";
      else
        setSql += colName + " = " + data[colName] + ", ";
    }
    
    setSql = setSql.slice(0, -2);
    
    var sql = "UPDATE " + table + " SET " + setSql;
    if(data.id) 
      sql += " WHERE id = " + data.id;
      
    return sql;
  },
  // success always takes an array of row objects, failure takes an error string
  run: function(sql, success, failure, transaction) {
    this._log(sql);
    if(success && transaction) {
      var oldSuccess = success;
      success = function(tx, resultSet) {
        oldSuccess(resultSet);
      };
    }
    if(transaction)
      transaction.executeSql(sql, [], success, failure);
    else {
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
    }
  },
  // cols should be obj literal with {colName: colType, colName: colType}
  createTable: function(name, cols, success, failure, tx) {
    var colSql = "";
    for(colName in cols) {
      colSql += ", " + colName + " " + cols[colName];
    }
    
    var sql = "CREATE TABLE IF NOT EXISTS " + name + " (id INTEGER PRIMARY KEY AUTOINCREMENT" + colSql + ")";
    this.run(sql, success, failure, tx);
  },
  dropTable: function(name, success, failure, tx) {
    var sql = "DROP TABLE IF EXISTS " + name;
    this.run(sql, success, failure, tx);
  },
  renameTable: function(oldName, newName, success, failure, tx) {
    var sql = "ALTER TABLE " + oldName + " RENAME TO " + newName;
    this.run(sql, success, failure, tx);
  },
  createIndex: function(tableName, colName, success, failure, tx) {
    var sql = "CREATE INDEX IF NOT EXISTS " + tableName + "_" + colName + "_index ON " + tableName + " (" + colName + ")";
    this.run(sql, success, failure, tx);
  },
  dropIndex: function(tableName, colName, success, failure, tx) {
    var sql = "DROP INDEX IF EXISTS " + tableName + "_" + colName + "_index";
    this.run(sql, success, failure, tx);
  },
  addColumn: function(tableName, colName, colType, success, failure, tx) {
    var sql = "ALTER TABLE " + tableName + " ADD COLUMN " + colName + " " + colType;
    this.run(sql, success, failure, tx);
  },
  // conditions is obj literal with {colName: reqVal, colName: reqVal} or {colName: [comparisonOp, comparisonVal]}
  read: function(table, conditions, options, success, failure, tx) {
    var self = this;
    if(success) {
      var oldSuccess = success;
      success = function(resultSet) {
        var rows = self._buildRows(resultSet);
        oldSuccess(rows);
      };
    }
    else {
      success = function(resultSet) {
        var rows = self._buildRows(resultSet);
        self._log(rows);
      };
    }
    
    var sql = "SELECT * FROM " + table;
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

    this.run(sql, success, failure, tx);
  },
  // success always takes rowCount
  count: function(table, conditions, success, failure, tx) {
    if(success) {
      var oldSuccess = success;
      success = function(resultSet) {
        var rowCount = resultSet.rows.item(0)["COUNT(*)"];
        oldSuccess(rowCount);
      };
    }
    else {
      var self = this;
      success = function(resultSet) {
        var rowCount = resultSet.rows.item(0)["COUNT(*)"];
        self._log(rowCount);
      };
    }
    
    var sql = "SELECT COUNT(*) FROM " + table;
    sql += this._buildConditionSql(conditions);
    
    this.run(sql, success, failure, tx);
  },
  // data is obj literal with {colName: colVal, colName: colVal}
  // success takes no params for update, insertId if insert
  write: function(table, data, success, failure, tx) {
    var self = this,
        sql,
        oldSuccess;
    if(data.id) {
      // build assignment pairs and trim trailing comma
      sql = this._buildUpdateSql(table, data);
      
      if(success) {
        oldSuccess = success;
        success = function(resultSet) {
          oldSuccess();
        };
      }
      else {
        success = function(resultSet) {
          self._log(resultSet);
        };
      }
    }
    else {
      var colSql = "", valSql = "";
      for(colName in data) {
        colSql += colName + ", ";
        if(typeof data[colName] === "string")
          valSql += "'" + data[colName].replace(/'/g, "''") + "', ";
        else
          valSql += data[colName] + ", ";
      }
      colSql = colSql.slice(0, -2);
      valSql = valSql.slice(0, -2);
      
      sql = "INSERT INTO " + table + " (" + colSql + ") VALUES(" + valSql + ")";
      
      if(success) {
        oldSuccess = success;
        success = function(resultSet) {
          oldSuccess(resultSet.insertId);
        };
      }
      else {
        success = function(resultSet) {
          self._log(resultSet.insertId);
        };
      }
    }
    this.run(sql, success, failure, tx);
  },
  update: function(table, data, conditions, success, failure, tx) {
    var sql = this._buildUpdateSql(table, data);
    sql += this._buildConditionSql(conditions);
    
    if(success) {
      var oldSuccess = success;
      success = function(resultSet) {
        oldSuccess();
      };
    }
    else {
      var self = this;
      success = function(resultSet) {
        self._log(resultSet);
      };
    }
    
    this.run(sql, success, failure, tx);
  },
  // conditions is an obj literal with {colName: reqVal, colName: reqVal}
  erase: function(table, conditions, success, failure, tx) {
    var sql = "DELETE FROM " + table;
    sql += this._buildConditionSql(conditions);
    this.run(sql, success, failure, tx);
  },
  // func takes a tx obj
  transact: function(func, success, failure) {
    this.db.transaction(func, failure || function(){}, success || function(){});
  }
};