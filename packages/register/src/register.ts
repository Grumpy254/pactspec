/**
 * Registration logic — builds a PactSpec JSON and publishes it to the registry.
 */

import type { PactSpecRegisterOptions, SkillConfig, PublishResult } from './types.js';

// ---------------------------------------------------------------------------
// Spec builder
// ---------------------------------------------------------------------------

/**
 * Build a complete PactSpec JSON document from the register options and a
 * resolved base URL.
 */
export function buildSpec(
  options: PactSpecRegisterOptions,
  baseUrl: string,
): Record<string, unknown> {
  const providerName = options.provider?.name ?? 'Unknown';
  const agentId = options.agentId ?? deriveAgentId(providerName, options.name);
  const version = options.version ?? '1.0.0';
  const description =
    options.description ?? autoDescription(options.name, options.skills);

  const normalizedBase = baseUrl.replace(/\/+$/, '');

  const skills = options.skills.map((skill) => {
    const entry: Record<string, unknown> = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      tags: skill.tags ?? [],
      inputSchema: skill.inputSchema,
      outputSchema: skill.outputSchema,
    };
    if (skill.pricing) {
      entry.pricing = {
        model: skill.pricing.model,
        amount: skill.pricing.amount,
        currency: skill.pricing.currency,
        ...(skill.pricing.protocol ? { protocol: skill.pricing.protocol } : {}),
      };
    }
    if (skill.testSuite) {
      entry.testSuite = skill.testSuite;
    }
    return entry;
  });

  const spec: Record<string, unknown> = {
    specVersion: '1.0.0',
    id: agentId,
    name: options.name,
    version,
    description,
    provider: {
      name: providerName,
      ...(options.provider?.url ? { url: options.provider.url } : {}),
      ...(options.provider?.contact ? { contact: options.provider.contact } : {}),
    },
    endpoint: {
      url: normalizedBase,
      auth: options.auth ?? { type: 'none' },
    },
    skills,
    ...(options.tags && options.tags.length > 0 ? { tags: options.tags } : {}),
  };

  return spec;
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/**
 * POST the spec to the registry.
 */
export async function publishToRegistry(
  spec: Record<string, unknown>,
  opts: { registry: string; agentId: string; publishToken?: string },
): Promise<PublishResult> {
  const url = `${opts.registry.replace(/\/+$/, '')}/api/agents`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Agent-ID': opts.agentId,
  };
  if (opts.publishToken) {
    headers['X-Publish-Token'] = opts.publishToken;
  }

  // Use the global fetch (Node 18+). No runtime dependencies needed.
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(spec),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = (body as Record<string, string>).error ?? detail;
    } catch {
      // ignore parse errors
    }
    return { success: false, error: `${res.status} ${detail}` };
  }

  const agentUrl = `${opts.registry.replace(/\/+$/, '')}/agents/${opts.agentId}`;
  return { success: true, agentUrl };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a URL-safe agent ID from the provider name and agent name.
 * Example: "Acme Corp" + "Invoice Processing Agent" => "acme-corp:invoice-processing-agent"
 */
function deriveAgentId(providerName: string, agentName: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(providerName)}:${slug(agentName)}`;
}

/**
 * Generate a description from the skills list when none is provided.
 */
function autoDescription(name: string, skills: SkillConfig[]): string {
  if (skills.length === 1) {
    return `${name} — ${skills[0].description}`;
  }
  const names = skills.map((s) => s.name).join(', ');
  return `${name} providing ${skills.length} skills: ${names}`;
}
