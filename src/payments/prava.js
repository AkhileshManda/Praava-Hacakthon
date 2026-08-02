const PRAVA_SECRET_KEY = process.env.PRAVA_SECRET_KEY;
const PRAVA_API_BASE   = process.env.PRAVA_API_BASE || 'https://sandbox.api.prava.space';

async function createPravaSession({ orderId, product, quantity, totalAmount }) {
  if (!PRAVA_SECRET_KEY) throw new Error('PRAVA_SECRET_KEY not set');

  const res = await fetch(`${PRAVA_API_BASE}/v1/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PRAVA_SECRET_KEY}`,
    },
    body: JSON.stringify({
      user_id: process.env.DEMO_USER_ID || 'demo-user',
      user_email: process.env.DEMO_USER_EMAIL || 'demo@warehouse.local',
      total_amount: totalAmount.toFixed(2),
      currency: 'USD',
      description: `Autonomous Restock: ${product.name}`,
      purchase_context: [{
        merchant_details: {
          name: 'Warehouse Agent',
          url: 'https://warehouse.local',
          country_code_iso2: 'US',
          category: 'B2B',
        },
        product_details: [{
          description: product.name,
          unit_price: (totalAmount / quantity).toFixed(2),
          quantity: quantity,
        }],
        effective_until_minutes: 15,
      }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Prava session failed [${res.status}]: ${data?.error?.message || JSON.stringify(data)}`);
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
      if (data.status === 'completed' || data.status === 'succeeded' || data.transaction_id) {
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
