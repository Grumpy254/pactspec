/** Pricing model aligned with PactSpec AgentSpecPricing */
export interface BillingPricing {
  model: 'per-invocation' | 'per-token' | 'per-second';
  /** Unit price in the smallest currency unit (e.g. cents for USD) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
}

export interface UsageRecord {
  customerId: string;
  subscriptionItemId: string;
  quantity: number;
  timestamp: number;
  action: 'increment' | 'set';
}

export interface CustomerUsage {
  customerId: string;
  totalInvocations: number;
  billableInvocations: number;
  lastReportedAt: number | null;
}

export interface StripeBillingOptions {
  stripeSecretKey: string;
  pricing: BillingPricing;
  /**
   * Extract the Stripe customer ID from the incoming request.
   * Return `null` if the customer cannot be identified.
   */
  lookupCustomer: (req: any) => Promise<string | null>;
  onUsageReported?: (record: UsageRecord) => void;
  /**
   * Number of free invocations before billing starts (per customer).
   * Defaults to 0 (bill from the first invocation).
   */
  freeQuota?: number;
  /**
   * Stripe Price ID used to generate Checkout URLs for customers
   * without an active subscription.
   */
  stripePriceId?: string;
  /**
   * URL to redirect to after a successful Stripe Checkout.
   * `{CHECKOUT_SESSION_ID}` is replaced with the real session ID.
   */
  checkoutSuccessUrl?: string;
  checkoutCancelUrl?: string;
}

export interface CheckoutOptions {
  stripeSecretKey: string;
  priceId: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  /** Checkout mode: 'payment' for one-time, 'subscription' for recurring */
  mode?: 'payment' | 'subscription';
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

export interface UsageReportOptions {
  stripeSecretKey: string;
  subscriptionItemId: string;
  quantity: number;
  /** Unix timestamp for the usage event (defaults to now) */
  timestamp?: number;
  /** 'increment' adds to existing usage; 'set' replaces it. Default: 'increment' */
  action?: 'increment' | 'set';
}

export interface UsageSummaryOptions {
  stripeSecretKey: string;
  startTime?: number;
  endTime?: number;
}

export interface UsageSummaryItem {
  subscriptionItemId: string;
  totalUsage: number;
  period: { start: number; end: number };
}

export interface UsageSummary {
  customerId: string;
  items: UsageSummaryItem[];
}

export interface StripeSubscription {
  id: string;
  status: string;
  items: {
    data: Array<{
      id: string;
      price: { id: string };
    }>;
  };
}

export interface StripeCheckoutSession {
  id: string;
  payment_status: string;
  status: string;
  customer: string | null;
  subscription: string | null;
}
