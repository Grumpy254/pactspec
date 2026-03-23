/**
 * @pactspec/x402-middleware
 *
 * HTTP 402 micropayment middleware for PactSpec agent endpoints.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { x402Middleware, createMockVerifier } from '@pactspec/x402-middleware';
 *
 * const app = express();
 *
 * app.use('/api/agent', x402Middleware({
 *   payTo: 'So1anaWa11etAddressHere...',
 *   pricing: {
 *     amount: 1000,
 *     currency: 'USDC',
 *     network: 'solana-mainnet',
 *   },
 * }));
 * ```
 *
 * @packageDocumentation
 */

// Middleware
export { x402Middleware } from './middleware.js';

// Verifiers
export {
  createMockVerifier,
  createSolanaVerifier,
  createBaseVerifier,
  createEthVerifier,
} from './verify.js';

// Types
export type {
  PaymentCurrency,
  PaymentNetwork,
  PricingConfig,
  PaymentChallenge,
  PaymentProof,
  PaymentExpectation,
  PaymentRecord,
  PaymentVerifier,
  SkipPredicate,
  X402Options,
  X402MiddlewareFunction,
  MiddlewareRequest,
  MiddlewareResponse,
  NextFunction,
  MinimalRequest,
} from './types.js';
