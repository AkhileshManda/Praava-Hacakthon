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

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function executeSensoCommand(command) {
  return new Promise((resolve) => {
    // Ensure we source the API key before running the senso CLI
    const fullCommand = `source ~/.zshenv && ${command}`;
    require('child_process').exec(fullCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Senso Error]:`, error, stderr);
        return resolve({ answer: "Unable to reach Senso KB.", results: [] });
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ stdout });
      }
    });
  });
}

async function triggerRestock(product) {
  console.log(`🚨 Triggering restock & negotiation for ${product.name}`);
  broadcast('restock_initiated', { product, message: `${product.name} is low. Triggering restock.` });
  
  const quantity = product.restock_qty;
  const initialPrice = product.price;
  const targetPrice = product.price * 0.9;
  const orderId = `ORD-${Date.now()}`;
  
  // --- Senso Multi-Agent Discovery Phase (with LLM Layer) ---
  broadcast('step', { status: 'senso-search', label: `🌐 Global Discovery`, detail: `Scanning Senso KB for all available suppliers...` });
  
  const discoveryResult = await executeSensoCommand(`senso search content "reputation" --output json --quiet`);
  const candidates = (discoveryResult.contents || [])
    .filter(c => c.title.includes('reputation.md'))
    .map(c => c.title.split('-reputation.md')[0]); // e.g. 'techsupply', 'electroworld'

  if (candidates.length === 0) {
    candidates.push('TechSupply Co.'); // Fallback just in case
  } else {
    broadcast('step', { status: 'senso-result', label: `🔍 Discovery Complete`, detail: `Found ${candidates.length} potential suppliers: ${candidates.join(', ')}` });
  }

  let bestSupplier = null;
  let bestScore = 0;
  let bestContext = '';

  for (const rawSupplier of candidates) {
    const supplier = rawSupplier.charAt(0).toUpperCase() + rawSupplier.slice(1); // e.g. Techsupply
    broadcast('step', { status: 'senso-search', label: `🔍 Evaluating ${supplier}`, detail: `Pulling context chunks from Senso KB...` });
    
    // 1. Fetch raw context from Senso (RAG pattern)
    const result = await executeSensoCommand(`senso search context "${supplier} reputation trust score" --output json --quiet`);
    const contextChunks = (result.results || []).map(r => r.chunk_text).join('\n');
    
    // 2. Feed context into LLM (Mocked for hackathon)
    const llmPrompt = `Evaluate the supplier ${supplier} based on the provided Knowledge Base context. Extract the numeric trust score out of 100. Context: ${contextChunks}`;
    
    broadcast('step', { status: 'llm-eval', label: `🧠 LLM Reasoning`, detail: `Synthesizing Senso chunks for ${supplier}...` });
    await sleep(1500);
    
    // Mock LLM Evaluation logic based on the context
    let llmExtractedScore = 0;
    if (contextChunks.includes('60/100')) llmExtractedScore = 60;
    else if (contextChunks.includes('85/100')) llmExtractedScore = 85;
    else if (contextChunks.includes('94/100')) llmExtractedScore = 94;
    else {
      // Fallback regex if context isn't perfectly mapped
      const scoreMatch = contextChunks.match(/(\d+)\/100/);
      if (scoreMatch) llmExtractedScore = parseInt(scoreMatch[1]);
    }
    
    broadcast('step', { status: 'senso-result', label: `✅ LLM Evaluation Complete`, detail: `${supplier} scored ${llmExtractedScore}/100 based on KB.` });
    
    if (llmExtractedScore > bestScore) {
      bestScore = llmExtractedScore;
      bestSupplier = supplier;
      bestContext = contextChunks;
    }
    await sleep(2000);
  }

  broadcast('step', { status: 'senso-decision', label: `🏆 LLM Selected: ${bestSupplier}`, detail: `Highest Trust Score (${bestScore}/100). Initiating transaction.` });
  await sleep(2000);
  // -------------------------------------------

  const supplierName = bestSupplier;
  broadcast('negotiation_start', { product, initialPrice, targetPrice });

  // --- Mock LLM Negotiation ---
  await sleep(1500);
  broadcast('negotiation_msg', { sender: 'AI Buyer', text: `Hi ${supplierName}, we need ${quantity} units of ${product.name}. Our Senso Trust Score for you is excellent. Can we do $${targetPrice.toFixed(2)} for bulk?` });
  
  await sleep(2500);
  broadcast('negotiation_msg', { sender: 'Supplier Agent', text: `I can't go that low, but since you're a recurring buyer, I can offer a 5% discount: $${(initialPrice * 0.95).toFixed(2)}.` });
  
  await sleep(2000);
  const finalUnitPrice = initialPrice * 0.95;
  const totalAmount = quantity * finalUnitPrice;
  broadcast('negotiation_msg', { sender: 'AI Buyer', text: `Deal at $${finalUnitPrice.toFixed(2)}. Total comes to $${totalAmount.toFixed(2)}. Initiating Prava B2B Smart Escrow now.` });
  
  await sleep(1500);
  broadcast('negotiation_end', { finalUnitPrice, totalAmount });
  // ----------------------------

  // 1. Create Prava Session with negotiated amount
  const session = await prava.createPravaSession({ orderId, product, quantity, totalAmount });
  
  // 2. Notify via Linq (SMS/iMessage)
  const phoneNumber = process.env.LINQ_TO_NUMBER || '+15556667777';
  if (phoneNumber) {
    await bot.sendApprovalMessage(phoneNumber, product, session.iframe_url);
  }
  
  broadcast('pending_added', {
    orderId,
    product,
    sessionId: session.session_id,
    iframeUrl: session.iframe_url,
    expiresAt: session.expires_at,
    totalAmount,
    supplierName
  });

  // 3. Poll for result
  try {
    await prava.pollPaymentResult(session.session_id, (tick) => {
      broadcast('step', { status: 'polling', label: `Awaiting payment approval...`, detail: `Attempt ${tick}` });
    });
    
    // 4. Success -> Generate Invoice
    const invoiceBuffer = await invoice.generateInvoiceBuffer({
      orderId,
      productName: product.name,
      quantity,
      unitPrice: finalUnitPrice,
      totalAmount
    });
    
    // 5. Send Invoice via Linq
    if (phoneNumber) {
      await bot.sendInvoice(phoneNumber, invoiceBuffer);
    }
    
    // 6. Update DB
    const newStock = product.stock + quantity;
    await db.updateStock(product.id, newStock);
    const updated = await db.getProduct(product.id);
    
    broadcast('restock_complete', {
      orderId,
      product: updated,
      session,
      totalAmount
    });
    
    // --- Senso Feedback Loop ---
    broadcast('step', { status: 'senso-ingest', label: `📝 Senso Feedback Loop`, detail: `Filing successful transaction feedback for ${supplierName}...` });
    
    const feedbackText = `Transaction ${orderId} successful. ${supplierName} delivered ${quantity} units of ${product.name} on time. Trust Score +10.`;
    const feedbackCommand = `senso kb create-raw --data '{"title": "Transaction Feedback: ${orderId}", "text": "${feedbackText}"}' --output json --quiet`;
    
    await executeSensoCommand(feedbackCommand);
    broadcast('step', { status: 'senso-success', label: `✅ Senso KB Updated`, detail: `Merchant evaluation closed-loop complete.` });
    // ---------------------------
    
  } catch (err) {
    console.error('Restock failed:', err);
    broadcast('restock_error', { orderId, error: err.message });
  }
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
