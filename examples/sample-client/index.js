require('dotenv').config({ path: '../../.env' });
const express = require('express');
const path = require('path');

// Simulate npm install @aura-hq/sdk by requiring the local file
const AuraAgent = require('../../src/sdk/AuraAgent');

const app = express();
app.use(express.static('public'));
app.use(express.json());

// Initialize the SDK exactly as a 3rd-party developer would
const aura = new AuraAgent({
  apiKey: process.env.AURA_API_KEY || 'aur_test_key',
  notifyPhone: process.env.LINQ_TO_NUMBER // We'll borrow the parent .env for demo testing
});

// A simple in-memory database for Acme Corp
let inventory = {
  "M3-PRO-14": { id: "M3-PRO-14", name: "MacBook Pro M3", stock: 2, threshold: 5, price: 1600.00, restock_qty: 10 }
};

// Listen to Aura lifecycle events to log them to Acme's internal system
aura.on('step', (data) => console.log(`[Aura SDK] Step:`, data));
aura.on('restock_complete', (data) => {
  console.log(`[Aura SDK] Restock Complete! Order ${data.orderId}`);
  // Update Acme Corp's internal database automatically when Aura finishes
  if (inventory["M3-PRO-14"]) {
    inventory["M3-PRO-14"].stock += data.quantity;
  }
});
aura.on('restock_error', (data) => console.error(`[Aura SDK] Error:`, data.error));

// ----------------------------------------------------
// Acme Corp API Endpoints
// ----------------------------------------------------
app.get('/api/inventory', (req, res) => {
  res.json(Object.values(inventory));
});

// The client triggers Aura when stock is low
app.post('/api/trigger-aura', async (req, res) => {
  const item = inventory["M3-PRO-14"];
  console.log(`[Acme Corp] Sending restock request to Aura for ${item.name}...`);
  
  // Fire and forget - Aura handles the entire lifecycle (Negotiation + Escrow + Linq)
  aura.handleRestock(item).catch(console.error);
  
  res.json({ success: true, message: "Aura Agent dispatched" });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🏢 Acme Corp Client Site running on http://localhost:${PORT}`);
  console.log(`🔌 Aura SDK initialized and listening for events.`);
});
