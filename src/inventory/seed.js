const { initDb, getDbInstance } = require('./db');

async function seed() {
  try {
    await initDb();
    console.log('Database initialized.');

    const db = getDbInstance();
    const products = [
      { name: 'Diet Coke', stock: 50, threshold: 10, restock_qty: 24, price: 1.50 },
      { name: 'MacBook Pro M3', stock: 5, threshold: 2, restock_qty: 5, price: 1999.00 },
      { name: 'GPU Server Rack', stock: 2, threshold: 1, restock_qty: 1, price: 15000.00 }
    ];

    const insertStmt = db.prepare('INSERT INTO products (name, stock, threshold, restock_qty, price) VALUES (?, ?, ?, ?, ?)');

    for (const product of products) {
      insertStmt.run([product.name, product.stock, product.threshold, product.restock_qty, product.price]);
    }
    
    insertStmt.finalize();

    console.log('Seeded database with dummy products.');
  } catch (error) {
    console.error('Failed to seed database:', error);
  } finally {
    const db = getDbInstance();
    if (db) {
        db.close();
    }
  }
}

seed();
