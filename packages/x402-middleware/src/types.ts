/**
 * x402 payment middleware types for PactSpec.
 *
 * These types align with the PactSpec pricing declaration
 * (AgentSpecPricing) and the x402 payment protocol.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Currency & network
// ---------------------------------------------------------------------------

/** Currencies supported by the x402 payment flow. */
export type PaymentCurrency = 'USDC' | 'SOL';

/** Blockchain networks the middleware can target. */
export type PaymentNetwork =
  | 'solana-mainnet'
  | 'solana-devnet'
  | 'base'
  | 'base-sepolia';

// ---------------------------------------------------------------------------
// Pricing config (mirrors PactSpec AgentSpecPricing subset)
// ---------------------------------------------------------------------------

/** Pricing parameters attached to an endpoint or skill. */
export interface PricingConfig {
  /** Price in the smallest currency unit (e.g. lamports for SOL, 6-decimal units for USDC). */
  amount: number;
  /** Payment currency. */
  currency: PaymentCurrency;
  /** Target blockchain network. */
  network: PaymentNetwork;
}

// ---------------------------------------------------------------------------
// Payment challenge (402 response body)
// ---------------------------------------------------------------------------

/** JSON body returned in an HTTP 402 response. */
export interface PaymentChallenge {
  /** Price in smallest unit. */
  amount: number;
  /** Currency identifier. */
  currency: PaymentCurrency;
  /** Blockchain network. */
  network: PaymentNetwork;
  /** Wallet address that should receive the payment. */
  payTo: string;
  /** Unique identifier for this payment request (used for dedup). */
  paymentId: string;
  /** ISO-8601 timestamp after which this challenge expires. */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Payment proof (what the client sends back)
// ---------------------------------------------------------------------------

/** Decoded content of the X-Payment-Proof header. */
export interface PaymentProof {
  /** On-chain transaction hash proving payment. */
  txHash: string;
  /** The paymentId this proof corresponds to. */
  paymentId: string;
}

// ---------------------------------------------------------------------------
// Payment expectation (passed to verifier)
// ---------------------------------------------------------------------------

/** What the verifier should check the transaction against. */
export interface PaymentExpectation {
  amount: number;
  currency: PaymentCurrency;
  network: PaymentNetwork;
  payTo: string;
  paymentId: string;
}

// ---------------------------------------------------------------------------
// Payment record (emitted after successful verification)
// ---------------------------------------------------------------------------

/** Record of a verified payment, emitted via the onPaymentReceived callback. */
export interface PaymentRecord {
  paymentId: string;
  txHash: string;
  amount: number;
  currency: PaymentCurrency;
  network: PaymentNetwork;
  payTo: string;
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

/**
 * A function that verifies an on-chain transaction matches the expected
 * payment parameters. Return `true` if the payment is valid.
 */
export type PaymentVerifier = (
  txHash: string,
  expected: PaymentExpectation,
) => Promise<boolean>;

// ---------------------------------------------------------------------------
// Skip predicate
// ---------------------------------------------------------------------------

/** Minimal request shape used by the skip predicate. */
export interface MinimalRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Return `true` to bypass the payment gate for a given request.
 * Useful for health-check routes, CORS preflight, etc.
 */
export type SkipPredicate = (req: MinimalRequest) => boolean;

// ---------------------------------------------------------------------------
// Middleware options
// ---------------------------------------------------------------------------

/** Configuration for the x402 middleware. */
export interface X402Options {
  /** Wallet address that receives payments. */
  payTo: string;

  /** Pricing parameters for this endpoint. */
  pricing: PricingConfig;

  /**
   * Custom payment verifier. Defaults to a mock verifier that accepts
   * any non-empty transaction hash (suitable for development only).
   */
  verifyPayment?: PaymentVerifier;

  /** Called after a payment has been successfully verified. */
  onPaymentReceived?: (payment: PaymentRecord) => void;

  /**
   * Predicate to skip payment checks for certain requests.
   * OPTIONS (CORS preflight) requests are always skipped automatically.
   */
  skipIf?: SkipPredicate;

  /**
   * How long (in milliseconds) a payment challenge remains valid.
   * @default 300_000 (5 minutes)
   */
  challengeTtlMs?: number;

  /**
   * How long (in milliseconds) to keep verified payment IDs in the
   * deduplication cache before evicting them.
   * @default 3_600_000 (1 hour)
   */
  deduplicationTtlMs?: number;
}

// ---------------------------------------------------------------------------
// Framework-agnostic handler types
// ---------------------------------------------------------------------------

/**
 * Minimal request interface compatible with Node http.IncomingMessage,
 * Express Request, and Fastify Request.
 */
export interface MiddlewareRequest extends IncomingMessage {
  /** Parsed URL path — may be set by frameworks like Express. */
  path?: string;
}

/** Minimal response interface. */
export interface MiddlewareResponse extends ServerResponse {}

/** Connect/Express-style next function. */
export type NextFunction = (err?: unknown) => void;

/** The middleware function signature. */
export type X402MiddlewareFunction = (
  req: MiddlewareRequest,
  res: MiddlewareResponse,
  next: NextFunction,
) => void;
