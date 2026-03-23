// @pactspec/stripe-billing
// Zero-dependency Stripe payment integration for PactSpec agents.

// Middleware
export {
  stripeBillingMiddleware,
  getCustomerUsage,
  resetUsageStore,
} from './middleware';

// Checkout
export { createCheckoutSession, verifyCheckoutSession } from './checkout';

// Usage reporting
export { reportUsage, getUsageSummary } from './usage';

// Types
export type {
  BillingPricing,
  UsageRecord,
  CustomerUsage,
  StripeBillingOptions,
  CheckoutOptions,
  CheckoutSessionResult,
  UsageReportOptions,
  UsageSummary,
  UsageSummaryItem,
  UsageSummaryOptions,
  StripeSubscription,
  StripeCheckoutSession,
} from './types';
