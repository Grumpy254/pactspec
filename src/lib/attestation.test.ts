import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAttestationHash } from './attestation';
import type { TestResult } from '@/types/agent-spec';

const baseResults: TestResult[] = [
  { testId: 'test-1', passed: true, durationMs: 100, statusCode: 200 },
  { testId: 'test-2', passed: true, durationMs: 150, statusCode: 200 },
];

const ts = '2025-01-01T00:00:00.000Z';

test('generateAttestationHash is deterministic', () => {
  const h1 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  const h2 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  assert.equal(h1, h2);
});

test('generateAttestationHash is stable regardless of result order', () => {
  const reversed = [...baseResults].reverse();
  const h1 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  const h2 = generateAttestationHash('agent-1', 'skill-1', reversed, ts);
  assert.equal(h1, h2);
});

test('generateAttestationHash changes when agentId changes', () => {
  const h1 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  const h2 = generateAttestationHash('agent-2', 'skill-1', baseResults, ts);
  assert.notEqual(h1, h2);
});

test('generateAttestationHash changes when skillId changes', () => {
  const h1 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  const h2 = generateAttestationHash('agent-1', 'skill-2', baseResults, ts);
  assert.notEqual(h1, h2);
});

test('generateAttestationHash changes when timestamp changes', () => {
  const h1 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  const h2 = generateAttestationHash('agent-1', 'skill-1', baseResults, '2025-06-01T00:00:00.000Z');
  assert.notEqual(h1, h2);
});

test('generateAttestationHash changes when a result changes', () => {
  const modified: TestResult[] = [
    { testId: 'test-1', passed: false, durationMs: 100, statusCode: 500 },
    { testId: 'test-2', passed: true, durationMs: 150, statusCode: 200 },
  ];
  const h1 = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  const h2 = generateAttestationHash('agent-1', 'skill-1', modified, ts);
  assert.notEqual(h1, h2);
});

test('generateAttestationHash returns a 64-char hex string', () => {
  const hash = generateAttestationHash('agent-1', 'skill-1', baseResults, ts);
  assert.match(hash, /^[0-9a-f]{64}$/);
});
