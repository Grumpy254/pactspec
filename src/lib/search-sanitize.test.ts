import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSearchQuery } from './search-sanitize';

test('strips PostgREST metacharacters', () => {
  assert.equal(sanitizeSearchQuery('foo.bar'), 'foobar');
  assert.equal(sanitizeSearchQuery('a(b)c'), 'abc');
  assert.equal(sanitizeSearchQuery('a,b,c'), 'abc');
  assert.equal(sanitizeSearchQuery('a*b'), 'ab');
});

test('escapes SQL LIKE underscore wildcard', () => {
  const result = sanitizeSearchQuery('my_agent');
  assert.equal(result, 'my\\_agent');
});

test('preserves allowed characters', () => {
  assert.equal(sanitizeSearchQuery('hello world'), 'hello world');
  assert.equal(sanitizeSearchQuery('agent-v2'), 'agent-v2');
  assert.equal(sanitizeSearchQuery('user@org'), 'user@org');
});

test('truncates to 100 characters', () => {
  const long = 'a'.repeat(200);
  assert.equal(sanitizeSearchQuery(long).length, 100);
});

test('handles empty and whitespace input', () => {
  assert.equal(sanitizeSearchQuery(''), '');
  assert.equal(sanitizeSearchQuery('   '), '   ');
});

test('strips percent which is a LIKE multi-char wildcard', () => {
  assert.equal(sanitizeSearchQuery('100%'), '100');
  assert.equal(sanitizeSearchQuery('%admin%'), 'admin');
});

test('multiple underscores are all escaped', () => {
  assert.equal(sanitizeSearchQuery('a___b'), 'a\\_\\_\\_b');
});
