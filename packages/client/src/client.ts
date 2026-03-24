import type { WalletAdapter } from './wallet.js';
import type {
  Agent,
  InvokeResult,
  PaymentChallenge,
  SearchOptions,
  SearchResult,
} from './types.js';
import {
  AgentNotFoundError,
  InvocationError,
  PaymentFailedError,
  PaymentRefusedError,
  PaymentRequiredError,
  SkillNotFoundError,
} from './errors.js';

export interface ClientOptions {
  /** Registry base URL. Defaults to https://pactspec.dev */
  registry?: string;

  /** Wallet adapter for x402 on-chain payments. */
  wallet?: WalletAdapter;
  /** Stripe customer ID for server-side billing. */
  stripeCustomerId?: string;
  /** Async resolver that returns a Stripe checkout session ID. */
  stripeSessionResolver?: () => Promise<string>;

  /**
   * Maximum amount (in the currency's smallest unit) that the client is
   * allowed to pay per invocation. Requests that exceed this are refused
   * with a {@link PaymentRefusedError}.
   */
  maxPaymentAmount?: number;
  /** Only pay when the challenge currency matches this value. */
  maxPaymentCurrency?: string;

  /**
   * When true (the default), the client automatically handles 402 responses
   * by executing payments. Set to false to receive {@link PaymentRequiredError}
   * instead.
   */
  autoPayEnabled?: boolean;
}

const DEFAULT_REGISTRY = 'https://pactspec.dev';

export class PactSpecClient {
  private readonly registry: string;
  private readonly wallet?: WalletAdapter;
  private readonly stripeCustomerId?: string;
  private readonly stripeSessionResolver?: () => Promise<string>;
  private readonly maxPaymentAmount?: number;
  private readonly maxPaymentCurrency?: string;
  private readonly autoPayEnabled: boolean;

  private readonly specCache = new Map<string, Agent>();

  constructor(options: ClientOptions = {}) {
    this.registry = (options.registry ?? DEFAULT_REGISTRY).replace(/\/+$/, '');
    this.wallet = options.wallet;
    this.stripeCustomerId = options.stripeCustomerId;
    this.stripeSessionResolver = options.stripeSessionResolver;
    this.maxPaymentAmount = options.maxPaymentAmount;
    this.maxPaymentCurrency = options.maxPaymentCurrency;
    this.autoPayEnabled = options.autoPayEnabled ?? true;
  }

  /** Look up an agent spec by its ID from the registry. */
  async getAgent(specId: string): Promise<Agent> {
    const cached = this.specCache.get(specId);
    if (cached) return cached;

    const res = await fetch(`${this.registry}/api/agents/${encodeURIComponent(specId)}`);
    if (res.status === 404) throw new AgentNotFoundError(specId);
    if (!res.ok) {
      throw new InvocationError(res.status, `Registry error: ${res.statusText}`);
    }

    const body = (await res.json()) as { spec?: Agent } & Agent;
    const agent: Agent = body.spec ?? body;
    this.specCache.set(specId, agent);
    return agent;
  }

