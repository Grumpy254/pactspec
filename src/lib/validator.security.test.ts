import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl, isPrivateIp, buildStatusError } from './validator';

test('isPrivateIp identifies private and reserved ranges', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.0.0.1'), true);
  assert.equal(isPrivateIp('192.168.1.10'), true);
  assert.equal(isPrivateIp('169.254.10.20'), true);
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fc00::1'), true);

  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('1.1.1.1'), false);
  assert.equal(isPrivateIp('2001:4860:4860::8888'), false);
});

test('assertSafeUrl rejects private IPs', async () => {
  process.env.VALIDATION_ALLOW_PRIVATE_IPS = 'false';
  await assert.rejects(
    () => assertSafeUrl('https://127.0.0.1', 'endpoint.url'),
    /private|not allowed/i
  );
});

test('assertSafeUrl allows public IPs', async () => {
  process.env.VALIDATION_ALLOW_PRIVATE_IPS = 'false';
  await assert.doesNotReject(
    () => assertSafeUrl('https://8.8.8.8', 'endpoint.url')
  );
});

test('buildStatusError includes auth warning on 401 with bearer auth', () => {
  const error = buildStatusError(200, 401, 'bearer');
  assert.ok(
    error.includes("endpoint requires 'bearer' auth"),
    `Expected auth warning in error, got: ${error}`
  );
  assert.ok(
    error.includes('ensure test headers include credentials'),
    `Expected credentials hint in error, got: ${error}`
  );
  assert.ok(
    error.startsWith('Expected status 200, got 401'),
    `Expected status mismatch prefix, got: ${error}`
  );
});

test('buildStatusError includes auth warning on 403 with x-agent-id auth', () => {
  const error = buildStatusError(200, 403, 'x-agent-id');
  assert.ok(
    error.includes("endpoint requires 'x-agent-id' auth"),
    `Expected auth warning in error, got: ${error}`
  );
});

test('buildStatusError omits auth warning for auth type none', () => {
  const error = buildStatusError(200, 401, 'none');
  assert.equal(error, 'Expected status 200, got 401');
});

test('buildStatusError omits auth warning for non-auth status codes', () => {
  const error = buildStatusError(200, 500, 'bearer');
  assert.equal(error, 'Expected status 200, got 500');
});

test('buildStatusError omits auth warning when auth type is undefined', () => {
  const error = buildStatusError(200, 401, undefined);
  assert.equal(error, 'Expected status 200, got 401');
});
