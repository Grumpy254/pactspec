import { createHash } from 'crypto';
import type { AgentSpec } from '@/types/agent-spec';
import { stableStringify } from './stable-stringify';

export function hashSpec(spec: AgentSpec): string {
  return createHash('sha256').update(stableStringify(spec)).digest('hex');
}

export function specsEqual(a: AgentSpec, b: AgentSpec): boolean {
  return hashSpec(a) === hashSpec(b);
}
