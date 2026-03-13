#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
// Bundled schema — always available regardless of install location
import bundledSchema from '../../src/lib/schema/agent-spec.v1.json';

const program = new Command();

program
  .name('agentspec')
  .description('Official CLI for the AgentSpec protocol')
  .version('0.1.0');

// ── validate ─────────────────────────────────────────────────────────────────
program
  .command('validate <file>')
  .description('Validate an AgentSpec JSON file against the v1 schema')
  .action(async (file: string) => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    let spec: unknown;
    try {
      spec = JSON.parse(readFileSync(resolve(file), 'utf-8'));
    } catch {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      process.exit(1);
    }

    const schema: unknown = bundledSchema;

    const validate = ajv.compile(schema as object);
    const valid = validate(spec);

    if (valid) {
      console.log(pc.green('✓ Valid AgentSpec document'));
    } else {
      console.error(pc.red('✗ Validation failed:'));
      for (const err of validate.errors ?? []) {
        console.error(pc.red(`  ${err.instancePath || '/'} ${err.message}`));
      }
      process.exit(1);
    }
  });

// ── publish ───────────────────────────────────────────────────────────────────
program
  .command('publish <file>')
  .description('Publish an AgentSpec JSON file to the registry')
  .option('-r, --registry <url>', 'Registry URL', 'https://agentspec.dev')
  .option('-k, --agent-id <id>', 'Your agent identifier (X-Agent-ID header)')
  .action(async (file: string, opts: { registry: string; agentId?: string }) => {
    let spec: unknown;
    try {
      spec = JSON.parse(readFileSync(resolve(file), 'utf-8'));
    } catch {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      process.exit(1);
    }

    if (!opts.agentId) {
      console.error(pc.red('✗ --agent-id is required'));
      process.exit(1);
    }

    console.log(pc.dim(`Publishing to ${opts.registry}...`));

    let res: Response;
    try {
      res = await fetch(`${opts.registry}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-ID': opts.agentId,
        },
        body: JSON.stringify(spec),
      });
    } catch (err) {
      console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
      process.exit(1);
    }

    const data = await res.json() as { agent?: { id: string }; error?: string; errors?: string[] };

    if (res.ok && data.agent) {
      console.log(pc.green(`✓ Published: ${data.agent.id}`));
      console.log(pc.dim(`  ${opts.registry}/agents/${data.agent.id}`));
    } else {
      console.error(pc.red(`✗ Publish failed: ${data.error ?? 'Unknown error'}`));
      if (data.errors) {
        for (const e of data.errors) console.error(pc.red(`  ${e}`));
      }
      process.exit(1);
    }
  });

// ── verify ────────────────────────────────────────────────────────────────────
program
  .command('verify <agent-id> <skill-id>')
  .description('Trigger a validation run for an agent skill')
  .option('-r, --registry <url>', 'Registry URL', 'https://agentspec.dev')
  .action(async (agentId: string, skillId: string, opts: { registry: string }) => {
    console.log(pc.dim(`Running validation for ${agentId} / ${skillId}...`));

    let res: Response;
    try {
      res = await fetch(`${opts.registry}/api/agents/${agentId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
    } catch (err) {
      console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
      process.exit(1);
    }

    if (!res.ok) {
      console.error(pc.red(`✗ Registry returned HTTP ${res.status}`));
      process.exit(1);
    }

    const data = await res.json() as {
      status: string;
      attestationHash?: string;
      error?: string;
      results?: Array<{ testId: string; passed: boolean; durationMs: number; error?: string }>;
    };

    if (data.status === 'PASSED') {
      console.log(pc.green(`✓ Validation PASSED`));
      console.log(pc.dim(`  Attestation: ${data.attestationHash}`));
    } else {
      console.error(pc.red(`✗ Validation ${data.status}`));
      if (data.error) console.error(pc.red(`  ${data.error}`));
      if (data.results) {
        for (const r of data.results) {
          const icon = r.passed ? pc.green('✓') : pc.red('✗');
          console.log(`  ${icon} ${r.testId} (${r.durationMs}ms)${r.error ? ` — ${r.error}` : ''}`);
        }
      }
      process.exit(1);
    }
  });

// ── conformance ───────────────────────────────────────────────────────────────
program
  .command('conformance')
  .description('Run conformance test suite against a validator endpoint')
  .option('-r, --registry <url>', 'Registry URL', 'https://agentspec.dev')
  .action(async (opts: { registry: string }) => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    const validate = ajv.compile(bundledSchema as object);
    const conformanceDir = join(__dirname, '../../conformance');

    let passed = 0;
    let failed = 0;

    // Valid cases — must accept
    const validDir = join(conformanceDir, 'valid');
    for (const file of readdirSync(validDir).filter(f => f.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(validDir, file), 'utf-8'));
      const ok = validate(doc);
      if (ok) {
        console.log(pc.green(`✓ valid/${file}`));
        passed++;
      } else {
        console.error(pc.red(`✗ valid/${file} — should be valid but got errors:`));
        for (const e of validate.errors ?? []) console.error(pc.red(`    ${e.instancePath} ${e.message}`));
        failed++;
      }
    }

    // Invalid cases — must reject
    const invalidDir = join(conformanceDir, 'invalid');
    for (const file of readdirSync(invalidDir).filter(f => f.endsWith('.json'))) {
      const doc = JSON.parse(readFileSync(join(invalidDir, file), 'utf-8'));
      const ok = validate(doc);
      if (!ok) {
        console.log(pc.green(`✓ invalid/${file} — correctly rejected`));
        passed++;
      } else {
        console.error(pc.red(`✗ invalid/${file} — should be invalid but was accepted`));
        failed++;
      }
    }

    console.log('');
    console.log(`${pc.green(`${passed} passed`)}  ${failed > 0 ? pc.red(`${failed} failed`) : pc.dim('0 failed')}`);
    if (failed > 0) process.exit(1);
  });

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Generate a skeleton AgentSpec JSON file')
  .option('-o, --out <file>', 'Output file', 'agentspec.json')
  .action((opts: { out: string }) => {
    const skeleton = {
      specVersion: '1.0.0',
      id: 'urn:agent:your-org:your-agent',
      name: 'Your Agent Name',
      version: '1.0.0',
      description: 'Describe what your agent does.',
      provider: {
        name: 'Your Organization',
        url: 'https://your-org.example',
        contact: 'hello@your-org.example',
      },
      endpoint: {
        url: 'https://api.your-org.example/agent',
        auth: { type: 'bearer' },
      },
      skills: [
        {
          id: 'your-skill',
          name: 'Your Skill',
          description: 'Describe what this skill does.',
          inputSchema: {
            type: 'object',
            required: ['input'],
            properties: { input: { type: 'string' } },
          },
          outputSchema: {
            type: 'object',
            required: ['output'],
            properties: { output: { type: 'string' } },
          },
          pricing: { model: 'free', amount: 0, currency: 'USD' },
        },
      ],
      tags: [],
    };

    writeFileSync(resolve(opts.out), JSON.stringify(skeleton, null, 2));
    console.log(pc.green(`✓ Created ${opts.out}`));
    console.log(pc.dim('Edit the file, then run: agentspec validate ' + opts.out));
  });

