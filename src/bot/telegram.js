const tgMod = require('node-telegram-bot-api');
const TelegramBot = typeof tgMod === 'function' ? tgMod : (tgMod.default || tgMod.TelegramBot);

let bot;

function initBot(dbModule) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN is not set.');
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/inventory/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const products = await dbModule.getProducts();
      
      if (!products || products.length === 0) {
        bot.sendMessage(chatId, 'Inventory is empty.');
        return;
      }

      let message = '📦 *Current Inventory:*\n\n';
      products.forEach(p => {
        // Fallback property names in case they differ slightly
        const name = p.name || p.title || 'Unknown Item';
        const stock = p.stock !== undefined ? p.stock : (p.quantity || 0);
        message += `• *${name}*: ${stock}\n`;
      });

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error fetching inventory:', error);
      bot.sendMessage(chatId, 'Failed to fetch inventory.');
    }
  });

  console.log('Telegram bot started.');
}

function sendApprovalMessage(chatId, product, iframeUrl) {
  if (!bot) {
    console.error('Bot not initialized');
    return;
  }
  
  const productName = product.name || product.title || 'the item';
  
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Approve Payment',
            url: iframeUrl
          }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, `Please approve the payment for ${productName}.`, opts);
}

function sendInvoice(chatId, pdfBuffer) {
  if (!bot) {
    console.error('Bot not initialized');
    return;
  }
  
  const fileOptions = {
    filename: 'invoice.pdf',
    contentType: 'application/pdf'
  };
  
  bot.sendDocument(chatId, pdfBuffer, {}, fileOptions);
}

module.exports = {
  initBot,
  sendApprovalMessage,
  sendInvoice
};
