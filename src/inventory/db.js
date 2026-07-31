const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'warehouse.db');

let db;

function initDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database', err.message);
        reject(err);
      } else {
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            stock INTEGER NOT NULL,
            threshold INTEGER NOT NULL,
            restock_qty INTEGER NOT NULL,
            price REAL NOT NULL
        )`, (err) => {
          if (err) {
            console.error('Error creating table', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  });
}

function getProducts() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getProduct(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function updateStock(id, newStock) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

function getDbInstance() {
  return db;
}

module.exports = {
  initDb,
  getProducts,
  getProduct,
  updateStock,
  getDbInstance
};
