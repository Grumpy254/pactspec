/**
 * x402 payment middleware.
 *
 * Framework-agnostic Connect/Express-style middleware that implements the
 * HTTP 402 Payment Required flow for PactSpec agent endpoints.
 */

import { randomUUID } from 'node:crypto';
import type {
  X402Options,
  X402MiddlewareFunction,
  PaymentChallenge,
  PaymentProof,
  PaymentExpectation,
  PaymentRecord,
} from './types.js';
import { createMockVerifier } from './verify.js';

class TtlMap<V> {
  private map = new Map<string, { value: V; expiresAt: number }>();
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly sweepEveryMs = 60_000) {
    this.sweepInterval = setInterval(() => this.sweep(), this.sweepEveryMs);
    if (this.sweepInterval.unref) this.sweepInterval.unref();
  }

  set(key: string, value: V, ttlMs: number): void {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) this.map.delete(key);
    }
  }

  /** Stop the background sweep timer. Call when shutting down. */
  destroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.map.clear();
  }
}

function getHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const val = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  return val;
}

/**
 * Parse the X-Payment-Proof header value.
 *
 * Accepted formats:
 *   - Plain transaction hash: `5abc123...`
 *   - JSON: `{"txHash":"5abc123...","paymentId":"..."}`
 */
function parsePaymentProof(raw: string): PaymentProof | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.txHash === 'string' && parsed.txHash.trim()) {
        return {
          txHash: parsed.txHash.trim(),
          paymentId: typeof parsed.paymentId === 'string' ? parsed.paymentId : '',
        };
      }
    } catch {
      // Not valid JSON — fall through to plain hash
    }
  }

  return { txHash: trimmed, paymentId: '' };
}

/**
 * Creates an x402 payment middleware.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { x402Middleware } from '@pactspec/x402-middleware';
 *
 * const app = express();
 *
 * app.use('/api/agent', x402Middleware({
 *   payTo: 'So1anaWa11etAddressHere...',
 *   pricing: {
 *     amount: 1000,       // 0.001 USDC (6 decimals)
 *     currency: 'USDC',
 *     network: 'solana-mainnet',
 *   },
 * }));
 *
 * app.post('/api/agent', (req, res) => {
 *   res.json({ result: 'paid response' });
 * });
 * ```
 */
export function x402Middleware(options: X402Options): X402MiddlewareFunction {
  const {
    payTo,
    pricing,
    verifyPayment = createMockVerifier(),
    onPaymentReceived,
    skipIf,
    challengeTtlMs = 300_000,       // 5 minutes
    deduplicationTtlMs = 3_600_000, // 1 hour
  } = options;

  const challenges = new TtlMap<PaymentChallenge>();
  const verified = new TtlMap<true>();

  return function x402(req, res, next) {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    if (skipIf && skipIf(req)) {
      next();
      return;
    }

    const proofHeader = getHeader(
      req.headers as Record<string, string | string[] | undefined>,
      'x-payment-proof',
    );

    if (!proofHeader) {
      const paymentId = randomUUID();
      const expiresAt = new Date(Date.now() + challengeTtlMs).toISOString();

      const challenge: PaymentChallenge = {
        amount: pricing.amount,
        currency: pricing.currency,
        network: pricing.network,
        payTo,
        paymentId,
        expiresAt,
      };

      challenges.set(paymentId, challenge, challengeTtlMs);

      res.writeHead(402, {
        'Content-Type': 'application/json',
        'X-Payment-Network': pricing.network,
        'X-Payment-Currency': pricing.currency,
      });
      res.end(JSON.stringify(challenge));
      return;
    }

    const proof = parsePaymentProof(proofHeader);

    if (!proof) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Malformed X-Payment-Proof header' }));
      return;
    }

    if (proof.paymentId && verified.has(proof.paymentId)) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Payment already consumed', paymentId: proof.paymentId }),
      );
      return;
    }

    const expectation: PaymentExpectation = {
      amount: pricing.amount,
      currency: pricing.currency,
      network: pricing.network,
      payTo,
      paymentId: proof.paymentId,
    };

    if (proof.paymentId) {
      const challenge = challenges.get(proof.paymentId);
      if (!challenge) {
        res.writeHead(410, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Payment challenge expired or unknown',
            paymentId: proof.paymentId,
          }),
        );
        return;
      }
    }

    verifyPayment(proof.txHash, expectation)
      .then((valid) => {
        if (!valid) {
          res.writeHead(402, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payment verification failed' }));
          return;
        }

        if (proof.paymentId) {
          verified.set(proof.paymentId, true, deduplicationTtlMs);
          challenges.delete(proof.paymentId);
        }

        if (onPaymentReceived) {
          const record: PaymentRecord = {
            paymentId: proof.paymentId,
            txHash: proof.txHash,
            amount: pricing.amount,
            currency: pricing.currency,
            network: pricing.network,
            payTo,
            verifiedAt: new Date().toISOString(),
          };
          try {
            onPaymentReceived(record);
          } catch {
            // Don't let callback errors break the request flow
          }
        }

        next();
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Payment verification error',
            detail: err instanceof Error ? err.message : String(err),
          }),
        );
      });
  };
}
