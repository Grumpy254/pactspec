import { createHash } from 'crypto';
import type { TestResult } from '@/types/agent-spec';

/**
 * Generate a deterministic SHA-256 attestation hash.
 * Input: agentId + skillId + sorted test results + ISO timestamp.
 */
export function generateAttestationHash(
  agentId: string,
  skillId: string,
  results: TestResult[],
  timestamp: string
): string {
  const payload = JSON.stringify({ agentId, skillId, results, timestamp });
  return createHash('sha256').update(payload).digest('hex');
}