// ── convert ───────────────────────────────────────────────────────────────────
program
  .command('convert <format> <file>')
  .description('Convert an OpenAPI or MCP document to AgentSpec (formats: openapi, mcp)')
  .option('-o, --out <file>', 'Output file (default: agentspec.json)')
  .action((format: string, file: string, opts: { out?: string }) => {
    if (format !== 'openapi' && format !== 'mcp') {
      console.error(pc.red(`✗ Unknown format: ${format}. Supported: openapi, mcp`));
      process.exit(1);
    }

    let source: Record<string, unknown>;
    try {
      source = JSON.parse(readFileSync(resolve(file), 'utf-8'));
    } catch {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      process.exit(1);
    }

    if (format === 'openapi') {
      const result = convertOpenApi(source);
      const outFile = opts.out ?? 'agentspec.json';
      writeFileSync(resolve(outFile), JSON.stringify(result.spec, null, 2));
      console.log(pc.green(`✓ Converted to ${outFile}`));
      if (result.warnings.length > 0) {
        console.log(pc.yellow('\nWarnings (review before publishing):'));
        for (const w of result.warnings) console.log(pc.yellow(`  ! ${w}`));
      }
      console.log(pc.dim(`\nNext: agentspec validate ${outFile}`));
    } else {
      const result = convertMcp(source);
      const outFile = opts.out ?? 'agentspec.json';
      writeFileSync(resolve(outFile), JSON.stringify(result.spec, null, 2));
      console.log(pc.green(`✓ Converted to ${outFile}`));
      if (result.warnings.length > 0) {
        console.log(pc.yellow('\nWarnings (review before publishing):'));
        for (const w of result.warnings) console.log(pc.yellow(`  ! ${w}`));
      }
      console.log(pc.dim(`\nNext: agentspec validate ${outFile}`));
    }
  });

