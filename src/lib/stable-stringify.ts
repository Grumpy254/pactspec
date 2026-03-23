/**
 * Deterministic JSON stringification with sorted keys.
 * Produces identical output regardless of object key insertion order.
 *
 * Note: This function handles standard JSON-compatible values (string, number,
 * boolean, null, object, array). It delegates to JSON.stringify for leaf values,
 * which means undefined → "undefined" (not valid JSON), NaN/Infinity → "null".
 * Callers should ensure inputs are well-typed JSON-compatible values.
 */
export function stableStringify(value: unknown): string {
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
