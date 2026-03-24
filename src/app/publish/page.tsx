'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { AgentSpec, AgentSpecSkill, PricingModel, PricingCurrency, PricingProtocol, AuthType } from '@/types/agent-spec';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSpecId(providerName: string, agentName: string) {
  const p = slugify(providerName);
  const a = slugify(agentName);
  if (!p && !a) return '';
  return `urn:pactspec:${p || 'provider'}:${a || 'agent'}`;
}

function tryParseJSON(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null ? v : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Form state interfaces                                             */
/* ------------------------------------------------------------------ */

interface SkillForm {
  id: string;
  name: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
  pricingModel: PricingModel;
  pricingAmount: string;
  pricingCurrency: PricingCurrency;
  pricingProtocol: PricingProtocol;
  testSuiteUrl: string;
}

function emptySkill(): SkillForm {
  return {
    id: '',
    name: '',
    description: '',
    inputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
    outputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
    pricingModel: 'free',
    pricingAmount: '0.01',
    pricingCurrency: 'USD',
    pricingProtocol: 'stripe',
    testSuiteUrl: '',
  };
}

/* ------------------------------------------------------------------ */
/*  Spec builder — form state -> AgentSpec JSON                       */
/* ------------------------------------------------------------------ */

function buildSpec(form: {
  name: string;
  version: string;
  description: string;
  specId: string;
  tags: string;
  providerName: string;
  providerUrl: string;
  providerContact: string;
  endpointUrl: string;
  authType: AuthType;
  skills: SkillForm[];
  hasMcp?: boolean;
  mcpServerUrl?: string;
  hasAcp?: boolean;
  acpSessionTypes?: string[];
  hasOpenapi?: boolean;
  openapiSpecUrl?: string;
}): AgentSpec {
  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const skills: AgentSpecSkill[] = form.skills.map((s) => {
    const skill: AgentSpecSkill = {
      id: s.id || 'skill-1',
      name: s.name || 'Untitled Skill',
      description: s.description || '',
      inputSchema: tryParseJSON(s.inputSchema) ?? { type: 'object', properties: {} },
      outputSchema: tryParseJSON(s.outputSchema) ?? { type: 'object', properties: {} },
    };
    if (s.pricingModel !== 'free') {
      skill.pricing = {
        model: s.pricingModel,
        amount: parseFloat(s.pricingAmount) || 0,
        currency: s.pricingCurrency,
        protocol: s.pricingProtocol,
      };
    } else {
      skill.pricing = { model: 'free', amount: 0, currency: 'USD' };
    }
    if (s.testSuiteUrl.trim()) {
      skill.testSuite = { url: s.testSuiteUrl.trim(), type: 'http-roundtrip' };
    }
    return skill;
  });

  const spec: AgentSpec = {
    specVersion: '1.0.0',
    id: form.specId || buildSpecId(form.providerName, form.name) || 'urn:pactspec:provider:agent',
    name: form.name || 'My Agent',
    version: form.version || '1.0.0',
    provider: {
      name: form.providerName || 'Provider',
      ...(form.providerUrl ? { url: form.providerUrl } : {}),
      ...(form.providerContact ? { contact: form.providerContact } : {}),
    },
    endpoint: {
      url: form.endpointUrl || 'https://example.com/agent',
      ...(form.authType !== 'none' ? { auth: { type: form.authType } } : {}),
    },
    skills,
    ...(form.description ? { description: form.description } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };

  // Build interop section if any protocol is enabled
  const interop: Record<string, unknown> = {};
  if (form.hasMcp && form.mcpServerUrl?.trim()) {
    interop.mcp = { serverUrl: form.mcpServerUrl.trim() };
  }
  if (form.hasAcp) {
    interop.acp = {
      supported: true,
      ...(form.acpSessionTypes && form.acpSessionTypes.length > 0
        ? { sessionTypes: form.acpSessionTypes }
        : {}),
    };
  }
  if (form.hasOpenapi && form.openapiSpecUrl?.trim()) {
    interop.openapi = { specUrl: form.openapiSpecUrl.trim() };
  }
  if (Object.keys(interop).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (spec as any).interop = interop;
  }

  return spec;
}

/* ------------------------------------------------------------------ */
/*  Validator (reused from original)                                  */
/* ------------------------------------------------------------------ */

type PublishStatus = 'idle' | 'loading' | 'success' | 'error';

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

/* ------------------------------------------------------------------ */
/*  Reusable styled components                                        */
/* ------------------------------------------------------------------ */

const inputCls =
  'w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors';
const selectCls =
  'w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none';
const textareaCls =
  'w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y';
const codeCls =
  'w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300 font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-y';
const labelCls = 'block text-sm font-medium text-gray-300 mb-1.5';
const hintCls = 'text-gray-500 font-normal';
const sectionCls = 'bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-4';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white mb-1">{children}</h2>;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function PublishPage() {
  /* Mode toggle */
  const [mode, setMode] = useState<'form' | 'json'>('form');

  /* Form fields */
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [specId, setSpecId] = useState('');
  const [specIdManual, setSpecIdManual] = useState(false);
  const [tags, setTags] = useState('');

  const [providerName, setProviderName] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [providerContact, setProviderContact] = useState('');

  const [endpointUrl, setEndpointUrl] = useState('');
  const [authType, setAuthType] = useState<AuthType>('bearer');

  const [skills, setSkills] = useState<SkillForm[]>([emptySkill()]);

  /* Interop fields */
  const [hasMcp, setHasMcp] = useState(false);
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [hasAcp, setHasAcp] = useState(false);
  const [acpSessionTypes, setAcpSessionTypes] = useState<string[]>([]);
  const [hasOpenapi, setHasOpenapi] = useState(false);
  const [openapiSpecUrl, setOpenapiSpecUrl] = useState('');

  /* JSON editor (for json mode) */
  const EXAMPLE_SPEC_TEXT = useMemo(
    () =>
      JSON.stringify(
        {
          specVersion: '1.0.0',
          id: 'urn:pactspec:acme:invoice-processor',
          name: 'Invoice Processor',
          version: '1.0.0',
          description: 'Extracts structured data from PDF invoices using vision AI.',
          provider: { name: 'Acme AI', url: 'https://acme.ai', contact: 'hello@acme.ai' },
          endpoint: { url: 'https://api.acme.ai/agents/invoice-processor', auth: { type: 'bearer' } },
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
              testSuite: { url: 'https://acme.ai/tests/extract-line-items.json', type: 'http-roundtrip' },
            },
          ],
          tags: ['invoice', 'finance', 'extraction'],
          license: 'MIT',
        },
        null,
        2
      ),
    []
  );
  const [specText, setSpecText] = useState(EXAMPLE_SPEC_TEXT);

  /* Publish state */
  const [agentId, setAgentId] = useState('');
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [result, setResult] = useState<{ id?: string; errors?: string[] } | null>(null);
  const [parseError, setParseError] = useState('');
  const [liveErrors, setLiveErrors] = useState<string[]>([]);
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);

  /* Auto-generate spec ID from provider + name */
  useEffect(() => {
    if (!specIdManual) {
      setSpecId(buildSpecId(providerName, name));
    }
  }, [providerName, name, specIdManual]);

  /* Build spec from form in real-time */
  const formSpec = useMemo(
    () =>
      buildSpec({
        name,
        version,
        description,
        specId,
        tags,
        providerName,
        providerUrl,
        providerContact,
        endpointUrl,
        authType,
        skills,
        hasMcp,
        mcpServerUrl,
        hasAcp,
        acpSessionTypes,
        hasOpenapi,
        openapiSpecUrl,
      }),
    [name, version, description, specId, tags, providerName, providerUrl, providerContact, endpointUrl, authType, skills, hasMcp, mcpServerUrl, hasAcp, acpSessionTypes, hasOpenapi, openapiSpecUrl]
  );

  const formSpecText = useMemo(() => JSON.stringify(formSpec, null, 2), [formSpec]);

  /* Live validation for both modes */
  const activeSpecText = mode === 'form' ? formSpecText : specText;
  useEffect(() => {
    const timer = setTimeout(async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(activeSpecText);
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
        /* schema fetch failed */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [activeSpecText]);

  /* Publish handler */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setResult(null);

    let spec: unknown;
    try {
      spec = JSON.parse(activeSpecText);
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

  /* Skill helpers */
  const updateSkill = useCallback((idx: number, patch: Partial<SkillForm>) => {
    setSkills((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }, []);

  const removeSkill = useCallback((idx: number) => {
    setSkills((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }, []);

  const addSkill = useCallback(() => {
    setSkills((prev) => [...prev, emptySkill()]);
  }, []);

  /* Validation status */
  const jsonValid = !parseError && liveErrors.length === 0 && activeSpecText.trim().length > 0;
  const borderColor = parseError
    ? 'border-red-700 focus:border-red-500'
    : liveErrors.length > 0
    ? 'border-yellow-700 focus:border-yellow-500'
    : 'border-emerald-800 focus:border-emerald-500';

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Publish Your Agent</h1>
      <p className="text-gray-400 mb-8">
        Publish an agent to the PactSpec registry. Four ways to do it.
      </p>

      {/* ---- Choose your path ---- */}
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-5">
          <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-2">Fastest — 1 minute</div>
          <h3 className="text-white font-semibold mb-2">Auto-register from code</h3>
          <p className="text-gray-400 text-sm mb-3">Add one middleware to your Express app. Server publishes itself on startup.</p>
          <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto">
{`npm install @pactspec/register

app.use(pactspec({
  name: 'My Agent',
  provider: { name: 'My Org' },
  skills: [{ id: 'skill-1', ... }]
}));`}
          </pre>
        </div>
        <div className="bg-gray-900 border border-indigo-900/40 rounded-xl p-5">
          <div className="text-indigo-400 text-xs font-semibold uppercase tracking-wide mb-2">CLI — 3 commands</div>
          <h3 className="text-white font-semibold mb-2">Generate, validate, publish</h3>
          <p className="text-gray-400 text-sm mb-3">Interactive wizard creates the spec. Works with MCP servers and OpenAPI too.</p>
          <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto">
{`npm install -g @pactspec/cli

pactspec init -i            # interactive setup
pactspec validate agent.json
pactspec publish agent.json --agent-id my-org`}
          </pre>
        </div>
        <div className="bg-gray-900 border border-violet-900/40 rounded-xl p-5">
          <div className="text-violet-400 text-xs font-semibold uppercase tracking-wide mb-2">Bulk — many at once</div>
          <h3 className="text-white font-semibold mb-2">Publish a directory</h3>
          <p className="text-gray-400 text-sm mb-3">Publish every *.pactspec.json in a folder. Use --recursive for nested dirs.</p>
          <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto">
{`pactspec bulk-publish ./agents/ \\
  --agent-id my-org --recursive

# Published: 47  Failed: 2  Skipped: 1`}
          </pre>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Web form — below</div>
          <h3 className="text-white font-semibold mb-2">Build it here</h3>
          <p className="text-gray-400 text-sm mb-3">Fill out the form or paste raw JSON. Good for your first agent or one-off publishes.</p>
          <div className="flex gap-2 mt-4">
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">Guided form</span>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">Raw JSON editor</span>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">Live validation</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-8 mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Web Publisher</h2>
        <p className="text-gray-500 text-sm mb-6">Build and publish a spec directly from this page.</p>
      </div>

      {/* ---- Mode toggle ---- */}
      <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 mb-8 w-fit">
        <button
          type="button"
          onClick={() => setMode('form')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'form'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => setMode('json')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'json'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          JSON
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agent ID for auth */}
        <div>
          <label className={labelCls}>
            Agent ID <span className={hintCls}>— a stable identifier for your agent (used for updates)</span>
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="e.g. acme-invoice-agent or hello@acme.ai"
            className={inputCls}
          />
        </div>

        {/* ==== FORM MODE ==== */}
        {mode === 'form' && (
          <div className="space-y-6">
            {/* ---- Agent Details ---- */}
            <div className={sectionCls}>
              <SectionTitle>Agent Details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Agent Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Invoice Processor"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Version</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What does your agent do?"
                  className={textareaCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Spec ID <span className={hintCls}>— auto-generated, or edit manually</span>
                </label>
                <input
                  type="text"
                  value={specId}
                  onChange={(e) => {
                    setSpecId(e.target.value);
                    setSpecIdManual(true);
                  }}
                  onBlur={() => {
                    if (!specId.trim()) setSpecIdManual(false);
                  }}
                  placeholder="urn:pactspec:provider-slug:agent-slug"
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Tags <span className={hintCls}>— comma-separated</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="finance, invoices, extraction"
                  className={inputCls}
                />
              </div>
            </div>

            {/* ---- Provider ---- */}
            <div className={sectionCls}>
              <SectionTitle>Provider</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="Acme AI"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>URL</label>
                  <input
                    type="text"
                    value={providerUrl}
                    onChange={(e) => setProviderUrl(e.target.value)}
                    placeholder="https://acme.ai"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Email</label>
                  <input
                    type="text"
                    value={providerContact}
                    onChange={(e) => setProviderContact(e.target.value)}
                    placeholder="hello@acme.ai"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* ---- Endpoint ---- */}
            <div className={sectionCls}>
              <SectionTitle>Endpoint</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    Endpoint URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="https://api.acme.ai/agents/invoice-processor"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Auth Type</label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as AuthType)}
                    className={selectCls}
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="x-agent-id">X-Agent-ID</option>
                    <option value="header">Custom Header</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ---- Interoperability ---- */}
            <div className={sectionCls}>
              <SectionTitle>Interoperability <span className={hintCls}>— optional protocol support</span></SectionTitle>
              <p className="text-xs text-gray-500 -mt-2">Declare which agent-to-agent protocols this agent supports.</p>

              {/* MCP */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasMcp}
                    onChange={(e) => setHasMcp(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-300">This agent has an MCP server</span>
                </label>
                {hasMcp && (
                  <div className="ml-6">
                    <label className={labelCls}>MCP Server URL</label>
                    <input
                      type="text"
                      value={mcpServerUrl}
                      onChange={(e) => setMcpServerUrl(e.target.value)}
                      placeholder="https://api.example.com/mcp"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              {/* ACP */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcp}
                    onChange={(e) => setHasAcp(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">This agent supports ACP sessions</span>
                </label>
                {hasAcp && (
                  <div className="ml-6">
                    <label className={labelCls}>
                      Session Types <span className={hintCls}>— click to toggle</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['coding', 'research', 'chat', 'analysis', 'automation'].map((st) => {
                        const active = acpSessionTypes.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setAcpSessionTypes((prev) =>
                                active ? prev.filter((t) => t !== st) : [...prev, st]
                              )
                            }
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              active
                                ? 'bg-blue-900/60 border-blue-700 text-blue-300'
                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* OpenAPI */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasOpenapi}
                    onChange={(e) => setHasOpenapi(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-300">This agent has an OpenAPI spec</span>
                </label>
                {hasOpenapi && (
                  <div className="ml-6">
                    <label className={labelCls}>OpenAPI Spec URL</label>
                    <input
                      type="text"
                      value={openapiSpecUrl}
                      onChange={(e) => setOpenapiSpecUrl(e.target.value)}
                      placeholder="https://api.example.com/openapi.json"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ---- Skills ---- */}
            {skills.map((skill, idx) => (
              <div key={idx} className="space-y-4">
                <div className={sectionCls}>
                  <div className="flex items-center justify-between">
                    <SectionTitle>
                      Skill {skills.length > 1 ? `#${idx + 1}` : ''}
                    </SectionTitle>
                    {skills.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSkill(idx)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Skill ID</label>
                      <input
                        type="text"
                        value={skill.id}
                        onChange={(e) => updateSkill(idx, { id: e.target.value })}
                        placeholder="extract-line-items"
                        className={`${inputCls} font-mono text-xs`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Skill Name</label>
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => updateSkill(idx, { name: e.target.value })}
                        placeholder="Extract Line Items"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={skill.description}
                      onChange={(e) => updateSkill(idx, { description: e.target.value })}
                      rows={2}
                      placeholder="What does this skill do?"
                      className={textareaCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Input Schema (JSON)</label>
                      <textarea
                        value={skill.inputSchema}
                        onChange={(e) => updateSkill(idx, { inputSchema: e.target.value })}
                        rows={5}
                        spellCheck={false}
                        className={codeCls}
                      />
                      {skill.inputSchema && !tryParseJSON(skill.inputSchema) && (
                        <p className="mt-1 text-xs text-red-400">Invalid JSON</p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Output Schema (JSON)</label>
                      <textarea
                        value={skill.outputSchema}
                        onChange={(e) => updateSkill(idx, { outputSchema: e.target.value })}
                        rows={5}
                        spellCheck={false}
                        className={codeCls}
                      />
                      {skill.outputSchema && !tryParseJSON(skill.outputSchema) && (
                        <p className="mt-1 text-xs text-red-400">Invalid JSON</p>
                      )}
                    </div>
                  </div>

                  {/* ---- Pricing (prominent) ---- */}
                  <div className="mt-2 bg-gradient-to-r from-violet-950/60 to-indigo-950/60 border border-violet-700/50 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600/30 text-violet-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-violet-200">Monetize this Skill</h3>
                        <p className="text-xs text-violet-400/80">Charge per invocation, per token, or per second via Stripe or x402 crypto payments</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-violet-300 mb-1.5">Pricing Model</label>
                        <select
                          value={skill.pricingModel}
                          onChange={(e) => updateSkill(idx, { pricingModel: e.target.value as PricingModel })}
                          className="w-full bg-gray-950/80 border border-violet-700/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-400 transition-colors appearance-none"
                        >
                          <option value="free">Free</option>
                          <option value="per-invocation">Per Invocation</option>
                          <option value="per-token">Per Token</option>
                          <option value="per-second">Per Second</option>
                        </select>
                      </div>
                      {skill.pricingModel !== 'free' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-violet-300 mb-1.5">Amount</label>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              value={skill.pricingAmount}
                              onChange={(e) => updateSkill(idx, { pricingAmount: e.target.value })}
                              className="w-full bg-gray-950/80 border border-violet-700/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-400 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-violet-300 mb-1.5">Currency</label>
                            <select
                              value={skill.pricingCurrency}
                              onChange={(e) => updateSkill(idx, { pricingCurrency: e.target.value as PricingCurrency })}
                              className="w-full bg-gray-950/80 border border-violet-700/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-400 transition-colors appearance-none"
                            >
                              <option value="USD">USD</option>
                              <option value="USDC">USDC</option>
                              <option value="SOL">SOL</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-violet-300 mb-1.5">Payment Protocol</label>
                            <select
                              value={skill.pricingProtocol}
                              onChange={(e) => updateSkill(idx, { pricingProtocol: e.target.value as PricingProtocol })}
                              className="w-full bg-gray-950/80 border border-violet-700/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-violet-400 transition-colors appearance-none"
                            >
                              <option value="none">None</option>
                              <option value="stripe">Stripe</option>
                              <option value="x402">x402 (Crypto)</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ---- Test Suite ---- */}
                  <div>
                    <label className={labelCls}>
                      Test Suite URL <span className={hintCls}>— optional, for validation</span>
                    </label>
                    <input
                      type="text"
                      value={skill.testSuiteUrl}
                      onChange={(e) => updateSkill(idx, { testSuiteUrl: e.target.value })}
                      placeholder="https://acme.ai/tests/extract-line-items.json"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSkill}
              className="w-full border border-dashed border-gray-700 rounded-xl py-3 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              + Add another skill
            </button>

            {/* ---- JSON Preview (collapsible) ---- */}
            <div className="border border-gray-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setJsonPreviewOpen(!jsonPreviewOpen)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors bg-gray-900/40"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">JSON Preview</span>
                  {jsonValid && (
                    <span className="text-xs text-emerald-500">Valid</span>
                  )}
                  {liveErrors.length > 0 && (
                    <span className="text-xs text-yellow-500">
                      {liveErrors.length} error{liveErrors.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 transition-transform ${jsonPreviewOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {jsonPreviewOpen && (
                <div className="border-t border-gray-800">
                  <pre className="p-4 text-xs text-gray-400 font-mono overflow-x-auto max-h-96 overflow-y-auto bg-gray-950/50">
                    {formSpecText}
                  </pre>
                  {liveErrors.length > 0 && (
                    <div className="border-t border-gray-800 p-4">
                      <ul className="space-y-0.5">
                        {liveErrors.slice(0, 5).map((e, i) => (
                          <li key={i} className="text-xs text-yellow-500 font-mono">{e}</li>
                        ))}
                        {liveErrors.length > 5 && (
                          <li className="text-xs text-gray-500">+{liveErrors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==== JSON MODE ==== */}
        {mode === 'json' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">
                PactSpec JSON
                {jsonValid && specText !== EXAMPLE_SPEC_TEXT && (
                  <span className="ml-2 text-xs text-emerald-500">Valid</span>
                )}
                {(parseError || liveErrors.length > 0) && (
                  <span className="ml-2 text-xs text-yellow-500">
                    {parseError ? 'invalid JSON' : `${liveErrors.length} error${liveErrors.length > 1 ? 's' : ''}`}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => {
                  setSpecText(EXAMPLE_SPEC_TEXT);
                  setParseError('');
                  setLiveErrors([]);
                }}
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
        )}

        {/* ---- Submit ---- */}
        <button
          type="submit"
          disabled={status === 'loading' || !!parseError}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {status === 'loading' ? 'Publishing...' : 'Publish Agent'}
        </button>
      </form>

      {/* ---- Result ---- */}
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