// ─── OpenAPI 3.x → AgentSpec converter ───────────────────────────────────────

interface ConvertResult {
  spec: Record<string, unknown>;
  warnings: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function toSemver(v: string): string {
  const parts = v.replace(/^v/, '').split('.');
  while (parts.length < 3) parts.push('0');
  const clean = parts.slice(0, 3).map((p) => p.replace(/[^0-9]/g, '') || '0');
  return clean.join('.');
}

function convertOpenApi(doc: Record<string, unknown>): ConvertResult {
  const warnings: string[] = [];

  const info = (doc.info ?? {}) as Record<string, unknown>;
  const rawTitle = (info.title as string | undefined) ?? 'My Agent';
  const rawVersion = (info.version as string | undefined) ?? '1.0.0';
  const description = (info.description as string | undefined) ?? '';

  const servers = (doc.servers as Array<Record<string, unknown>> | undefined) ?? [];
  const endpointUrl = (servers[0]?.url as string | undefined) ?? 'https://api.example.com';
  if (!servers[0]?.url) warnings.push('No servers[0].url found — set endpoint.url manually');

  const titleSlug = slugify(rawTitle);
  const providerSlug = titleSlug.split('-')[0] ?? 'provider';
  const agentSlug = titleSlug || 'agent';
  const specId = `urn:agent:${providerSlug}:${agentSlug}`;

  const paths = (doc.paths ?? {}) as Record<string, Record<string, unknown>>;
  const skills: Record<string, unknown>[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const op = operation as Record<string, unknown>;

      const operationId = op.operationId as string | undefined;
      const rawSkillId = operationId ? slugify(operationId) : slugify(`${method}-${path}`);
      const skillId = rawSkillId.replace(/^[^a-z]/, 's') || 'skill';

      const skillName = (op.summary as string | undefined) ?? operationId ?? `${method.toUpperCase()} ${path}`;
      const skillDescription = (op.description as string | undefined) ?? skillName;

      // Input schema from requestBody
      let inputSchema: Record<string, unknown> = { type: 'object' };
      const requestBody = op.requestBody as Record<string, unknown> | undefined;
      if (requestBody) {
        const content = requestBody.content as Record<string, unknown> | undefined;
        const jsonContent = (content?.['application/json'] ?? content?.['application/json; charset=utf-8']) as Record<string, unknown> | undefined;
        if (jsonContent?.schema) {
          inputSchema = jsonContent.schema as Record<string, unknown>;
        } else {
          warnings.push(`${method.toUpperCase()} ${path}: No application/json requestBody — using empty inputSchema`);
        }
      } else if (method === 'get') {
        // GET: parameters as input schema
        const params = (op.parameters as Array<Record<string, unknown>> | undefined) ?? [];
        if (params.length > 0) {
          inputSchema = {
            type: 'object',
            properties: Object.fromEntries(
              params.map((p) => [p.name, (p.schema as Record<string, unknown>) ?? { type: 'string' }])
            ),
          };
        }
      }

      // Output schema from 200 response
      let outputSchema: Record<string, unknown> = { type: 'object' };
      const responses = (op.responses ?? {}) as Record<string, unknown>;
      const ok = (responses['200'] ?? responses['201']) as Record<string, unknown> | undefined;
      if (ok) {
        const content = ok.content as Record<string, unknown> | undefined;
        const jsonContent = content?.['application/json'] as Record<string, unknown> | undefined;
        if (jsonContent?.schema) {
          outputSchema = jsonContent.schema as Record<string, unknown>;
        } else {
          warnings.push(`${method.toUpperCase()} ${path}: No 200 application/json response schema — using empty outputSchema`);
        }
      } else {
        warnings.push(`${method.toUpperCase()} ${path}: No 200/201 response defined — using empty outputSchema`);
      }

      skills.push({
        id: skillId,
        name: skillName,
        description: skillDescription,
        inputSchema,
        outputSchema,
        pricing: { model: 'free', amount: 0, currency: 'USD' },
      });
    }
  }

