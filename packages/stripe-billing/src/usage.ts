import type {
  UsageReportOptions,
  UsageSummary,
  UsageSummaryItem,
  UsageSummaryOptions,
} from './types';

const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * Reports usage to Stripe for metered billing.
 *
 * ```ts
 * await reportUsage({
 *   stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
 *   subscriptionItemId: 'si_abc123',
 *   quantity: 1,
 * });
 * ```
 */
export async function reportUsage(options: UsageReportOptions): Promise<void> {
  const {
    stripeSecretKey,
    subscriptionItemId,
    quantity,
    timestamp = Math.floor(Date.now() / 1000),
    action = 'increment',
  } = options;

  const body = new URLSearchParams();
  body.set('quantity', String(quantity));
  body.set('timestamp', String(timestamp));
  body.set('action', action);

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Stripe usage report failed (${res.status}): ${
        (err as any)?.error?.message ?? res.statusText
      }`,
    );
  }
}

/**
 * Retrieves a usage summary for all metered subscription items belonging to
 * a customer.
 */
export async function getUsageSummary(
  customerId: string,
  options: UsageSummaryOptions,
): Promise<UsageSummary> {
  const { stripeSecretKey, startTime, endTime } = options;

  const subsParams = new URLSearchParams();
  subsParams.set('customer', customerId);
  subsParams.set('status', 'active');
  subsParams.set('limit', '100');

  const subsRes = await fetch(
    `${STRIPE_API}/subscriptions?${subsParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    },
  );

  if (!subsRes.ok) {
    const err = await subsRes.json().catch(() => ({}));
    throw new Error(
      `Failed to list subscriptions (${subsRes.status}): ${
        (err as any)?.error?.message ?? subsRes.statusText
      }`,
    );
  }

  const subsData = (await subsRes.json()) as {
    data: Array<{ items: { data: Array<{ id: string }> } }>;
  };

  const items: UsageSummaryItem[] = [];

  for (const sub of subsData.data) {
    for (const item of sub.items.data) {
      const usageParams = new URLSearchParams();
      if (startTime) usageParams.set('start_time', String(startTime));
      if (endTime) usageParams.set('end_time', String(endTime));

      const usageRes = await fetch(
        `${STRIPE_API}/subscription_items/${item.id}/usage_record_summaries?${usageParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
        },
      );

      if (!usageRes.ok) continue;

      const usageData = (await usageRes.json()) as {
        data: Array<{
          total_usage: number;
          period: { start: number; end: number };
        }>;
      };

      for (const summary of usageData.data) {
        items.push({
          subscriptionItemId: item.id,
          totalUsage: summary.total_usage,
          period: summary.period,
        });
      }
    }
  }

  return { customerId, items };
}
