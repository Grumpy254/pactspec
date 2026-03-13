import { createHash } from 'crypto';
import type { AgentSpec } from '@/types/agent-spec';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const sorted = Object.keys(value as object)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]));
    return '{' + sorted.join(',') + '}';
  }
  return JSON.stringify(value);
}

export function hashSpec(spec: AgentSpec): string {
  return createHash('sha256').update(stableStringify(spec)).digest('hex');
}

export function specsEqual(a: AgentSpec, b: AgentSpec): boolean {
  return hashSpec(a) === hashSpec(b);
}
