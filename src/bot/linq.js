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
  // Clean formatting from user inputs
  let cleanFromNumber = process.env.LINQ_FROM_NUMBER ? process.env.LINQ_FROM_NUMBER.replace(/[^\d+]/g, '') : '+12223334444';
  let formattedNumber = phoneNumber ? phoneNumber.replace(/[^\d+]/g, '') : '';
  
  // Normalize phone number to E.164 if user forgot country code
  if (formattedNumber && !formattedNumber.startsWith('+')) {
    formattedNumber = `+1${formattedNumber}`;
  }

  if (!LINQ_TOKEN) {
    console.log(`[Linq Mock] Sending Approval SMS to ${formattedNumber} for ${product.name}: ${iframeUrl}`);
    return;
  }
  
  try {
    await axios.post(LINQ_API_URL, {
      from: cleanFromNumber,
      to: [formattedNumber],
      message: {
        parts: [
          { type: 'text', value: `🚨 B2B Autonomous Order Alert\n\nYour warehouse AI has negotiated a restock for ${product.name}.\n\nPlease approve and fund the escrow via Prava:\n${iframeUrl}` }
        ]
      }
    }, { headers: { Authorization: `Bearer ${LINQ_TOKEN}` } });
    
    console.log(`\n======================================================`);
    console.log(`[SPONSOR INTEGRATION: LINQ SMS SUCCESS]`);
    console.log(`Action: Dispatched Prava Approval SMS to ${formattedNumber}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Linq sendApprovalMessage error:', err.response?.data || err.message);
  }
}

async function sendInvoice(phoneNumber, pdfBuffer) {
  let cleanFromNumber = process.env.LINQ_FROM_NUMBER ? process.env.LINQ_FROM_NUMBER.replace(/[^\d+]/g, '') : '+12223334444';
  let formattedNumber = phoneNumber ? phoneNumber.replace(/[^\d+]/g, '') : '';
  if (formattedNumber && !formattedNumber.startsWith('+')) {
    formattedNumber = `+1${formattedNumber}`;
  }

  if (!LINQ_TOKEN) {
    console.log(`[Linq Mock] Sending Invoice PDF to ${formattedNumber}`);
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
      from: cleanFromNumber,
      to: [formattedNumber],
      message: {
        parts: [
          { type: 'text', value: `✅ Escrow funded! Here is your invoice for the restock.` },
          { type: 'media', attachment_id: attachmentId }
        ]
      }
    }, { headers: { Authorization: `Bearer ${LINQ_TOKEN}` } });
    
    console.log(`\n======================================================`);
    console.log(`[SPONSOR INTEGRATION: LINQ PDF ATTACHMENT SUCCESS]`);
    console.log(`Action: Dispatched final Escrow PDF Invoice to ${formattedNumber}`);
    console.log(`Attachment ID: ${attachmentId}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Linq sendInvoice error:', err.response?.data || err.message);
  }
}

module.exports = { initBot, sendApprovalMessage, sendInvoice };
