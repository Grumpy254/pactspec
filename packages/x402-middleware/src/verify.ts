/**
 * Payment verification implementations for x402 middleware.
 *
 * - `createMockVerifier` — accepts any non-empty tx hash (dev/test only).
 * - `createSolanaVerifier` — verifies Solana transactions via JSON-RPC.
 * - `createBaseVerifier` — verifies Base (EVM) transactions via JSON-RPC.
 * - `createEthVerifier` — alias for any EVM chain (Ethereum, Arbitrum, etc.).
 *
 * All verifiers use plain `fetch()` — zero external dependencies.
 */

import type { PaymentVerifier, PaymentExpectation } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USDC_DECIMALS = 6;
const SOL_DECIMALS = 9;
const ETH_DECIMALS = 18;

/** USDC contract address on Base */
const USDC_BASE_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/** USDC SPL token mint on Solana */
const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** ERC-20 Transfer(address,address,uint256) event topic */
const TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Solana System Program ID */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

/** Solana SPL Token Program ID */
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a JSON-RPC call via fetch with a 10-second timeout. */
async function jsonRpc(
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`[x402] RPC request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { result?: unknown; error?: { message: string } };

  if (json.error) {
    throw new Error(`[x402] RPC error: ${json.error.message}`);
  }

  return json.result;
}

/** Case-insensitive hex address comparison. */
function addressEq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// ---------------------------------------------------------------------------
// Mock verifier (development / testing)
// ---------------------------------------------------------------------------

/**
 * Creates a mock payment verifier that approves any non-empty transaction
 * hash without contacting a blockchain.
 *
 * **Do not use in production.** This is intended for local development and
 * automated tests only.
 *
 * @example
 * ```ts
 * import { x402Middleware, createMockVerifier } from '@pactspec/x402-middleware';
 *
 * app.use(x402Middleware({
 *   payTo: '...',
 *   pricing: { amount: 1000, currency: 'USDC', network: 'solana-devnet' },
 *   verifyPayment: createMockVerifier(),
 * }));
 * ```
 */
export function createMockVerifier(): PaymentVerifier {
  return async (txHash: string, _expected: PaymentExpectation): Promise<boolean> => {
    // Accept any truthy, non-whitespace transaction hash.
    return typeof txHash === 'string' && txHash.trim().length > 0;
  };
}

// ---------------------------------------------------------------------------
// Solana verifier
// ---------------------------------------------------------------------------

/**
 * Creates a Solana payment verifier that checks an on-chain transaction
 * against the expected payment parameters using a JSON-RPC endpoint.
 *
 * Supports both native SOL transfers (System Program) and USDC transfers
 * (SPL Token Program). Uses only `fetch()` and the standard Solana JSON-RPC
 * `getTransaction` method — no SDK dependencies.
 *
 * @param rpcUrl - Solana JSON-RPC endpoint (e.g. `https://api.mainnet-beta.solana.com`)
 *
 * @example
 * ```ts
 * import { x402Middleware, createSolanaVerifier } from '@pactspec/x402-middleware';
 *
 * app.use(x402Middleware({
 *   payTo: 'So1anaWa11etAddressHere111111111111111111111',
 *   pricing: { amount: 1000, currency: 'USDC', network: 'solana-mainnet' },
 *   verifyPayment: createSolanaVerifier('https://api.mainnet-beta.solana.com'),
 * }));
 * ```
 */
export function createSolanaVerifier(rpcUrl: string): PaymentVerifier {
  return async (txHash: string, expected: PaymentExpectation): Promise<boolean> => {
    // 1. Fetch the transaction
    const result = (await jsonRpc(rpcUrl, 'getTransaction', [
      txHash,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
    ])) as SolanaTransactionResult | null;

    // 2. Transaction must exist
    if (!result) return false;

    // 3. Transaction must have succeeded (no error)
    if (result.meta?.err !== null) return false;

    const instructions: SolanaParsedInstruction[] =
      result.transaction?.message?.instructions ?? [];
    const innerInstructions: SolanaInnerInstruction[] =
      result.meta?.innerInstructions ?? [];

    // Flatten all instructions (top-level + inner)
    const allInstructions: SolanaParsedInstruction[] = [
      ...instructions,
      ...innerInstructions.flatMap((ii) => ii.instructions ?? []),
    ];

    if (expected.currency === 'USDC') {
      return verifySolanaTokenTransfer(allInstructions, expected);
    }

    // SOL native transfer
    return verifySolanaNativeTransfer(allInstructions, expected);
  };
}

/** Check for an SPL token transfer matching the expected USDC payment. */
function verifySolanaTokenTransfer(
  instructions: SolanaParsedInstruction[],
  expected: PaymentExpectation,
): boolean {
  const requiredAmount = expected.amount / 10 ** USDC_DECIMALS;

  for (const ix of instructions) {
    if (ix.programId !== TOKEN_PROGRAM_ID) continue;

    const parsed = ix.parsed;
    if (!parsed) continue;

    const type = parsed.type;
    if (type !== 'transfer' && type !== 'transferChecked') continue;

    const info = parsed.info;
    if (!info) continue;

    // For transferChecked, the mint is available directly
    if (type === 'transferChecked' && info.mint && info.mint !== USDC_SOLANA_MINT) {
      continue;
    }

    // Destination must match expected payTo
    const destination: string = info.destination ?? '';
    if (destination !== expected.payTo) continue;

    // Amount check — parsed amounts are strings representing UI amounts
    // or raw token amounts depending on the field
    const amount = parseFloat(
      type === 'transferChecked'
        ? info.tokenAmount?.uiAmountString ?? '0'
        : info.amount ?? '0',
    );

    // For plain 'transfer', amount is in raw lamport-style units
    const normalizedAmount =
      type === 'transfer' ? amount / 10 ** USDC_DECIMALS : amount;

    if (normalizedAmount >= requiredAmount) {
      return true;
    }
  }

  return false;
}

/** Check for a native SOL transfer matching the expected payment. */
function verifySolanaNativeTransfer(
  instructions: SolanaParsedInstruction[],
  expected: PaymentExpectation,
): boolean {
  const requiredLamports = expected.amount * 10 ** (SOL_DECIMALS - USDC_DECIMALS);

  for (const ix of instructions) {
    if (ix.programId !== SYSTEM_PROGRAM_ID) continue;

    const parsed = ix.parsed;
    if (!parsed) continue;
    if (parsed.type !== 'transfer') continue;

    const info = parsed.info;
    if (!info) continue;

    const destination: string = info.destination ?? '';
    if (destination !== expected.payTo) continue;

    const lamports = Number(info.lamports ?? 0);
    if (lamports >= requiredLamports) {
      return true;
    }
  }

  return false;
}

// Solana JSON-RPC response types (minimal, for jsonParsed encoding)

interface SolanaTransactionResult {
  meta: {
    err: unknown;
    innerInstructions?: SolanaInnerInstruction[];
  } | null;
  transaction?: {
    message?: {
      instructions?: SolanaParsedInstruction[];
    };
  };
}

interface SolanaInnerInstruction {
  instructions?: SolanaParsedInstruction[];
}

interface SolanaParsedInstruction {
  programId: string;
  parsed?: {
    type: string;
    info?: Record<string, any>;
  };
}

// ---------------------------------------------------------------------------
// EVM verifier (Base, Ethereum, Arbitrum, etc.)
// ---------------------------------------------------------------------------

/**
 * Creates an EVM-compatible payment verifier that works with any chain
 * supporting standard Ethereum JSON-RPC (Base, Ethereum, Arbitrum, etc.).
 *
 * Verifies transactions by fetching the receipt via `eth_getTransactionReceipt`
 * and, for native ETH transfers, the transaction itself via `eth_getTransactionByHash`.
 *
 * Supports:
 * - **USDC (ERC-20):** Parses Transfer event logs to verify recipient and amount.
 * - **Native ETH:** Checks the transaction `to` and `value` fields.
 *
 * @param rpcUrl - Ethereum JSON-RPC endpoint
 * @param usdcContract - Optional USDC contract address override (defaults to Base USDC)
 *
 * @example
 * ```ts
 * import { x402Middleware, createEthVerifier } from '@pactspec/x402-middleware';
 *
 * // Base
 * app.use(x402Middleware({
 *   payTo: '0xYourAddress',
 *   pricing: { amount: 1000, currency: 'USDC', network: 'base' },
 *   verifyPayment: createEthVerifier('https://mainnet.base.org'),
 * }));
 *
 * // Ethereum mainnet with custom USDC address
 * const verifier = createEthVerifier(
 *   'https://eth.llamarpc.com',
 *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
 * );
 * ```
 */
export function createEthVerifier(
  rpcUrl: string,
  usdcContract: string = USDC_BASE_CONTRACT,
): PaymentVerifier {
  return async (txHash: string, expected: PaymentExpectation): Promise<boolean> => {
    // 1. Fetch the transaction receipt
    const receipt = (await jsonRpc(rpcUrl, 'eth_getTransactionReceipt', [
      txHash,
    ])) as EvmReceipt | null;

    // 2. Receipt must exist and transaction must have succeeded
    if (!receipt) return false;
    if (receipt.status !== '0x1') return false;

    if (expected.currency === 'USDC') {
      return verifyEvmTokenTransfer(receipt, expected, usdcContract);
    }

    // Native ETH transfer — need the transaction itself for the value
    const tx = (await jsonRpc(rpcUrl, 'eth_getTransactionByHash', [
      txHash,
    ])) as EvmTransaction | null;

    if (!tx) return false;

    return verifyEvmNativeTransfer(tx, expected);
  };
}

/** Verify an ERC-20 USDC transfer from receipt logs. */
function verifyEvmTokenTransfer(
  receipt: EvmReceipt,
  expected: PaymentExpectation,
  usdcContract: string,
): boolean {
  const logs = receipt.logs ?? [];
  const requiredRaw = BigInt(Math.round(expected.amount * 10 ** USDC_DECIMALS));

  for (const log of logs) {
    // Must be from the USDC contract
    if (!addressEq(log.address, usdcContract)) continue;

    // Must be a Transfer event
    const topics = log.topics ?? [];
    if (topics.length < 3) continue;
    if (topics[0] !== TRANSFER_EVENT_TOPIC) continue;

    // topics[1] = from (padded to 32 bytes), topics[2] = to (padded to 32 bytes)
    const toAddress = '0x' + (topics[2] ?? '').slice(26);
    if (!addressEq(toAddress, expected.payTo)) continue;

    // data = uint256 value (hex)
    const value = BigInt(log.data ?? '0x0');
    if (value >= requiredRaw) {
      return true;
    }
  }

  return false;
}

/** Verify a native ETH transfer. */
function verifyEvmNativeTransfer(
  tx: EvmTransaction,
  expected: PaymentExpectation,
): boolean {
  if (!tx.to || !addressEq(tx.to, expected.payTo)) return false;

  const value = BigInt(tx.value ?? '0x0');
  const requiredWei = BigInt(Math.round(expected.amount * 10 ** ETH_DECIMALS));

  return value >= requiredWei;
}

// Minimal EVM JSON-RPC types

interface EvmReceipt {
  status: string;
  to?: string;
  logs?: EvmLog[];
}

interface EvmLog {
  address: string;
  topics?: string[];
  data?: string;
}

interface EvmTransaction {
  to?: string;
  value?: string;
}

// ---------------------------------------------------------------------------
// Base verifier (convenience alias for createEthVerifier on Base)
// ---------------------------------------------------------------------------

/**
 * Creates a payment verifier for Base network. This is a convenience wrapper
 * around {@link createEthVerifier} pre-configured with the Base USDC contract.
 *
 * @param rpcUrl - Base JSON-RPC endpoint (e.g. `https://mainnet.base.org`)
 *
 * @example
 * ```ts
 * import { x402Middleware, createBaseVerifier } from '@pactspec/x402-middleware';
 *
 * app.use(x402Middleware({
 *   payTo: '0xYourAddress',
 *   pricing: { amount: 1000, currency: 'USDC', network: 'base' },
 *   verifyPayment: createBaseVerifier('https://mainnet.base.org'),
 * }));
 * ```
 */
export function createBaseVerifier(rpcUrl: string): PaymentVerifier {
  return createEthVerifier(rpcUrl, USDC_BASE_CONTRACT);
}
