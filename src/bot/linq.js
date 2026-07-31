const axios = require('axios');

let db;
const LINQ_API_URL = 'https://api.linqapp.com/api/partner/v3/chats';
const LINQ_TOKEN = process.env.LINQ_TOKEN;
const LINQ_FROM_NUMBER = process.env.LINQ_FROM_NUMBER || '+12223334444';

function initBot(dbModule) {
  db = dbModule;
  console.log('📱 Linq integration initialized (replacing Telegram)');
  // In a real scenario, we would also set up an Express route to receive Linq webhooks for inbound messages
}

async function sendApprovalMessage(phoneNumber, product, iframeUrl) {
  if (!LINQ_TOKEN) {
    console.log(`[Linq Mock] Sending Approval SMS to ${phoneNumber} for ${product.name}: ${iframeUrl}`);
    return;
  }
  
  try {
    await axios.post(LINQ_API_URL, {
      from: LINQ_FROM_NUMBER,
      to: [phoneNumber],
      message: {
        parts: [
          { type: 'text', value: `🚨 B2B Autonomous Order Alert\n\nYour warehouse AI has negotiated a restock for ${product.name}.\n\nPlease approve and fund the escrow via Prava:\n${iframeUrl}` }
        ]
      }
    }, { headers: { Authorization: `Bearer ${LINQ_TOKEN}` } });
  } catch (err) {
    console.error('Linq sendApprovalMessage error:', err.message);
  }
}

async function sendInvoice(phoneNumber, pdfBuffer) {
  if (!LINQ_TOKEN) {
    console.log(`[Linq Mock] Sending Invoice PDF to ${phoneNumber}`);
    return;
  }
  
  try {
    // 1. Upload PDF to Linq attachments endpoint to get attachment_id
    const uploadRes = await axios.post('https://api.linqapp.com/api/partner/v3/attachments', pdfBuffer, {
      headers: {
        Authorization: `Bearer ${LINQ_TOKEN}`,
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length
      }
    });
    
    const attachmentId = uploadRes.data.attachment_id;
    
    // 2. Send the message with the media attachment
    await axios.post(LINQ_API_URL, {
      from: LINQ_FROM_NUMBER,
      to: [phoneNumber],
      message: {
        parts: [
          { type: 'text', value: `✅ Escrow funded! Here is your invoice for the restock.` },
          { type: 'media', attachment_id: attachmentId }
        ]
      }
    }, { headers: { Authorization: `Bearer ${LINQ_TOKEN}` } });
  } catch (err) {
    console.error('Linq sendInvoice error:', err.message);
  }
}

module.exports = { initBot, sendApprovalMessage, sendInvoice };
