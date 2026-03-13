'use client';

import { useState } from 'react';

const EXAMPLE_SPEC = JSON.stringify(
  {
    specVersion: '1.0.0',
    id: 'urn:agent:acme:invoice-processor',
    name: 'Invoice Processor',
    version: '1.0.0',
    description: 'Extracts structured data from PDF invoices using vision AI.',
    provider: {
      name: 'Acme AI',
      url: 'https://acme.ai',
      contact: 'hello@acme.ai',
    },
    endpoint: {
      url: 'https://api.acme.ai/agents/invoice-processor',
      auth: { type: 'bearer' },
    },
    skills: [
      {
        id: 'extract-line-items',
        name: 'Extract Line Items',
        description: 'Parse line items, totals, and tax from invoice PDFs.',
        tags: ['invoice', 'extraction', 'pdf'],
        inputSchema: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string', format: 'uri' } },
        },
        outputSchema: {
          type: 'object',
          required: ['lineItems', 'total'],
          properties: {
            lineItems: { type: 'array' },
            total: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        pricing: { model: 'per-invocation', amount: 0.02, currency: 'USD', protocol: 'stripe' },
        sla: { p99LatencyMs: 5000, uptimeSLA: 0.999 },
        testSuite: {
          url: 'https://acme.ai/tests/extract-line-items.json',
          type: 'http-roundtrip',
        },
      },
    ],
    tags: ['invoice', 'finance', 'extraction'],
    license: 'MIT',
  },
  null,
  2
);

type PublishStatus = 'idle' | 'loading' | 'success' | 'error';

export default function PublishPage() {
  const [specText, setSpecText] = useState(EXAMPLE_SPEC);
  const [agentId, setAgentId] = useState('');
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [result, setResult] = useState<{ id?: string; errors?: string[] } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setResult(null);

    let spec: unknown;
    try {
      spec = JSON.parse(specText);
    } catch {
      setStatus('error');
      setResult({ errors: ['Invalid JSON — check your spec'] });
      return;
    }

    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-ID': agentId || 'anonymous',
      },
      body: JSON.stringify(spec),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus('success');
      setResult({ id: data.agent?.id });
    } else {
      setStatus('error');
      setResult({ errors: data.errors ?? [data.error ?? 'Unknown error'] });
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Publish Agent</h1>
      <p className="text-gray-400 mb-8">
        Submit your AgentSpec JSON to register in the public registry.
        Your spec must conform to the{' '}
        <a href="/api/spec/v1" target="_blank" className="text-indigo-400 underline">
          v1 schema
        </a>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Agent ID <span className="text-gray-500">(any identifier for your agent)</span>
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="e.g. acme-invoice-agent"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            AgentSpec JSON
          </label>
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={28}
            spellCheck={false}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {status === 'loading' ? 'Publishing...' : 'Publish Agent'}
        </button>
      </form>

      {status === 'success' && result?.id && (
        <div className="mt-6 bg-emerald-950 border border-emerald-800 rounded-xl p-5">
          <p className="text-emerald-400 font-medium mb-1">Agent published successfully</p>
          <a
            href={`/agents/${result.id}`}
            className="text-indigo-400 underline text-sm font-mono"
          >
            View agent &rarr;
          </a>
        </div>
      )}

      {status === 'error' && result?.errors && (
        <div className="mt-6 bg-red-950 border border-red-800 rounded-xl p-5">
          <p className="text-red-400 font-medium mb-2">Validation errors</p>
          <ul className="text-sm text-red-300 space-y-1 font-mono">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
