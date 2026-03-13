#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

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

    let schema: unknown;
    try {
      // Try local schema first, then fetch from registry
      const localSchema = join(__dirname, '../../src/lib/schema/agent-spec.v1.json');
      schema = JSON.parse(readFileSync(localSchema, 'utf-8'));
    } catch {
      console.log(pc.dim('Fetching schema from registry...'));
      const res = await fetch('https://agentspec.dev/api/spec/v1');
      schema = await res.json();
    }

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

    let schema: unknown;
    try {
      const res = await fetch(`${opts.registry}/api/spec/v1`);
      schema = await res.json();
    } catch {
      console.error(pc.red('✗ Could not fetch schema'));
      process.exit(1);
    }

    const validate = ajv.compile(schema as object);
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

program.parse();
