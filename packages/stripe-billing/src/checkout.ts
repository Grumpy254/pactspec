import type {
  CheckoutOptions,
  CheckoutSessionResult,
  StripeCheckoutSession,
} from './types';

const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * Creates a Stripe Checkout session and returns the hosted checkout URL.
 *
 * ```ts
 * const { url, sessionId } = await createCheckoutSession({
 *   stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
 *   priceId: 'price_abc123',
 *   successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
 *   cancelUrl: 'https://example.com/cancel',
 * });
 * ```
 */
export async function createCheckoutSession(
  options: CheckoutOptions,
): Promise<CheckoutSessionResult> {
  const {
    stripeSecretKey,
    priceId,
    customerId,
    successUrl,
    cancelUrl,
    mode = 'subscription',
    metadata,
  } = options;

  const body = new URLSearchParams();
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  body.set('mode', mode);
  body.set('line_items[0][price]', priceId);
  body.set('line_items[0][quantity]', '1');

  if (customerId) {
    body.set('customer', customerId);
  }

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      body.set(`metadata[${key}]`, value);
    }
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Stripe Checkout session creation failed (${res.status}): ${
        (err as any)?.error?.message ?? res.statusText
      }`,
    );
  }

  const session = (await res.json()) as { id: string; url: string };

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Checks whether a Checkout Session has been paid.
 *
 * Returns `true` when `payment_status === 'paid'` and `status === 'complete'`.
 */
export async function verifyCheckoutSession(
  sessionId: string,
  stripeSecretKey: string,
): Promise<boolean> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });

  if (!res.ok) {
    return false;
  }

  const session = (await res.json()) as StripeCheckoutSession;

  return (
    session.payment_status === 'paid' && session.status === 'complete'
  );
}
