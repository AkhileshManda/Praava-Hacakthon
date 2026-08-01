require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const db = require('./inventory/db');
const bot = require('./bot/linq');
const invoice = require('./invoice/invoice');
const prava = require('./payments/prava');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const sseClients = new Set();
function broadcast(type, data) {
  const msg = `data: ${JSON.stringify({ type, data, ts: Date.now() })}\n\n`;
  for (const res of sseClients) res.write(msg);
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);

  // Send initial state
  db.getProducts().then(products => {
    res.write(`data: ${JSON.stringify({ type: 'connected', data: { products } })}\n\n`);
  });

  req.on('close', () => sseClients.delete(res));
});

app.get('/api/inventory', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger inventory drop (simulate consumption)
app.post('/api/inventory/consume', async (req, res) => {
  const { id, amount } = req.body;
  try {
    const p = await db.getProduct(id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    
    const newStock = Math.max(0, p.stock - amount);
    await db.updateStock(id, newStock);
    
    const updated = await db.getProduct(id);
    broadcast('inventory_update', { product: updated });
    
    // Check threshold
    if (newStock < updated.threshold) {
      triggerRestock(updated).catch(e => console.error('Restock flow error:', e));
    }
    
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const AuraAgent = require('./sdk/AuraAgent');
const aura = new AuraAgent({
  apiKey: process.env.AURA_API_KEY,
  notifyPhone: process.env.LINQ_TO_NUMBER
});

// Wire up SDK events to dashboard SSE
const forwardEvents = ['step', 'restock_initiated', 'senso-search', 'senso-result', 'llm-eval', 'senso-decision', 'negotiation_start', 'negotiation_msg', 'negotiation_end', 'pending_added', 'restock_error'];
for (const ev of forwardEvents) {
  aura.on(ev, data => broadcast(ev, data));
}

// Special handling for completion to update DB
aura.on('restock_complete', async (data) => {
  const { product, quantity, orderId, session, totalAmount } = data;
  const newStock = product.stock + quantity;
  await db.updateStock(product.id, newStock);
  const updated = await db.getProduct(product.id);
  
  broadcast('restock_complete', {
    orderId,
    product: updated,
    session,
    totalAmount
  });
});

async function triggerRestock(product) {
  // Delegate the entire complex orchestration to our newly extracted SDK!
  await aura.handleRestock(product);
}

// Ensure DB is initialized and Bot is started before listening
async function start() {
  await db.initDb();
  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot.initBot(db);
  }
  
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🏭 Warehouse Assistant running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(console.error);
}
