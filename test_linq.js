require('dotenv').config();
const { sendApprovalMessage, sendInvoice } = require('./src/bot/linq');

async function runTest() {
  console.log('🧪 Testing Linq Integration...');
  
  const toPhone = process.env.LINQ_TO_NUMBER;
  if (!toPhone) {
    console.error('❌ Error: LINQ_TO_NUMBER is not set in .env');
    process.exit(1);
  }

  const mockProduct = { name: 'MacBook Pro M3' };
  const mockPravaUrl = 'https://sandbox.checkout.prava.space/pay/test-escrow-link-123';

  console.log(`Sending test iMessage/SMS to ${toPhone}...`);
  
  // Test Approval Message (Text Link)
  await sendApprovalMessage(toPhone, mockProduct, mockPravaUrl);
  
  console.log('✅ If you provided a valid token and numbers, you should receive a message on your phone momentarily!');
}

runTest();
