export interface InvokeResult {
  data: unknown;
  status: number;
  paid: boolean;
  paymentId?: string;
  paymentAmount?: string;
  paymentCurrency?: string;
}

export interface PaymentChallenge {
  type: string;
  amount: string;
  currency: string;
  network?: string;
  payTo?: string;
  paymentId: string;
  expiresAt?: string;
  checkoutUrl?: string;
}

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
