import { createHash } from 'crypto';
import type { TestResult } from '@/types/agent-spec';
import { stableStringify } from './stable-stringify';

/**
 * Generate a deterministic SHA-256 attestation hash.
 * Input: agentId + skillId + sorted test results + ISO timestamp.
 * Results are sorted by testId and serialized with key-sorted JSON to ensure
 * the hash is independent of insertion order or JS engine key enumeration.
 */
export function generateAttestationHash(
  agentId: string,
  skillId: string,
  results: TestResult[],
  timestamp: string
): string {
  const sorted = [...results].sort((a, b) => a.testId.localeCompare(b.testId));
  const payload = stableStringify({ agentId, skillId, results: sorted, timestamp });
  return createHash('sha256').update(payload).digest('hex');
}
