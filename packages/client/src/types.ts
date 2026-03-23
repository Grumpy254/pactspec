// ---------------------------------------------------------------------------
// Invocation result
// ---------------------------------------------------------------------------

/** Result returned from an agent skill invocation. */
export interface InvokeResult {
  /** The response data from the agent. */
  data: unknown;
  /** HTTP status code of the final (successful) response. */
  status: number;
  /** Whether a payment was made to fulfill this request. */
  paid: boolean;
  /** Unique payment identifier, present when `paid` is true. */
  paymentId?: string;
  /** Amount paid in the currency's smallest unit. */
  paymentAmount?: string;
  /** Currency of the payment (e.g. "USDC", "USD"). */
  paymentCurrency?: string;
}

// ---------------------------------------------------------------------------
// Payment challenge (parsed from a 402 response)
// ---------------------------------------------------------------------------

/** Describes the payment required by the agent. */
export interface PaymentChallenge {
  /** Payment type identifier (e.g. "x402", "stripe"). */
  type: string;
  /** Amount in the currency's smallest unit. */
  amount: string;
  /** Currency code. */
  currency: string;
  /** Blockchain network (present for x402 payments). */
  network?: string;
  /** Wallet address to pay (present for x402 payments). */
  payTo?: string;
  /** Unique identifier for this payment request. */
  paymentId: string;
  /** ISO-8601 expiry timestamp. */
  expiresAt?: string;
  /** Stripe checkout URL (present for Stripe payments). */
  checkoutUrl?: string;
}

// ---------------------------------------------------------------------------
// Agent types (subset used by the client)
// ---------------------------------------------------------------------------

export interface AgentPricing {
  model: string;
  amount: number;
  currency: string;
  protocol?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  pricing?: AgentPricing;
}

export interface AgentEndpoint {
  url: string;
  auth?: {
    type: string;
    name?: string;
  };
}

export interface AgentProvider {
  name: string;
  url?: string;
  contact?: string;
}

export interface Agent {
  specVersion: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  provider: AgentProvider;
  endpoint: AgentEndpoint;
  skills: AgentSkill[];
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOptions {
  query?: string;
  tags?: string[];
  pricingProtocol?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  agents: Agent[];
  total: number;
}
