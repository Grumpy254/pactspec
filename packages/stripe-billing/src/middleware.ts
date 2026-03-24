import type {
  StripeBillingOptions,
  CustomerUsage,
  StripeSubscription,
  UsageRecord,
} from './types';
import { createCheckoutSession } from './checkout';

const STRIPE_API = 'https://api.stripe.com/v1';

const usageStore = new Map<string, CustomerUsage>();

function getOrCreateUsage(customerId: string): CustomerUsage {
  let usage = usageStore.get(customerId);
  if (!usage) {
    usage = {
      customerId,
      totalInvocations: 0,
      billableInvocations: 0,
      lastReportedAt: null,
    };
    usageStore.set(customerId, usage);
  }
  return usage;
}

/** Read current in-memory usage for a customer (test/debug helper). */
export function getCustomerUsage(customerId: string): CustomerUsage | null {
  return usageStore.get(customerId) ?? null;
}

/** Reset usage store — useful for tests. */
export function resetUsageStore(): void {
  usageStore.clear();
}

async function getActiveSubscription(
  customerId: string,
  stripeSecretKey: string,
): Promise<StripeSubscription | null> {
  const params = new URLSearchParams();
  params.set('customer', customerId);
  params.set('status', 'active');
  params.set('limit', '1');

  const res = await fetch(`${STRIPE_API}/subscriptions?${params.toString()}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { data: StripeSubscription[] };
  return data.data[0] ?? null;
}

async function verifyCheckoutSessionFromHeader(
  sessionId: string,
  stripeSecretKey: string,
): Promise<string | null> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });

  if (!res.ok) return null;

  const session = (await res.json()) as {
    payment_status: string;
    status: string;
    customer: string | null;
  };

  if (session.payment_status === 'paid' && session.status === 'complete') {
    return session.customer;
  }

  return null;
}

async function reportStripeUsage(
  subscriptionItemId: string,
  quantity: number,
  stripeSecretKey: string,
): Promise<UsageRecord | null> {
  const timestamp = Math.floor(Date.now() / 1000);

  const body = new URLSearchParams();
  body.set('quantity', String(quantity));
  body.set('timestamp', String(timestamp));
  body.set('action', 'increment');

  const res = await fetch(
    `${STRIPE_API}/subscription_items/${subscriptionItemId}/usage_records`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
  );

  if (!res.ok) return null;

  return {
    customerId: '', // filled by caller
    subscriptionItemId,
    quantity,
    timestamp,
    action: 'increment',
  };
}

/**
 * Express-compatible middleware that gates requests behind Stripe billing.
 *
 * Checks for a Stripe customer via:
 *   1. `X-Stripe-Customer` header
 *   2. `Authorization: Bearer <checkout_session_id>` header
 *   3. The `lookupCustomer` callback
 *
 * When no valid payment method is found, the middleware returns **402** with
 * a JSON body containing a Stripe Checkout URL.
 */
export function stripeBillingMiddleware(
  options: StripeBillingOptions,
): (req: any, res: any, next: any) => void {
  const {
    stripeSecretKey,
    pricing,
    lookupCustomer,
    onUsageReported,
    freeQuota = 0,
    stripePriceId,
    checkoutSuccessUrl = 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    checkoutCancelUrl = 'https://example.com/cancel',
  } = options;

  return async (req: any, res: any, next: any) => {
    try {
      let customerId: string | null = null;

      const headerCustomer =
        req.headers?.['x-stripe-customer'] as string | undefined;
      if (headerCustomer) {
        customerId = headerCustomer;
      }

      if (!customerId) {
        const authHeader = req.headers?.['authorization'] as string | undefined;
        if (authHeader?.startsWith('Bearer cs_')) {
          const sessionId = authHeader.slice('Bearer '.length);
          customerId = await verifyCheckoutSessionFromHeader(
            sessionId,
            stripeSecretKey,
          );
        }
      }

      if (!customerId) {
        customerId = await lookupCustomer(req);
      }

      if (!customerId) {
        return send402(res, stripePriceId, stripeSecretKey, checkoutSuccessUrl, checkoutCancelUrl);
      }

      const usage = getOrCreateUsage(customerId);

      if (freeQuota > 0 && usage.totalInvocations < freeQuota) {
        usage.totalInvocations++;
        return next();
      }

      const subscription = await getActiveSubscription(
        customerId,
        stripeSecretKey,
      );

      if (!subscription) {
        return send402(res, stripePriceId, stripeSecretKey, checkoutSuccessUrl, checkoutCancelUrl);
      }

      const subscriptionItemId = subscription.items.data[0]?.id;

      usage.totalInvocations++;
      usage.billableInvocations++;

      res.on('finish', async () => {
        if (!subscriptionItemId) return;

        const quantity = computeQuantity(pricing.model, req, res);

        const record = await reportStripeUsage(
          subscriptionItemId,
          quantity,
          stripeSecretKey,
        );

        if (record) {
          record.customerId = customerId!;
          usage.lastReportedAt = Date.now();
          onUsageReported?.(record);
        }
      });

      next();
    } catch (err: any) {
      console.error('[pactspec/stripe-billing] middleware error:', err?.message);
      next();
    }
  };
}

function computeQuantity(
  model: string,
  req: any,
  res: any,
): number {
  switch (model) {
    case 'per-token': {
      const tokenHeader = res.getHeader?.('x-token-count');
      if (tokenHeader) return Number(tokenHeader) || 1;
      return 1;
    }
    case 'per-second': {
      const startTime = req._stripeBillingStart as number | undefined;
      if (startTime) {
        return Math.max(1, Math.ceil((Date.now() - startTime) / 1000));
      }
      return 1;
    }
    case 'per-invocation':
    default:
      return 1;
  }
}

async function send402(
  res: any,
  stripePriceId: string | undefined,
  stripeSecretKey: string,
  successUrl: string,
  cancelUrl: string,
): Promise<void> {
  const body: Record<string, any> = {
    error: 'Payment required',
    message:
      'A valid Stripe subscription or checkout session is required to access this agent.',
  };

  if (stripePriceId) {
    try {
      const { url, sessionId } = await createCheckoutSession({
        stripeSecretKey,
        priceId: stripePriceId,
        successUrl,
        cancelUrl,
        mode: 'subscription',
      });
      body.checkoutUrl = url;
      body.sessionId = sessionId;
    } catch {
      // Checkout generation failed — still return 402 without URL
    }
  }

  res.status(402).json(body);
}
