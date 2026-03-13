import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSpec } from './spec-hash';
import type { AgentSpec } from '@/types/agent-spec';

const base: AgentSpec = {
  specVersion: '1.0.0',
  id: 'urn:pactspec:acme:alpha',
  name: 'Alpha',
  version: '1.0.0',
  provider: { name: 'Acme', url: 'https://acme.ai' },
  endpoint: { url: 'https://api.acme.ai/agent' },
  skills: [
    { id: 's1', name: 'Skill 1', description: 'd', inputSchema: { type: 'object' }, outputSchema: { type: 'object' } },
  ],
};

test('hashSpec is stable across key ordering', () => {
  const reordered: AgentSpec = {
    skills: [...base.skills].map(({ name, id, description, outputSchema, inputSchema }) => ({
      id, name, description, inputSchema, outputSchema,
    })),
    provider: { url: 'https://acme.ai', name: 'Acme' },
    endpoint: { url: 'https://api.acme.ai/agent' },
    id: 'urn:pactspec:acme:alpha',
    name: 'Alpha',
    version: '1.0.0',
    specVersion: '1.0.0',
  };

  assert.equal(hashSpec(base), hashSpec(reordered));
});

test('hashSpec changes when values change', () => {
  const changed: AgentSpec = { ...base, id: 'urn:pactspec:acme:beta' };
  assert.notEqual(hashSpec(base), hashSpec(changed));
});
