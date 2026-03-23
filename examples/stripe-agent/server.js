import express from 'express';
import { stripeBillingMiddleware } from '@pactspec/stripe-billing';

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Stripe billing middleware — gates /api/agent behind payment
// ---------------------------------------------------------------------------
app.use(
  '/api/agent',
  stripeBillingMiddleware({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripePriceId: process.env.STRIPE_PRICE_ID, // enables auto checkout URLs in 402
    pricing: {
      model: 'per-invocation',
      amount: 5, // 5 cents in smallest unit
      currency: 'usd',
    },
    lookupCustomer: async (req) => {
      return req.headers['x-stripe-customer'] || null;
    },
    freeQuota: 10, // first 10 calls free per customer
    checkoutSuccessUrl: 'http://localhost:3001/success?session_id={CHECKOUT_SESSION_ID}',
    checkoutCancelUrl: 'http://localhost:3001/cancel',
    onUsageReported: (record) => {
      console.log(`[billing] reported ${record.quantity} unit(s) for ${record.customerId}`);
    },
  })
);

// ---------------------------------------------------------------------------
// Agent endpoint — your actual logic goes here
// ---------------------------------------------------------------------------
app.post('/api/agent', (req, res) => {
  const { code_description } = req.body;

  // Stub: in a real agent this would call an LLM or lookup table
  res.json({
    icd11_code: 'BA00',
    description: 'Essential hypertension',
    confidence: 0.95,
    input: code_description,
  });
});

// Simple success/cancel pages for Stripe Checkout redirects
app.get('/success', (_req, res) => res.send('Payment successful! You can now call the agent.'));
app.get('/cancel', (_req, res) => res.send('Checkout cancelled.'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Medical Coding Agent running on http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/api/agent`);
});