  if (skills.length === 0) {
    warnings.push('No paths found in OpenAPI doc — add at least one skill manually');
    skills.push({
      id: 'default',
      name: 'Default',
      description: 'Add a description for this skill',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      pricing: { model: 'free', amount: 0, currency: 'USD' },
    });
  }

  const spec = {
    specVersion: '1.0.0',
    id: specId,
    name: rawTitle,
    version: toSemver(rawVersion),
    description: description || undefined,
    provider: {
      name: rawTitle,
      url: endpointUrl.startsWith('http') ? new URL(endpointUrl).origin : undefined,
    },
    endpoint: { url: endpointUrl },
    skills,
    tags: [],
  };

  return { spec, warnings };
}

// ─── MCP tool manifest → AgentSpec converter ─────────────────────────────────

function convertMcp(doc: Record<string, unknown>): ConvertResult {
  const warnings: string[] = [];

  // MCP server manifests vary — handle both the tools list format and server info format
  const serverName = (doc.name as string | undefined) ?? (doc.serverName as string | undefined) ?? 'MCP Agent';
  const serverVersion = toSemver((doc.version as string | undefined) ?? '1.0.0');
  const serverUrl = (doc.url as string | undefined) ?? (doc.endpoint as string | undefined) ?? 'https://api.example.com';

  if (!doc.url && !doc.endpoint) {
    warnings.push('No url/endpoint in MCP manifest — set endpoint.url manually');
  }

  const tools = (doc.tools as Array<Record<string, unknown>> | undefined) ?? [];
  if (tools.length === 0) warnings.push('No tools found in MCP manifest — add skills manually');

  const titleSlug = slugify(serverName);
  const providerSlug = titleSlug.split('-')[0] ?? 'provider';
  const agentSlug = titleSlug || 'agent';

  const skills: Record<string, unknown>[] = tools.map((tool) => {
    const toolName = (tool.name as string | undefined) ?? 'tool';
    const inputSchema = (tool.inputSchema as Record<string, unknown> | undefined) ??
      (tool.parameters as Record<string, unknown> | undefined) ??
      { type: 'object' };

    return {
      id: slugify(toolName) || 'tool',
      name: toolName,
      description: (tool.description as string | undefined) ?? toolName,
      inputSchema,
      outputSchema: { type: 'object', description: 'MCP tool output — define outputSchema manually' },
      pricing: { model: 'free', amount: 0, currency: 'USD' },
    };
  });

  if (skills.length === 0) {
    skills.push({
      id: 'default',
      name: 'Default',
      description: 'Add a description for this skill',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      pricing: { model: 'free', amount: 0, currency: 'USD' },
    });
  }

  const spec = {
    specVersion: '1.0.0',
    id: `urn:agent:${providerSlug}:${agentSlug}`,
    name: serverName,
    version: serverVersion,
    provider: { name: serverName, url: serverUrl.startsWith('http') ? new URL(serverUrl).origin : undefined },
    endpoint: { url: serverUrl },
    skills,
    tags: [],
  };

  warnings.push('MCP outputSchema is not defined in the protocol — review each skill\'s outputSchema before publishing');

  return { spec, warnings };
}

program.parse();
