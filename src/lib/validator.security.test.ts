import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl, isPrivateIp } from './validator';

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
