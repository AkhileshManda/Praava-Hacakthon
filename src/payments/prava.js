const PRAVA_SECRET_KEY = process.env.PRAVA_SECRET_KEY;
const PRAVA_API_BASE   = process.env.PRAVA_API_BASE || 'https://sandbox.api.prava.space';

async function createPravaSession({ orderId, product, quantity, totalAmount }) {
  if (!PRAVA_SECRET_KEY) throw new Error('PRAVA_SECRET_KEY not set');

  const payload = {
      user_id: process.env.DEMO_USER_ID || 'demo-user',
      user_email: process.env.DEMO_USER_EMAIL || 'demo@example.com',
      total_amount: totalAmount.toFixed(2),
      currency: 'USD',
      description: `Autonomous Restock: ${product.name}`,
      purchase_context: [{
        merchant_details: {
          name: 'Warehouse Agent',
          url: 'https://www.example.com',
          country_code_iso2: 'US',
        },
        product_details: [{
          description: product.name,
          unit_price: (totalAmount / quantity).toFixed(2),
          quantity: quantity,
        }],
        effective_until_minutes: 15,
      }],
    };

  console.log(`\n--- PRAVA API REQUEST ---`);
  console.log(`Order ID: ${orderId}`);
  console.log(`Request Body:`, JSON.stringify(payload, null, 2));

  const res = await fetch(`${PRAVA_API_BASE}/v1/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PRAVA_SECRET_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`[Prava API Error] ${data?.error?.message || JSON.stringify(data)}`);
    throw new Error(`Prava session failed [${res.status}]: ${data?.error?.message || JSON.stringify(data)}`);
  }
  
  console.log(`[Prava Success] Session created: ${data.session_id}`);
  console.log(`--- END PRAVA LOG ---\n`);
  
  return data; // { session_id, session_token, iframe_url, expires_at }
}

async function pollPaymentResult(sessionId, onTick) {
  const INTERVAL_MS = 5000;
  const MAX_ATTEMPTS = 120; // 10 min

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, INTERVAL_MS));
    if (onTick) onTick(i + 1);

    const res = await fetch(`${PRAVA_API_BASE}/v1/sessions/${sessionId}/payment-result`, {
      headers: { 'Authorization': `Bearer ${PRAVA_SECRET_KEY}` },
    });
    
    if (res.status === 404 || res.status === 401) continue;
    if (res.status === 400) continue; // often returned if incomplete

    if (res.ok) {
      const data = await res.json();
      console.log(`[Prava Polling] Current Status:`, data.status, `| Raw Data:`, JSON.stringify(data));
      
      // If the checkout flow is finished and Prava is waiting for us to report the charge status
      if (data.status === 'awaiting_result' && data.line_items && data.line_items.length > 0) {
        console.log(`[Prava Polling] Reporting status as APPROVED to finalize the session...`);
        const txnRefId = data.line_items[0].id;
        
        await fetch(`${PRAVA_API_BASE}/v1/sessions/${sessionId}/report-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PRAVA_SECRET_KEY}`,
          },
          body: JSON.stringify({
            txn_ref_id: txnRefId,
            txn_status: "APPROVED",
            authorization_code: "OK123",
            response_code: "00"
          })
        });
        
        console.log(`\n======================================================`);
        console.log(`[SPONSOR INTEGRATION: PRAVA SMART ESCROW SUCCESS]`);
        console.log(`Action: Reported status APPROVED to session ${sessionId}`);
        console.log(`Transaction ID (Ref): ${txnRefId}`);
        console.log(`======================================================\n`);
        
        continue; // Next tick should now return 'completed'
      }

      if (['completed', 'succeeded', 'confirmed', 'approved'].includes(data.status) || data.transaction_id) {
        return { success: true, data };
      }
      if (data.status === 'failed' || data.status === 'declined') {
        throw new Error(`Payment failed: ${JSON.stringify(data)}`);
      }
    }
  }
  throw new Error('Timeout waiting for payment approval');
}

module.exports = {
  createPravaSession,
  pollPaymentResult
};
