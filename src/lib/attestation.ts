import { createHash, sign, verify, generateKeyPairSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { TestResult } from '@/types/agent-spec';
import { stableStringify } from './stable-stringify';

/**
 * Registry Ed25519 signatures for validation results.
 *
 * The registry holds a private key and signs every validation/benchmark result.
 * The public key is published at /api/registry-key so anyone can verify
 * that the registry actually ran those tests — not just that a hash matches.
 *
 * Key storage: REGISTRY_SIGNING_KEY env var (base64-encoded Ed25519 private key).
 * If not set, generates an ephemeral keypair (dev mode only — logs a warning).
 */

interface KeyPair {
  privateKey: Buffer;
  publicKey: Buffer;
}

let cachedKeyPair: KeyPair | null = null;

function getKeyPair(): KeyPair {
  if (cachedKeyPair) return cachedKeyPair;

  const envKey = process.env.REGISTRY_SIGNING_KEY;
  if (envKey) {
    // Production: load from env
    const privateKey = Buffer.from(envKey, 'base64');
    // Derive public key from private key
    const keyObject = require('crypto').createPrivateKey({
      key: privateKey,
      format: 'der',
      type: 'pkcs8',
    });
    const publicKey = require('crypto').createPublicKey(keyObject)
      .export({ type: 'spki', format: 'der' });
    cachedKeyPair = { privateKey, publicKey: Buffer.from(publicKey) };
    return cachedKeyPair;
  }

  // Dev mode: generate ephemeral keypair or load from .keys directory
  const keysDir = join(process.cwd(), '.keys');
  const privPath = join(keysDir, 'registry.key');
  const pubPath = join(keysDir, 'registry.pub');

  if (existsSync(privPath) && existsSync(pubPath)) {
    cachedKeyPair = {
      privateKey: readFileSync(privPath),
      publicKey: readFileSync(pubPath),
    };
    return cachedKeyPair;
  }

  console.warn('[attestation] No REGISTRY_SIGNING_KEY set — generating ephemeral keypair (dev mode)');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });

  try {
    if (!existsSync(keysDir)) mkdirSync(keysDir, { recursive: true });
    writeFileSync(privPath, privDer);
    writeFileSync(pubPath, pubDer);
  } catch {
    // Can't write keys (e.g., read-only filesystem) — use ephemeral
  }

  cachedKeyPair = { privateKey: Buffer.from(privDer), publicKey: Buffer.from(pubDer) };
  return cachedKeyPair;
}

/**
 * Get the registry's public key in base64 for publishing at /api/registry-key.
 */
export function getPublicKeyBase64(): string {
  return getKeyPair().publicKey.toString('base64');
}

/**
 * Build the canonical payload that gets signed.
 */
function buildPayload(
  agentId: string,
  skillId: string,
  results: TestResult[],
  timestamp: string
): string {
  const sorted = [...results].sort((a, b) => a.testId.localeCompare(b.testId));
  return stableStringify({ agentId, skillId, results: sorted, timestamp });
}

/**
 * Sign validation results with the registry's Ed25519 private key.
 * Returns both the signature (hex) and a content hash (SHA-256 hex) for quick comparison.
 */
export function signValidationResult(
  agentId: string,
  skillId: string,
  results: TestResult[],
  timestamp: string
): { signature: string; contentHash: string } {
  const payload = buildPayload(agentId, skillId, results, timestamp);
  const contentHash = createHash('sha256').update(payload).digest('hex');

  const { privateKey } = getKeyPair();
  const keyObject = require('crypto').createPrivateKey({
    key: privateKey,
    format: 'der',
    type: 'pkcs8',
  });
  const sig = sign(null, Buffer.from(payload), keyObject);

  return {
    signature: sig.toString('hex'),
    contentHash,
  };
}

/**
 * Verify a signature against the registry's public key.
 * Can be called by anyone who has the public key.
 */
export function verifySignature(
  agentId: string,
  skillId: string,
  results: TestResult[],
  timestamp: string,
  signature: string,
  publicKeyBase64?: string
): boolean {
  const payload = buildPayload(agentId, skillId, results, timestamp);
  const pubKeyBuf = publicKeyBase64
    ? Buffer.from(publicKeyBase64, 'base64')
    : getKeyPair().publicKey;

  const keyObject = require('crypto').createPublicKey({
    key: pubKeyBuf,
    format: 'der',
    type: 'spki',
  });

  return verify(null, Buffer.from(payload), keyObject, Buffer.from(signature, 'hex'));
}

// Backwards compatibility — old name, returns just the content hash
export function generateAttestationHash(
  agentId: string,
  skillId: string,
  results: TestResult[],
  timestamp: string
): string {
  return signValidationResult(agentId, skillId, results, timestamp).contentHash;
}
