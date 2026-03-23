/**
 * Sanitize a search query for safe use in PostgREST ilike filters.
 * Strips metacharacters and escapes SQL LIKE wildcards.
 */
export function sanitizeSearchQuery(q: string): string {
  // Keep only characters that cannot break PostgREST filter syntax.
  // Strips `.`, `(`, `)`, `,`, `*`, `%` which are PostgREST/LIKE metacharacters.
  const safe = q.replace(/[^a-zA-Z0-9 _\-@]/g, '').slice(0, 100);
  // Escape `_` which is a single-char wildcard in SQL LIKE/ilike
  return safe.replace(/_/g, '\\_');
}
