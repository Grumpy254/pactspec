import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'psk_'; // PactSpec Key

/**
 * Generate a new publisher API key.
 * Returns both the raw key (shown once to the user) and the hash (stored in DB).
 */
export function generatePublisherKey(): { rawKey: string; keyHash: string } {
  const raw = KEY_PREFIX + randomBytes(24).toString('base64url');
  const hash = hashKey(raw);
  return { rawKey: raw, keyHash: hash };
}

/**
 * Hash a raw API key for storage/comparison.
 */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