  /** Search the registry for agents matching the given criteria. */
  async search(query: SearchOptions): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query.query) params.set('q', query.query);
    if (query.tags?.length) params.set('tags', query.tags.join(','));
    if (query.pricingProtocol) params.set('pricingProtocol', query.pricingProtocol);
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));

    const res = await fetch(`${this.registry}/api/agents?${params.toString()}`);
    if (!res.ok) {
      throw new InvocationError(res.status, `Registry search failed: ${res.statusText}`);
    }
    return (await res.json()) as SearchResult;
  }

  /**
   * Invoke an agent skill. If the agent returns 402 and auto-pay is enabled,
   * the client will automatically handle the payment and retry.
   */
  async invoke(specId: string, skillId: string, input: unknown): Promise<InvokeResult> {
    return this.invokeInternal(specId, skillId, input, true);
  }

  /**
   * Invoke an agent skill without automatic payment handling. If the agent
   * returns 402 a {@link PaymentRequiredError} is thrown.
   */
  async invokeWithoutPayment(
    specId: string,
    skillId: string,
    input: unknown,
  ): Promise<InvokeResult> {
    return this.invokeInternal(specId, skillId, input, false);
  }

  /** Clear the in-memory spec cache (useful after registry updates). */
  clearCache(): void {
    this.specCache.clear();
  }

  private async invokeInternal(
    specId: string,
    skillId: string,
    input: unknown,
    autoPay: boolean,
  ): Promise<InvokeResult> {
    const agent = await this.getAgent(specId);
    const skill = agent.skills.find((s) => s.id === skillId);
    if (!skill) throw new SkillNotFoundError(specId, skillId);

    const endpointUrl = this.buildSkillUrl(agent, skill.id);

    const firstResponse = await this.postToAgent(endpointUrl, input, agent);

    if (firstResponse.status === 200 || (firstResponse.status >= 200 && firstResponse.status < 300)) {
      return {
        data: await this.parseResponseBody(firstResponse),
        status: firstResponse.status,
        paid: false,
      };
    }

    if (firstResponse.status !== 402) {
      const body = await this.safeReadBody(firstResponse);
      throw new InvocationError(
        firstResponse.status,
        `Agent returned ${firstResponse.status}: ${firstResponse.statusText}`,
        body,
      );
    }

    const challenge = await this.parseChallenge(firstResponse);

    if (!autoPay || !this.autoPayEnabled) {
      throw new PaymentRequiredError(challenge);
    }

    this.enforceBudget(challenge);

    const paymentHeaders = await this.executePayment(challenge);

    const retryResponse = await this.postToAgent(endpointUrl, input, agent, paymentHeaders);

    if (retryResponse.status >= 200 && retryResponse.status < 300) {
      return {
        data: await this.parseResponseBody(retryResponse),
        status: retryResponse.status,
        paid: true,
        paymentId: challenge.paymentId,
        paymentAmount: challenge.amount,
        paymentCurrency: challenge.currency,
      };
    }

    const retryBody = await this.safeReadBody(retryResponse);
    throw new InvocationError(
      retryResponse.status,
      `Agent returned ${retryResponse.status} after payment`,
      retryBody,
    );
  }

  private buildSkillUrl(agent: Agent, skillId: string): string {
    const base = agent.endpoint.url.replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(skillId)}`;
  }

  private async postToAgent(
    url: string,
    input: unknown,
    agent: Agent,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (agent.endpoint.auth?.type === 'x-agent-id') {
      headers['X-Agent-Id'] = agent.id;
    }

    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
  }

  private async parseChallenge(response: Response): Promise<PaymentChallenge> {
    const body = await response.json() as Record<string, unknown>;
    return {
      type: (body.type as string) ?? (body.network ? 'x402' : 'stripe'),
      amount: String(body.amount ?? '0'),
      currency: (body.currency as string) ?? 'USDC',
      network: body.network as string | undefined,
      payTo: body.payTo as string | undefined,
      paymentId: (body.paymentId as string) ?? '',
      expiresAt: body.expiresAt as string | undefined,
      checkoutUrl: body.checkoutUrl as string | undefined,
    };
  }

  private enforceBudget(challenge: PaymentChallenge): void {
    if (this.maxPaymentCurrency && challenge.currency !== this.maxPaymentCurrency) {
      throw new PaymentRefusedError(challenge, this.maxPaymentAmount ?? 0);
    }

    if (this.maxPaymentAmount != null) {
      const amount = Number(challenge.amount);
      if (Number.isNaN(amount) || amount > this.maxPaymentAmount) {
        throw new PaymentRefusedError(challenge, this.maxPaymentAmount);
      }
    }
  }

  private async executePayment(
    challenge: PaymentChallenge,
  ): Promise<Record<string, string>> {
    if (challenge.network && challenge.payTo) {
      if (!this.wallet) {
        throw new PaymentFailedError(
          'x402 payment required but no wallet adapter configured',
        );
      }

      try {
        const txHash = await this.wallet.pay({
          amount: challenge.amount,
          currency: challenge.currency,
          network: challenge.network,
          payTo: challenge.payTo,
          paymentId: challenge.paymentId,
        });

        const proof = JSON.stringify({
          txHash,
          paymentId: challenge.paymentId,
        });

        return { 'X-Payment-Proof': proof };
      } catch (err) {
        throw new PaymentFailedError('Wallet payment failed', err);
      }
    }

    if (challenge.checkoutUrl || this.stripeCustomerId) {
      if (this.stripeCustomerId) {
        return { 'X-Stripe-Customer': this.stripeCustomerId };
      }

      if (this.stripeSessionResolver) {
        try {
          const sessionId = await this.stripeSessionResolver();
          return { 'X-Stripe-Session': sessionId };
        } catch (err) {
          throw new PaymentFailedError('Stripe session resolution failed', err);
        }
      }

      throw new PaymentFailedError(
        'Stripe payment required but no stripeCustomerId or stripeSessionResolver configured',
      );
    }

    throw new PaymentFailedError(
      `Unsupported payment challenge type: ${challenge.type}`,
    );
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  private async safeReadBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      try {
        return await response.text();
      } catch {
        return undefined;
      }
    }
  }
}
