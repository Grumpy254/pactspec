'use client';

import { useState, useEffect } from 'react';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const EXAMPLE_SPEC = {
  specVersion: '1.0.0',
  id: 'urn:pactspec:acme:invoice-processor',
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
      testSuite: {
        url: 'https://acme.ai/tests/extract-line-items.json',
        type: 'http-roundtrip',
      },
    },
  ],
  tags: ['invoice', 'finance', 'extraction'],
  license: 'MIT',
};

const EXAMPLE_SPEC_TEXT = JSON.stringify(EXAMPLE_SPEC, null, 2);

type PublishStatus = 'idle' | 'loading' | 'success' | 'error';

// Lazy-load and cache the schema for client-side validation
let cachedValidate: ((spec: unknown) => { valid: boolean; errors: string[] }) | null = null;
async function getValidator() {
  if (cachedValidate) return cachedValidate;
  const schemaRes = await fetch('/api/spec/v1');
  const schema = await schemaRes.json();
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  cachedValidate = (spec: unknown) => {
    const valid = validate(spec) as boolean;
    return {
      valid,
      errors: valid
        ? []
        : (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`),
    };
  };
  return cachedValidate;
}

export default function PublishPage() {
  const [specText, setSpecText] = useState(EXAMPLE_SPEC_TEXT);
  const [agentId, setAgentId] = useState('');
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [result, setResult] = useState<{ id?: string; errors?: string[] } | null>(null);
  const [parseError, setParseError] = useState('');
  const [liveErrors, setLiveErrors] = useState<string[]>([]);

  // Live client-side validation as the user types
  useEffect(() => {
    const timer = setTimeout(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(specText);
        setParseError('');
      } catch (e) {
        setParseError((e as Error).message);
        setLiveErrors([]);
        return;
      }
      try {
        const validator = await getValidator();
        const { errors } = validator(parsed);
        setLiveErrors(errors);
      } catch {
        // schema fetch failed — skip live validation
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [specText]);

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

    let res: Response;
    let data: { agent?: { id: string }; errors?: string[]; error?: string };
    try {
      res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-ID': agentId || 'anonymous',
        },
        body: JSON.stringify(spec),
      });
      data = await res.json();
    } catch {
      setStatus('error');
      setResult({ errors: ['Network error — could not reach the registry'] });
      return;
    }

    if (res.ok) {
      setStatus('success');
      setResult({ id: data.agent?.id });
    } else {
      setStatus('error');
      setResult({ errors: data.errors ?? [data.error ?? 'Unknown error'] });
    }
  }

  const jsonValid = !parseError && liveErrors.length === 0 && specText.trim().length > 0;
  const borderColor = parseError
    ? 'border-red-700 focus:border-red-500'
    : liveErrors.length > 0
    ? 'border-yellow-700 focus:border-yellow-500'
    : specText !== EXAMPLE_SPEC_TEXT
    ? 'border-emerald-800 focus:border-emerald-500'
    : 'border-gray-700 focus:border-indigo-500';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Publish Agent</h1>
      <p className="text-gray-400 mb-8">
        Submit your PactSpec JSON to register in the public registry. Your spec must conform to the{' '}
        <a href="/api/spec/v1" target="_blank" className="text-indigo-400 underline">
          v1 schema
        </a>
        .
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent ID{' '}
            <span className="text-gray-500 font-normal">
              — a stable identifier for your agent (used for updates)
            </span>
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="e.g. acme-invoice-agent or hello@acme.ai"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              PactSpec JSON
              {jsonValid && specText !== EXAMPLE_SPEC_TEXT && (
                <span className="ml-2 text-xs text-emerald-500">✓ valid</span>
              )}
              {(parseError || liveErrors.length > 0) && (
                <span className="ml-2 text-xs text-yellow-500">
                  {parseError ? 'invalid JSON' : `${liveErrors.length} error${liveErrors.length > 1 ? 's' : ''}`}
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => { setSpecText(EXAMPLE_SPEC_TEXT); setParseError(''); setLiveErrors([]); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reset to example
            </button>
          </div>
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={30}
            spellCheck={false}
            className={`w-full bg-gray-900 border rounded-lg px-4 py-3 text-sm text-gray-200 font-mono placeholder-gray-500 focus:outline-none resize-y transition-colors ${borderColor}`}
          />
          {parseError && (
            <p className="mt-1 text-xs text-red-400 font-mono">{parseError}</p>
          )}
          {!parseError && liveErrors.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {liveErrors.slice(0, 5).map((e, i) => (
                <li key={i} className="text-xs text-yellow-500 font-mono">{e}</li>
              ))}
              {liveErrors.length > 5 && (
                <li className="text-xs text-gray-500">+{liveErrors.length - 5} more</li>
              )}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'loading' || !!parseError}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {status === 'loading' ? 'Publishing...' : 'Publish Agent'}
        </button>
      </form>

      {status === 'success' && result?.id && (
        <div className="mt-6 bg-emerald-950 border border-emerald-800 rounded-xl p-5">
          <p className="text-emerald-400 font-medium mb-1">Published successfully</p>
          <a href={`/agents/${result.id}`} className="text-indigo-400 underline text-sm font-mono">
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
