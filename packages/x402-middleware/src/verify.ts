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

function addressEq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Creates a mock payment verifier that approves any non-empty transaction
 * hash without contacting a blockchain.
 *
 * **Do not use in production.** This is intended for local development and
 * automated tests only.
 */
export function createMockVerifier(): PaymentVerifier {
  return async (txHash: string, _expected: PaymentExpectation): Promise<boolean> => {
    return typeof txHash === 'string' && txHash.trim().length > 0;
  };
}

/**
 * Creates a Solana payment verifier that checks an on-chain transaction
 * against the expected payment parameters using a JSON-RPC endpoint.
 *
 * Supports both native SOL transfers (System Program) and USDC transfers
 * (SPL Token Program). Uses only `fetch()` and the standard Solana JSON-RPC
 * `getTransaction` method — no SDK dependencies.
 *
 * @param rpcUrl - Solana JSON-RPC endpoint (e.g. `https://api.mainnet-beta.solana.com`)
 */
export function createSolanaVerifier(rpcUrl: string): PaymentVerifier {
  return async (txHash: string, expected: PaymentExpectation): Promise<boolean> => {
    const result = (await jsonRpc(rpcUrl, 'getTransaction', [
      txHash,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
    ])) as SolanaTransactionResult | null;

    if (!result) return false;
    if (result.meta?.err !== null) return false;

    const instructions: SolanaParsedInstruction[] =
      result.transaction?.message?.instructions ?? [];
    const innerInstructions: SolanaInnerInstruction[] =
      result.meta?.innerInstructions ?? [];

    const allInstructions: SolanaParsedInstruction[] = [
      ...instructions,
      ...innerInstructions.flatMap((ii) => ii.instructions ?? []),
    ];

    if (expected.currency === 'USDC') {
      return verifySolanaTokenTransfer(allInstructions, expected);
    }

    return verifySolanaNativeTransfer(allInstructions, expected);
  };
}

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

    if (type === 'transferChecked' && info.mint && info.mint !== USDC_SOLANA_MINT) {
      continue;
    }

    const destination: string = info.destination ?? '';
    if (destination !== expected.payTo) continue;

    const amount = parseFloat(
      type === 'transferChecked'
        ? info.tokenAmount?.uiAmountString ?? '0'
        : info.amount ?? '0',
    );

    const normalizedAmount =
      type === 'transfer' ? amount / 10 ** USDC_DECIMALS : amount;

    if (normalizedAmount >= requiredAmount) {
      return true;
    }
  }

  return false;
}

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

/**
 * Creates an EVM-compatible payment verifier that works with any chain
 * supporting standard Ethereum JSON-RPC (Base, Ethereum, Arbitrum, etc.).
 *
 * Supports:
 * - **USDC (ERC-20):** Parses Transfer event logs to verify recipient and amount.
 * - **Native ETH:** Checks the transaction `to` and `value` fields.
 *
 * @param rpcUrl - Ethereum JSON-RPC endpoint
 * @param usdcContract - Optional USDC contract address override (defaults to Base USDC)
 */
export function createEthVerifier(
  rpcUrl: string,
  usdcContract: string = USDC_BASE_CONTRACT,
): PaymentVerifier {
  return async (txHash: string, expected: PaymentExpectation): Promise<boolean> => {
    const receipt = (await jsonRpc(rpcUrl, 'eth_getTransactionReceipt', [
      txHash,
    ])) as EvmReceipt | null;

    if (!receipt) return false;
    if (receipt.status !== '0x1') return false;

    if (expected.currency === 'USDC') {
      return verifyEvmTokenTransfer(receipt, expected, usdcContract);
    }

    const tx = (await jsonRpc(rpcUrl, 'eth_getTransactionByHash', [
      txHash,
    ])) as EvmTransaction | null;

    if (!tx) return false;

    return verifyEvmNativeTransfer(tx, expected);
  };
}

function verifyEvmTokenTransfer(
  receipt: EvmReceipt,
  expected: PaymentExpectation,
  usdcContract: string,
): boolean {
  const logs = receipt.logs ?? [];
  const requiredRaw = BigInt(Math.round(expected.amount * 10 ** USDC_DECIMALS));

  for (const log of logs) {
    if (!addressEq(log.address, usdcContract)) continue;

    const topics = log.topics ?? [];
    if (topics.length < 3) continue;
    if (topics[0] !== TRANSFER_EVENT_TOPIC) continue;

    const toAddress = '0x' + (topics[2] ?? '').slice(26);
    if (!addressEq(toAddress, expected.payTo)) continue;

    const value = BigInt(log.data ?? '0x0');
    if (value >= requiredRaw) {
      return true;
    }
  }

  return false;
}

function verifyEvmNativeTransfer(
  tx: EvmTransaction,
  expected: PaymentExpectation,
): boolean {
  if (!tx.to || !addressEq(tx.to, expected.payTo)) return false;

  const value = BigInt(tx.value ?? '0x0');
  const requiredWei = BigInt(Math.round(expected.amount * 10 ** ETH_DECIMALS));

  return value >= requiredWei;
}

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

/**
 * Creates a payment verifier for Base network. This is a convenience wrapper
 * around {@link createEthVerifier} pre-configured with the Base USDC contract.
 *
 * @param rpcUrl - Base JSON-RPC endpoint (e.g. `https://mainnet.base.org`)
 */
export function createBaseVerifier(rpcUrl: string): PaymentVerifier {
  return createEthVerifier(rpcUrl, USDC_BASE_CONTRACT);
}
