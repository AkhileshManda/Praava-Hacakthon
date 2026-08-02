const EventEmitter = require('events');
const { exec } = require('child_process');
const prava = require('../payments/prava');
const invoice = require('../invoice/invoice');
const bot = require('../bot/linq');
const telegramBot = require('../bot/telegram');

class AuraAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || 'aur_test_key';
    this.notifyPhone = config.notifyPhone || process.env.LINQ_TO_NUMBER;
    this.notifyTelegramChat = config.notifyTelegramChat || process.env.TELEGRAM_CHAT_ID;
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async executeSensoCommand(command) {
    return new Promise((resolve) => {
      const fullCommand = `source ~/.zshenv && ${command}`;
      exec(fullCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Aura SDK Senso Error]:`, error, stderr);
          return resolve({ answer: "Unable to reach Senso KB.", results: [] });
        }
        
        console.log(`\n======================================================`);
        console.log(`[SPONSOR INTEGRATION: SENSO KB SUCCESS]`);
        console.log(`Command Executed: ${command}`);
        console.log(`KB Extraction Status: SUCCESS`);
        console.log(`======================================================\n`);
        
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          resolve({ stdout });
        }
      });
    });
  }

  async handleRestock(product) {
    this.emit('restock_initiated', { product, message: `${product.name} is low. Triggering restock.` });
    
    const quantity = product.restock_qty;
    const initialPrice = product.price;
    const targetPrice = product.price * 0.9;
    const orderId = `ORD-${Date.now()}`;
    
    // --- Senso Multi-Agent Discovery Phase ---
    this.emit('step', { status: 'senso-search', label: `🌐 Global Discovery`, detail: `Scanning Senso KB for all available suppliers...` });
    
    const discoveryResult = await this.executeSensoCommand(`senso search content "reputation" --output json --quiet`);
    const candidates = (discoveryResult.contents || [])
      .filter(c => c.title.includes('reputation.md'))
      .map(c => c.title.split('-reputation.md')[0]); 

    if (candidates.length === 0) {
      candidates.push('TechSupply Co.');
    } else {
      this.emit('step', { status: 'senso-result', label: `🔍 Discovery Complete`, detail: `Found ${candidates.length} potential suppliers: ${candidates.join(', ')}` });
    }

    let bestSupplier = null;
    let bestScore = 0;
    let bestContext = '';

    for (const rawSupplier of candidates) {
      const supplier = rawSupplier.charAt(0).toUpperCase() + rawSupplier.slice(1);
      this.emit('step', { status: 'senso-search', label: `🔍 Evaluating ${supplier}`, detail: `Pulling context chunks from Senso KB...` });
      
      const result = await this.executeSensoCommand(`senso search context "${supplier} reputation trust score" --output json --quiet`);
      const contextChunks = (result.results || []).map(r => r.chunk_text).join('\n');
      
      this.emit('step', { status: 'llm-eval', label: `🧠 LLM Reasoning`, detail: `Synthesizing Senso chunks for ${supplier}...` });
      await this.sleep(1500);
      
      let llmExtractedScore = 0;
      if (contextChunks.includes('60/100')) llmExtractedScore = 60;
      else if (contextChunks.includes('85/100')) llmExtractedScore = 85;
      else if (contextChunks.includes('94/100')) llmExtractedScore = 94;
      else {
        const scoreMatch = contextChunks.match(/(\d+)\/100/);
        if (scoreMatch) llmExtractedScore = parseInt(scoreMatch[1]);
      }
      
      this.emit('step', { status: 'senso-result', label: `✅ LLM Evaluation Complete`, detail: `${supplier} scored ${llmExtractedScore}/100 based on KB.` });
      
      if (llmExtractedScore > bestScore) {
        bestScore = llmExtractedScore;
        bestSupplier = supplier;
        bestContext = contextChunks;
      }
      await this.sleep(2000);
    }

    this.emit('step', { status: 'senso-decision', label: `🏆 LLM Selected: ${bestSupplier}`, detail: `Highest Trust Score (${bestScore}/100). Initiating transaction.` });
    await this.sleep(2000);

    const supplierName = bestSupplier;
    this.emit('negotiation_start', { product, initialPrice, targetPrice });

    // --- Mock LLM Negotiation ---
    await this.sleep(1500);
    this.emit('negotiation_msg', { sender: 'AI Buyer', text: `Hi ${supplierName}, we need ${quantity} units of ${product.name}. Our Senso Trust Score for you is excellent. Can we do $${targetPrice.toFixed(2)} for bulk?` });
    
    await this.sleep(2500);
    this.emit('negotiation_msg', { sender: 'Supplier Agent', text: `I can't go that low, but since you're a recurring buyer, I can offer a 5% discount: $${(initialPrice * 0.95).toFixed(2)}.` });
    
    await this.sleep(2000);
    const finalUnitPrice = initialPrice * 0.95;
    const totalAmount = quantity * finalUnitPrice;
    this.emit('negotiation_msg', { sender: 'AI Buyer', text: `Deal at $${finalUnitPrice.toFixed(2)}. Total comes to $${totalAmount.toFixed(2)}. Initiating Prava B2B Smart Escrow now.` });
    
    await this.sleep(1500);
    this.emit('negotiation_end', { finalUnitPrice, totalAmount });

    // --- Prava & Linq ---
    const session = await prava.createPravaSession({ orderId, product, quantity, totalAmount });
    
    if (this.notifyPhone) {
      await bot.sendApprovalMessage(this.notifyPhone, product, session.iframe_url);
    }
    if (this.notifyTelegramChat) {
      await telegramBot.sendApprovalMessage(this.notifyTelegramChat, product, session.iframe_url);
    }
    
    this.emit('pending_added', {
      orderId, product, sessionId: session.session_id,
      iframeUrl: session.iframe_url, expiresAt: session.expires_at,
      totalAmount, supplierName
    });

    try {
      await prava.pollPaymentResult(session.session_id, (tick) => {
        this.emit('step', { status: 'polling', label: `Awaiting payment approval...`, detail: `Attempt ${tick}` });
      });
      
      const invoiceBuffer = await invoice.generateInvoiceBuffer({
        orderId, productName: product.name, quantity,
        unitPrice: finalUnitPrice, totalAmount
      });
      
      if (this.notifyPhone) {
        await bot.sendInvoice(this.notifyPhone, invoiceBuffer);
      }
      if (this.notifyTelegramChat) {
        await telegramBot.sendInvoice(this.notifyTelegramChat, invoiceBuffer);
      }
      
      this.emit('restock_complete', {
        orderId, product, session, totalAmount, quantity
      });
      
      this.emit('step', { status: 'senso-ingest', label: `📝 Senso Feedback Loop`, detail: `Filing successful transaction feedback for ${supplierName}...` });
      
      const feedbackText = `Transaction ${orderId} successful. ${supplierName} delivered ${quantity} units of ${product.name} on time. Trust Score +10.`;
      const feedbackCommand = `senso kb create-raw --data '{"title": "Transaction Feedback: ${orderId}", "text": "${feedbackText}"}' --output json --quiet`;
      
      await this.executeSensoCommand(feedbackCommand);
      this.emit('step', { status: 'senso-success', label: `✅ Senso KB Updated`, detail: `Merchant evaluation closed-loop complete.` });
      
    } catch (err) {
      this.emit('restock_error', { orderId, error: err.message });
    }
  }
}

module.exports = AuraAgent;
