#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
// Bundled schema — always available regardless of install location
import bundledSchema from './schema.json';

// ── Types used by the test runner ─────────────────────────────────────────────
interface TestCase {
  id: string;
  description?: string;
  request: { method?: string; headers?: Record<string, string>; body?: unknown };
  expect: { status: number; outputSchema?: Record<string, unknown> };
  timeoutMs?: number;
}

interface TestSuiteFile {
  version: string;
  skill: string;
  tests: TestCase[];
}

const program = new Command();

program
  .name('pactspec')
  .description('Official CLI for the PactSpec protocol')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  .version((require('../package.json') as { version: string }).version);

function parseSourceFile(file: string): Record<string, unknown> {
  const raw = readFileSync(resolve(file), 'utf-8');
  const ext = extname(file).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    const doc = parseYaml(raw);
    if (!doc || typeof doc !== 'object') {
      throw new Error('YAML did not parse to an object');
    }
    return doc as Record<string, unknown>;
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ── validate ─────────────────────────────────────────────────────────────────
program
  .command('validate <file>')
  .description('Validate a PactSpec JSON file against the v1 schema')
  .action(async (file: string) => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    let spec: unknown;
    try {
      spec = parseSourceFile(file);
    } catch {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      process.exit(1);
    }

    const schema: unknown = bundledSchema;

    const validate = ajv.compile(schema as object);
    const valid = validate(spec);

    if (valid) {
      console.log(pc.green('✓ Valid PactSpec document'));
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
  .description('Publish a PactSpec JSON file to the registry')
  .option('-r, --registry <url>', 'Registry URL', 'https://pactspec.dev')
  .option('-k, --agent-id <id>', 'Your agent identifier (X-Agent-ID header)')
  .option('-t, --publish-token <token>', 'Publish token (X-Publish-Token header)')
  .action(async (file: string, opts: { registry: string; agentId?: string; publishToken?: string }) => {
    let spec: unknown;
    try {
      spec = parseSourceFile(file);
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Agent-ID': opts.agentId,
      };
      if (opts.publishToken) headers['X-Publish-Token'] = opts.publishToken;
      res = await fetch(`${opts.registry}/api/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(spec),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
      process.exit(1);
    }

    const text = await res.text();
    let data: { agent?: { id: string; spec_id?: string }; error?: string; errors?: string[] } = {};
    try { data = JSON.parse(text); } catch { /* non-JSON response */ }

    if (res.ok && data.agent) {
      const displayId = data.agent.spec_id ?? data.agent.id;
      console.log(pc.green(`✓ Published: ${displayId}`));
      console.log(pc.dim(`  ${opts.registry}/agents/${data.agent.id}`));
    } else {
      console.error(pc.red(`✗ Publish failed: ${data.error ?? 'Unknown error'}`));
      if (data.errors) {
        for (const e of data.errors) console.error(pc.red(`  ${e}`));
      }
      process.exit(1);
    }
  });

// ── bulk-publish ─────────────────────────────────────────────────────────────
function collectSpecFiles(dir: string, recursive: boolean): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    if (recursive && statSync(full).isDirectory()) {
      results.push(...collectSpecFiles(full, true));
    } else if (
      entry.endsWith('.pactspec.json') ||
      entry.endsWith('.pactspec.yaml')
    ) {
      results.push(full);
    }
  }
  return results;
}

interface BulkResult {
  file: string;
  specId: string | undefined;
  status: 'published' | 'failed' | 'skipped';
  error?: string;
}

program
  .command('bulk-publish <dir>')
  .description('Publish all *.pactspec.json / *.pactspec.yaml files in a directory')
  .option('-r, --recursive', 'Search subdirectories recursively')
  .option('-k, --agent-id <id>', 'Your agent identifier (X-Agent-ID header)')
  .option('-t, --publish-token <token>', 'Publish token (X-Publish-Token header)')
  .option('--registry <url>', 'Registry URL', 'https://pactspec.dev')
  .option('--dry-run', 'Validate all specs but do not publish')
  .option('--continue-on-error', 'Do not stop on first failure')
  .action(async (dir: string, opts: {
    recursive?: boolean;
    agentId?: string;
    publishToken?: string;
    registry: string;
    dryRun?: boolean;
    continueOnError?: boolean;
  }) => {
    if (!opts.agentId) {
      console.error(pc.red('✗ --agent-id is required'));
      process.exit(1);
    }

    const resolvedDir = resolve(dir);
    if (!existsSync(resolvedDir) || !statSync(resolvedDir).isDirectory()) {
      console.error(pc.red(`✗ Not a directory: ${dir}`));
      process.exit(1);
    }

    const files = collectSpecFiles(resolvedDir, !!opts.recursive);
    if (files.length === 0) {
      console.error(pc.red(`✗ No *.pactspec.json or *.pactspec.yaml files found in ${dir}`));
      process.exit(1);
    }

    console.log(pc.bold(`Publishing ${files.length} spec${files.length === 1 ? '' : 's'} from ${dir}...\n`));

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateFn = ajv.compile(bundledSchema as object);

    const results: BulkResult[] = [];
    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of files) {
      const relPath = file.startsWith(resolvedDir)
        ? file.slice(resolvedDir.length + 1)
        : file;

      // 1. Parse
      let spec: Record<string, unknown>;
      try {
        spec = parseSourceFile(file);
      } catch (err) {
        const msg = `Parse error: ${(err as Error).message}`;
        console.log(`  ${pc.red('✗')} ${relPath} → ${pc.red(msg)}`);
        results.push({ file: relPath, specId: undefined, status: 'failed', error: msg });
        failed++;
        if (!opts.continueOnError) break;
        continue;
      }

      const specId = (spec.id as string | undefined) ?? '(no id)';

      // 2. Validate
      const valid = validateFn(spec);
      if (!valid) {
        const msgs = (validateFn.errors ?? [])
          .map((e) => `${e.instancePath || '/'} ${e.message}`)
          .join('; ');
        const msg = `Validation failed: ${msgs}`;
        console.log(`  ${pc.red('✗')} ${relPath} → ${pc.red(msg)}`);
        results.push({ file: relPath, specId, status: 'failed', error: msg });
        failed++;
        if (!opts.continueOnError) break;
        continue;
      }

      // 3. Dry-run: skip publishing
      if (opts.dryRun) {
        console.log(`  ${pc.green('✓')} ${relPath} → ${specId} ${pc.dim('(dry-run)')}`);
        results.push({ file: relPath, specId, status: 'skipped' });
        skipped++;
        continue;
      }

      // 4. Publish
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Agent-ID': opts.agentId,
        };
        if (opts.publishToken) headers['X-Publish-Token'] = opts.publishToken;

        const res = await fetch(`${opts.registry}/api/agents`, {
          method: 'POST',
          headers,
          body: JSON.stringify(spec),
          signal: AbortSignal.timeout(30_000),
        });

        const text = await res.text();
        let data: { agent?: { id: string; spec_id?: string }; error?: string; errors?: string[] } = {};
        try { data = JSON.parse(text); } catch { /* non-JSON */ }

        if (res.ok && data.agent) {
          const displayId = data.agent.spec_id ?? data.agent.id;
          console.log(`  ${pc.green('✓')} ${relPath} → ${displayId}`);
          results.push({ file: relPath, specId: displayId, status: 'published' });
          published++;
        } else {
          const msg = data.error ?? 'Unknown error';
          console.log(`  ${pc.red('✗')} ${relPath} → ${pc.red(msg)}`);
          results.push({ file: relPath, specId, status: 'failed', error: msg });
          failed++;
          if (!opts.continueOnError) break;
        }
      } catch (err) {
        const msg = `Network error: ${(err as Error).message}`;
        console.log(`  ${pc.red('✗')} ${relPath} → ${pc.red(msg)}`);
        results.push({ file: relPath, specId, status: 'failed', error: msg });
        failed++;
        if (!opts.continueOnError) break;
      }
    }

    console.log('');
    const parts: string[] = [];
    if (published > 0 || !opts.dryRun) parts.push(pc.green(`Published: ${published}`));
    parts.push(failed > 0 ? pc.red(`Failed: ${failed}`) : pc.dim(`Failed: ${failed}`));
    if (skipped > 0) parts.push(pc.dim(`Skipped: ${skipped}`));
    console.log(parts.join('  '));

    if (failed > 0) process.exit(1);
  });

// ── verify ────────────────────────────────────────────────────────────────────
program
  .command('verify <agent-id> <skill-id>')
  .description('Trigger a validation run for an agent skill')
  .option('-r, --registry <url>', 'Registry URL', 'https://pactspec.dev')
  .action(async (agentId: string, skillId: string, opts: { registry: string }) => {
    console.log(pc.dim(`Running validation for ${agentId} / ${skillId}...`));

    let res: Response;
    try {
      res = await fetch(`${opts.registry}/api/agents/${agentId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
      process.exit(1);
    }

    if (!res.ok) {
      console.error(pc.red(`✗ Registry returned HTTP ${res.status}`));
      process.exit(1);
    }

    let data: {
      status: string;
      attestationHash?: string;
      error?: string;
      results?: Array<{ testId: string; passed: boolean; durationMs: number; error?: string }>;
    };
    try {
      data = await res.json();
    } catch {
      console.error(pc.red('✗ Invalid response from registry'));
      process.exit(1);
    }

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

// ── price ────────────────────────────────────────────────────────────────────
const VALID_PRICING_MODELS = ['free', 'per-invocation', 'per-token', 'per-second'] as const;
const VALID_CURRENCIES = ['USD', 'USDC', 'SOL'] as const;
const VALID_PROTOCOLS = ['stripe', 'x402', 'none'] as const;

program
  .command('price <file>')
  .description('Update pricing for a skill in a PactSpec file')
  .requiredOption('-s, --skill <id>', 'Skill ID to update')
  .requiredOption('-m, --model <model>', 'Pricing model: free, per-invocation, per-token, per-second')
  .option('-a, --amount <n>', 'Price amount (required for paid models)', parseFloat)
  .option('-c, --currency <c>', 'Currency: USD, USDC, SOL', 'USD')
  .option('-p, --protocol <p>', 'Payment protocol: stripe, x402, none')
  .option('--publish', 'Publish updated spec to registry after updating')
  .option('-k, --agent-id <id>', 'Your agent identifier (for --publish)')
  .option('-t, --publish-token <token>', 'Publish token (for --publish)')
  .option('-r, --registry <url>', 'Registry URL', 'https://pactspec.dev')
  .action(async (file: string, opts: {
    skill: string;
    model: string;
    amount?: number;
    currency: string;
    protocol?: string;
    publish?: boolean;
    agentId?: string;
    publishToken?: string;
    registry: string;
  }) => {
    // 1. Validate model
    if (!(VALID_PRICING_MODELS as readonly string[]).includes(opts.model)) {
      console.error(pc.red(`✗ Invalid pricing model: ${opts.model}`));
      console.error(pc.dim(`  Valid models: ${VALID_PRICING_MODELS.join(', ')}`));
      process.exit(1);
    }

    // 2. Validate currency
    const currency = opts.currency.toUpperCase();
    if (!(VALID_CURRENCIES as readonly string[]).includes(currency)) {
      console.error(pc.red(`✗ Invalid currency: ${opts.currency}`));
      console.error(pc.dim(`  Valid currencies: ${VALID_CURRENCIES.join(', ')}`));
      process.exit(1);
    }

    // 3. Validate protocol
    if (opts.protocol && !(VALID_PROTOCOLS as readonly string[]).includes(opts.protocol)) {
      console.error(pc.red(`✗ Invalid protocol: ${opts.protocol}`));
      console.error(pc.dim(`  Valid protocols: ${VALID_PROTOCOLS.join(', ')}`));
      process.exit(1);
    }

    // 4. Validate amount for paid models
    if (opts.model !== 'free') {
      if (opts.amount === undefined || isNaN(opts.amount)) {
        console.error(pc.red(`✗ --amount is required for paid model "${opts.model}"`));
        process.exit(1);
      }
      if (opts.amount <= 0) {
        console.error(pc.red(`✗ Amount must be positive, got ${opts.amount}`));
        process.exit(1);
      }
    }

    // 5. Read and parse spec
    let spec: Record<string, unknown>;
    try {
      spec = parseSourceFile(file);
    } catch {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      process.exit(1);
    }

    // 6. Find skill
    const skills = (spec.skills as Array<Record<string, unknown>> | undefined) ?? [];
    const skill = skills.find((s) => s.id === opts.skill);
    if (!skill) {
      console.error(pc.red(`✗ Skill "${opts.skill}" not found in spec`));
      console.error(pc.dim(`  Available skills: ${skills.map((s) => s.id).join(', ')}`));
      process.exit(1);
    }

    // 7. Build pricing object
    const pricing: Record<string, unknown> = {
      model: opts.model,
      amount: opts.model === 'free' ? 0 : opts.amount,
      currency,
    };
    if (opts.model !== 'free' && opts.protocol && opts.protocol !== 'none') {
      pricing.paymentProtocol = opts.protocol;
    }

    // 8. Update skill pricing
    skill.pricing = pricing;

    // 9. Write back to file
    const ext = extname(file).toLowerCase();
    const filePath = resolve(file);
    if (ext === '.yaml' || ext === '.yml') {
      writeFileSync(filePath, stringifyYaml(spec));
    } else {
      writeFileSync(filePath, JSON.stringify(spec, null, 2));
    }

    // 10. Validate against schema
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateFn = ajv.compile(bundledSchema as object);
    if (!validateFn(spec)) {
      console.log(pc.yellow('  Spec has validation issues:'));
      for (const e of (validateFn.errors ?? [])) {
        console.log(pc.yellow(`    ! ${e.instancePath || '/'} ${e.message}`));
      }
    }

    // 11. Print summary
    const amount = opts.model === 'free' ? 0 : opts.amount;
    const protocolSuffix = (opts.model !== 'free' && opts.protocol && opts.protocol !== 'none')
      ? ` via ${opts.protocol}`
      : '';
    console.log(pc.green(`✓ Updated pricing for skill ${opts.skill}: ${opts.model} ${amount} ${currency}${protocolSuffix}`));

    // 12. Publish if requested
    if (opts.publish) {
      if (!opts.agentId) {
        console.error(pc.red('✗ --publish requires --agent-id'));
        process.exit(1);
      }
      console.log(pc.dim(`Publishing to ${opts.registry}...`));
      let res: Response;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Agent-ID': opts.agentId,
        };
        if (opts.publishToken) headers['X-Publish-Token'] = opts.publishToken;
        res = await fetch(`${opts.registry}/api/agents`, {
          method: 'POST',
          headers,
          body: JSON.stringify(spec),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
        process.exit(1);
      }
      const text = await res.text();
      let data: { agent?: { id: string; spec_id?: string }; error?: string; errors?: string[] } = {};
      try { data = JSON.parse(text); } catch { /* non-JSON */ }
      if (res.ok && data.agent) {
        const displayId = data.agent.spec_id ?? data.agent.id;
        console.log(pc.green(`✓ Published: ${displayId}`));
        console.log(pc.dim(`  ${opts.registry}/agents/${data.agent.id}`));
      } else {
        console.error(pc.red(`✗ Publish failed: ${data.error ?? 'Unknown error'}`));
        if (data.errors) {
          for (const e of data.errors) console.error(pc.red(`  ${e}`));
        }
        process.exit(1);
      }
    }
  });

// ── conformance ───────────────────────────────────────────────────────────────
program
  .command('conformance')
  .description('Run conformance test suite against a validator endpoint')
  .option('-r, --registry <url>', 'Registry URL', 'https://pactspec.dev')
  .action(async (opts: { registry: string }) => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    const validate = ajv.compile(bundledSchema as object);
    const conformanceDir = join(__dirname, '../../conformance');

    if (!existsSync(conformanceDir)) {
      console.error(pc.red('✗ Conformance suite not found'));
      console.error(pc.dim(`  Expected at: ${conformanceDir}`));
      console.error(pc.dim('  This command is intended for development — run it from the pactspec repo root.'));
      process.exit(1);
    }

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

async function runInteractiveInit(outFile: string): Promise<void> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const ask = async (question: string, defaultValue: string): Promise<string> => {
    const answer = await rl.question(`${question} ${pc.dim(`(${defaultValue})`)}: `);
    return answer.trim() || defaultValue;
  };

  const choose = async (question: string, options: string[], defaultValue: string): Promise<string> => {
    const answer = await rl.question(`${question} ${pc.dim(`[${options.join('/')}]`)} ${pc.dim(`(${defaultValue})`)}: `);
    const trimmed = answer.trim().toLowerCase();
    if (trimmed && options.map(o => o.toLowerCase()).includes(trimmed)) return trimmed;
    if (!trimmed) return defaultValue;
    console.log(pc.yellow(`  Invalid choice. Using default: ${defaultValue}`));
    return defaultValue;
  };

  try {
    console.log(pc.bold('\nPactSpec Init — Interactive Setup\n'));

    const agentName = await ask('Agent name', 'Your Agent Name');
    const providerName = await ask('Provider / organization name', 'Your Organization');
    const endpointUrl = await ask('Endpoint URL', 'https://api.your-org.example/agent');

    const pricingType = await choose('Will this agent be free or paid?', ['free', 'paid'], 'free');

    let pricingModel = 'free';
    let pricingAmount = 0;
    let pricingCurrency = 'USD';
    let paymentProtocol: string | undefined;

    if (pricingType === 'paid') {
      pricingModel = await choose('Pricing model', ['per-invocation', 'per-token', 'per-second'], 'per-invocation');
      const amountStr = await ask('Price amount', '0.01');
      pricingAmount = parseFloat(amountStr);
      if (isNaN(pricingAmount) || pricingAmount < 0) {
        console.log(pc.yellow('  Invalid amount. Using 0.01'));
        pricingAmount = 0.01;
      }
      pricingCurrency = (await choose('Currency', ['USD', 'USDC', 'SOL'], 'USD')).toUpperCase();
      paymentProtocol = await choose('Payment protocol', ['stripe', 'x402', 'none'], 'none');
      if (paymentProtocol === 'none') paymentProtocol = undefined;
    }

    rl.close();

    const providerSlug = slugify(providerName).split('-')[0] || 'your-org';
    const agentSlug = slugify(agentName) || 'your-agent';
    const providerOrigin = endpointUrl.startsWith('http')
      ? (() => { try { return new URL(endpointUrl).origin; } catch { return 'https://your-org.example'; } })()
      : 'https://your-org.example';

    const pricing: Record<string, unknown> = { model: pricingModel, amount: pricingAmount, currency: pricingCurrency };
    if (paymentProtocol) pricing.paymentProtocol = paymentProtocol;

    const skeleton = {
      specVersion: '1.0.0',
      id: `urn:pactspec:${providerSlug}:${agentSlug}`,
      name: agentName,
      version: '1.0.0',
      description: 'Describe what your agent does.',
      provider: {
        name: providerName,
        url: providerOrigin,
        contact: `hello@${providerSlug}.example`,
      },
      endpoint: {
        url: endpointUrl,
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
          pricing,
        },
      ],
      tags: [],
    };

    writeFileSync(resolve(outFile), JSON.stringify(skeleton, null, 2));
    console.log('');
    console.log(pc.green(`✓ Created ${outFile}`));
    console.log(pc.dim('Edit the file, then run: pactspec validate ' + outFile));
  } catch {
    rl.close();
    console.error(pc.red('\n✗ Interactive setup cancelled'));
    process.exit(1);
  }
}

program
  .command('init')
  .description('Generate a skeleton PactSpec JSON file')
  .option('-o, --out <file>', 'Output file', 'pactspec.json')
  .option('-i, --interactive', 'Interactive setup with pricing configuration')
  .action(async (opts: { out: string; interactive?: boolean }) => {
    if (opts.interactive) {
      await runInteractiveInit(opts.out);
      return;
    }

    const skeleton = {
      specVersion: '1.0.0',
      id: 'urn:pactspec:your-org:your-agent',
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
    console.log(pc.dim('Edit the file, then run: pactspec validate ' + opts.out));
    console.log(pc.dim('\n  Tip: run pactspec init -i for interactive setup with pricing'));
  });

// ── test ──────────────────────────────────────────────────────────────────────
program
  .command('test <file>')
  .description('Run a skill\'s test suite locally against the agent endpoint')
  .option('-s, --skill <id>', 'Skill ID to test (defaults to first skill with a testSuite)')
  .option('-e, --endpoint <url>', 'Override the endpoint URL from the spec')
  .option('--suite <file>', 'Load test suite from a local file instead of the URL in the spec')
  .option('-t, --timeout <ms>', 'Per-test timeout in milliseconds', '10000')
  .action(async (file: string, opts: { skill?: string; endpoint?: string; suite?: string; timeout: string }) => {
    const timeoutMs = parseInt(opts.timeout, 10) || 10000;

    // 1. Load and parse spec
    let spec: Record<string, unknown>;
    try {
      spec = parseSourceFile(file);
    } catch {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      process.exit(1);
    }

    const skills = (spec.skills as Array<Record<string, unknown>> | undefined) ?? [];

    // 2. Find target skill
    let skill: Record<string, unknown> | undefined;
    if (opts.skill) {
      skill = skills.find((s) => s.id === opts.skill);
      if (!skill) {
        console.error(pc.red(`✗ Skill "${opts.skill}" not found in spec`));
        console.error(pc.dim(`  Available skills: ${skills.map((s) => s.id).join(', ')}`));
        process.exit(1);
      }
    } else {
      skill = skills.find((s) => (s.testSuite as Record<string, unknown> | undefined)?.url);
      if (!skill) {
        console.error(pc.red('✗ No skill with a testSuite.url found in spec'));
        console.error(pc.dim('  Add a testSuite.url to a skill, or pass --skill and --suite'));
        process.exit(1);
      }
    }

    // 3. Load test suite
    let suite: TestSuiteFile;
    if (opts.suite) {
      try {
        suite = parseSourceFile(opts.suite) as unknown as TestSuiteFile;
      } catch {
        console.error(pc.red(`✗ Could not read test suite file: ${opts.suite}`));
        process.exit(1);
      }
    } else {
      const suiteUrl = ((skill.testSuite as Record<string, unknown>)?.url as string | undefined);
      if (!suiteUrl) {
        console.error(pc.red('✗ No testSuite.url on skill — use --suite <file> to provide one locally'));
        process.exit(1);
      }
      console.log(pc.dim(`Fetching test suite from ${suiteUrl}...`));
      try {
        const res = await fetch(suiteUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        suite = await res.json() as TestSuiteFile;
      } catch (err) {
        console.error(pc.red(`✗ Could not fetch test suite: ${(err as Error).message}`));
        process.exit(1);
      }
    }

    if (!Array.isArray(suite.tests) || suite.tests.length === 0) {
      console.error(pc.red('✗ Test suite has no tests'));
      process.exit(1);
    }

    // 4. Determine endpoint URL
    const endpointUrl = opts.endpoint ??
      ((spec.endpoint as Record<string, unknown>)?.url as string | undefined);
    if (!endpointUrl) {
      console.error(pc.red('✗ No endpoint URL — pass --endpoint <url> or set endpoint.url in spec'));
      process.exit(1);
    }

    const skillId = skill.id as string;
    console.log('');
    console.log(`${pc.bold('Running')} ${suite.tests.length} test${suite.tests.length > 1 ? 's' : ''} for skill ${pc.cyan(skillId)}`);
    console.log(pc.dim(`Endpoint: ${endpointUrl}`));
    console.log('');

    // 5. Run tests
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    let passed = 0;
    let failed = 0;

    for (const test of suite.tests) {
      const start = Date.now();
      let statusCode: number | undefined;
      let body: unknown;
      let err: string | undefined;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(endpointUrl, {
          method: test.request.method ?? 'POST',
          headers: { 'Content-Type': 'application/json', ...(test.request.headers ?? {}) },
          body: test.request.body != null ? JSON.stringify(test.request.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);
        statusCode = res.status;
        try { body = await res.json(); } catch { body = null; }
      } catch (e) {
        err = (e as Error).name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : (e as Error).message;
      }

      const durationMs = Date.now() - start;

      if (err) {
        console.log(`  ${pc.red('✗')} ${test.id} ${pc.dim(`(${durationMs}ms)`)} — ${pc.red(err)}`);
        failed++;
        continue;
      }

      // Check status
      if (statusCode !== test.expect.status) {
        console.log(`  ${pc.red('✗')} ${test.id} ${pc.dim(`(${durationMs}ms)`)} — expected status ${test.expect.status}, got ${statusCode}`);
        failed++;
        continue;
      }

      // Check outputSchema if present
      if (test.expect.outputSchema && body !== null) {
        const validate = ajv.compile(test.expect.outputSchema);
        const valid = validate(body);
        if (!valid) {
          const msgs = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
          console.log(`  ${pc.red('✗')} ${test.id} ${pc.dim(`(${durationMs}ms)`)} — schema: ${msgs}`);
          failed++;
          continue;
        }
      }

      console.log(`  ${pc.green('✓')} ${test.id} ${pc.dim(`(${durationMs}ms)`)}`);
      passed++;
    }

    console.log('');
    console.log(`${pc.green(`${passed} passed`)}  ${failed > 0 ? pc.red(`${failed} failed`) : pc.dim('0 failed')}`);

    if (failed > 0) process.exit(1);
  });

// ── convert ───────────────────────────────────────────────────────────────────
program
  .command('convert <format> <file>')
  .description('Convert an OpenAPI or MCP document to PactSpec (formats: openapi, mcp)')
  .option('-o, --out <file>', 'Output file (default: pactspec.json)')
  .action((format: string, file: string, opts: { out?: string }) => {
    if (format !== 'openapi' && format !== 'mcp') {
      console.error(pc.red(`✗ Unknown format: ${format}. Supported: openapi, mcp`));
      process.exit(1);
    }

    let source: Record<string, unknown>;
    try {
      source = parseSourceFile(file);
    } catch (err) {
      console.error(pc.red(`✗ Could not read or parse ${file}`));
      if (err instanceof Error && err.message) {
        console.error(pc.red(`  ${err.message}`));
      }
      process.exit(1);
    }

    if (format === 'openapi') {
      const result = convertOpenApi(source);
      const outFile = opts.out ?? 'pactspec.json';
      writeFileSync(resolve(outFile), JSON.stringify(result.spec, null, 2));
      console.log(pc.green(`✓ Converted to ${outFile}`));
      if (result.warnings.length > 0) {
        console.log(pc.yellow('\nWarnings (review before publishing):'));
        for (const w of result.warnings) console.log(pc.yellow(`  ! ${w}`));
      }
      console.log(pc.dim(`\nNext: pactspec validate ${outFile}`));
    } else {
      const result = convertMcp(source);
      const outFile = opts.out ?? 'pactspec.json';
      writeFileSync(resolve(outFile), JSON.stringify(result.spec, null, 2));
      console.log(pc.green(`✓ Converted to ${outFile}`));
      if (result.warnings.length > 0) {
        console.log(pc.yellow('\nWarnings (review before publishing):'));
        for (const w of result.warnings) console.log(pc.yellow(`  ! ${w}`));
      }
      console.log(pc.dim(`\nNext: pactspec validate ${outFile}`));
    }
  });

// ── from-mcp ──────────────────────────────────────────────────────────────────
program
  .command('from-mcp <url>')
  .description('Fetch tools/list from a live MCP server and generate a PactSpec file')
  .option('-o, --out <file>', 'Output file (default: <agent-slug>.pactspec.json)')
  .option('--provider <name>', 'Provider name (default: inferred from URL)')
  .option('--provider-url <url>', 'Provider URL (default: origin of <url>)')
  .option('--agent-id <id>', 'Override the urn:pactspec:provider:name id')
  .option('--publish', 'Publish immediately after generating (requires --agent-id)')
  .option('--publish-token <token>', 'Publish token (X-Publish-Token header)')
  .option('--registry <url>', 'Registry URL', 'https://pactspec.dev')
  .action(async (url: string, opts: {
    out?: string;
    provider?: string;
    providerUrl?: string;
    agentId?: string;
    publish?: boolean;
    publishToken?: string;
    registry: string;
  }) => {
    // Normalise URL
    let mcpUrl: URL;
    try {
      mcpUrl = new URL(url);
    } catch {
      console.error(pc.red(`✗ Invalid URL: ${url}`));
      process.exit(1);
    }

    console.log(pc.dim(`Connecting to MCP server at ${mcpUrl.href}...`));

    // Send tools/list JSON-RPC request.
    // Supports both plain JSON responses and SSE streams (text/event-stream).
    let toolsResult: unknown;
    try {
      const res = await fetch(mcpUrl.href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        signal: AbortSignal.timeout(15_000),
      });

      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream')) {
        // SSE transport: parse event stream and find the first result message
        const text = await res.text();
        const lines = text.split('\n');
        let jsonStr = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            jsonStr = line.slice(6).trim();
            try {
              const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
              if (parsed.result !== undefined) { toolsResult = parsed; break; }
            } catch { /* keep reading */ }
          }
        }
        if (!toolsResult) {
          console.error(pc.red('✗ Could not extract tools/list result from SSE stream'));
          console.error(pc.dim('  Raw response:\n' + text.slice(0, 500)));
          process.exit(1);
        }
      } else {
        const text = await res.text();
        try {
          toolsResult = JSON.parse(text);
        } catch {
          console.error(pc.red(`✗ Server returned non-JSON response (HTTP ${res.status})`));
          console.error(pc.dim('  Response: ' + text.slice(0, 300)));
          process.exit(1);
        }
      }
    } catch (err) {
      console.error(pc.red(`✗ Could not reach ${mcpUrl.href}`));
      console.error(pc.red(`  ${(err as Error).message}`));
      console.error(pc.dim(`\n  Is your MCP server running? Try: curl -X POST ${mcpUrl.href} -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`));
      process.exit(1);
    }

    // Extract tools array from JSON-RPC response
    const rpc = toolsResult as Record<string, unknown>;
    if (rpc.error) {
      const rpcErr = rpc.error as Record<string, unknown>;
      console.error(pc.red(`✗ MCP error ${rpcErr.code ?? ''}: ${rpcErr.message ?? JSON.stringify(rpcErr)}`));
      process.exit(1);
    }

    const result = rpc.result as Record<string, unknown> | undefined;
    const tools = (result?.tools ?? result ?? []) as Array<Record<string, unknown>>;

    if (!Array.isArray(tools) || tools.length === 0) {
      console.error(pc.red('✗ No tools returned by the MCP server'));
      console.error(pc.dim('  Response: ' + JSON.stringify(toolsResult).slice(0, 300)));
      process.exit(1);
    }

    console.log(pc.green(`✓ Found ${tools.length} tool${tools.length === 1 ? '' : 's'}: ${tools.map((t) => t.name as string).join(', ')}`));

    // Build PactSpec
    const origin = opts.providerUrl ?? mcpUrl.origin;
    const providerName = opts.provider ?? mcpUrl.hostname;
    const providerSlug = slugify(providerName).split('-')[0] || 'provider';
    const agentSlug = slugify(mcpUrl.hostname + (mcpUrl.pathname !== '/' ? '-' + mcpUrl.pathname : '')) || 'agent';

    const skills = tools.map((tool) => {
      const toolName = (tool.name as string | undefined) ?? 'tool';
      const inputSchema = (tool.inputSchema as Record<string, unknown> | undefined) ??
        (tool.parameters as Record<string, unknown> | undefined) ??
        { type: 'object' };
      return {
        id: slugify(toolName) || 'tool',
        name: toolName,
        description: (tool.description as string | undefined) ?? toolName,
        inputSchema,
        // MCP doesn't define output schemas — use a generic object as placeholder
        outputSchema: { type: 'object', description: 'Define the output schema for this skill' },
        pricing: { model: 'free', amount: 0, currency: 'USD' },
      };
    });

    const specId = opts.agentId
      ? (opts.agentId.startsWith('urn:pactspec:') ? opts.agentId : `urn:pactspec:${opts.agentId}`)
      : `urn:pactspec:${providerSlug}:${agentSlug || 'agent'}`;

    const spec = {
      specVersion: '1.0.0',
      id: specId,
      name: providerName,
      version: '1.0.0',
      description: `MCP agent at ${mcpUrl.href} with ${tools.length} skill${tools.length === 1 ? '' : 's'}`,
      provider: { name: providerName, url: origin },
      endpoint: { url: url, auth: { type: 'none' } },
      skills,
      tags: ['mcp'],
    };

    const outFile = opts.out ?? `${agentSlug || 'agent'}.pactspec.json`;
    writeFileSync(resolve(outFile), JSON.stringify(spec, null, 2));
    console.log(pc.green(`✓ Spec written to ${outFile}`));
    console.log(pc.yellow('\n  ! Review outputSchema for each skill before publishing'));
    console.log(pc.yellow('  ! MCP does not define output schemas — fill these in manually'));
    console.log(pc.yellow('  ! All skills defaulted to free pricing — edit to set per-invocation, per-token, or per-second pricing'));

    // Inline validate
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateFn = ajv.compile(bundledSchema as object);
    if (validateFn(spec)) {
      console.log(pc.green(`✓ Spec is valid`));
    } else {
      console.log(pc.yellow('\n  Spec has validation issues (fix before publishing):'));
      for (const e of (validateFn.errors ?? [])) {
        console.log(pc.yellow(`    ! ${e.instancePath || '/'} ${e.message}`));
      }
    }

    if (opts.publish) {
      if (!opts.agentId) {
        console.error(pc.red('\n✗ --publish requires --agent-id'));
        process.exit(1);
      }
      console.log(pc.dim(`\nPublishing to ${opts.registry}...`));
      let pubRes: Response;
      try {
        const pubHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Agent-ID': opts.agentId,
        };
        if (opts.publishToken) pubHeaders['X-Publish-Token'] = opts.publishToken;
        pubRes = await fetch(`${opts.registry}/api/agents`, {
          method: 'POST',
          headers: pubHeaders,
          body: JSON.stringify(spec),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
        process.exit(1);
      }
      const pubText = await pubRes.text();
      let pubData: { agent?: { id: string; spec_id?: string }; error?: string; errors?: string[] } = {};
      try { pubData = JSON.parse(pubText); } catch { /* non-JSON */ }
      if (pubRes.ok && pubData.agent) {
        console.log(pc.green(`✓ Published: ${pubData.agent.spec_id ?? pubData.agent.id}`));
        console.log(pc.dim(`  ${opts.registry}/agents/${pubData.agent.id}`));
        console.log(pc.dim(`\nNext: pactspec verify ${specId} <skill-id>`));
      } else {
        console.error(pc.red(`✗ Publish failed: ${pubData.error ?? 'Unknown error'}`));
        if (pubData.errors) for (const e of pubData.errors) console.error(pc.red(`  ${e}`));
      }
    } else {
      console.log(pc.dim(`\nNext steps:`));
      console.log(pc.dim(`  1. Edit ${outFile} — fill in outputSchema for each skill`));
      console.log(pc.dim(`  2. pactspec validate ${outFile}`));
      console.log(pc.dim(`  3. pactspec publish ${outFile} --agent-id <your-org>`));
    }
  });

// ── from-openclaw ─────────────────────────────────────────────────────────────
program
  .command('from-openclaw <path-or-url>')
  .description('Convert an OpenClaw SKILL.md file into a PactSpec spec')
  .option('-o, --out <file>', 'Output file (default: <skill-slug>.pactspec.json)')
  .option('--endpoint <url>', 'Set the endpoint URL (e.g., your running MCP server URL)')
  .option('--publish', 'Publish immediately after generating')
  .option('--agent-id <id>', 'Agent identifier for publishing')
  .option('--publish-token <token>', 'Publish token (X-Publish-Token header)')
  .option('--registry <url>', 'Registry URL', 'https://pactspec.dev')
  .action(async (pathOrUrl: string, opts: {
    out?: string;
    endpoint?: string;
    publish?: boolean;
    agentId?: string;
    publishToken?: string;
    registry: string;
  }) => {
    let rawContent: string;

    // ── 1. Fetch or read the SKILL.md ──────────────────────────────────────
    const isUrl = /^https?:\/\//i.test(pathOrUrl);
    if (isUrl) {
      let fetchUrl = pathOrUrl;

      // ClawHub URL → try to resolve to raw SKILL.md
      if (/clawhub\.ai\/skills\//i.test(fetchUrl)) {
        const skillSlug = fetchUrl.replace(/\/+$/, '').split('/').pop() ?? '';
        fetchUrl = `https://raw.githubusercontent.com/openclaw/skills/main/${skillSlug}/SKILL.md`;
        console.log(pc.dim(`Resolved ClawHub URL → ${fetchUrl}`));
      }
      // GitHub tree URL → raw.githubusercontent.com
      else if (/github\.com\/.*\/tree\//.test(fetchUrl)) {
        fetchUrl = fetchUrl
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/tree/', '/');
        if (!fetchUrl.endsWith('/SKILL.md')) fetchUrl += '/SKILL.md';
        console.log(pc.dim(`Resolved GitHub URL → ${fetchUrl}`));
      }

      console.log(pc.dim(`Fetching ${fetchUrl}...`));
      try {
        const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rawContent = await res.text();
      } catch (err) {
        console.error(pc.red(`✗ Could not fetch SKILL.md: ${(err as Error).message}`));
        process.exit(1);
      }
    } else {
      const filePath = resolve(pathOrUrl);
      try {
        rawContent = readFileSync(filePath, 'utf-8');
      } catch {
        console.error(pc.red(`✗ Could not read file: ${pathOrUrl}`));
        process.exit(1);
      }
    }

    // ── 2. Parse YAML frontmatter ──────────────────────────────────────────
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      console.error(pc.red('✗ No YAML frontmatter found in SKILL.md'));
      console.error(pc.dim('  Expected a file starting with --- YAML frontmatter ---'));
      process.exit(1);
    }

    let frontmatter: Record<string, unknown>;
    try {
      frontmatter = parseYaml(fmMatch[1]) as Record<string, unknown>;
      if (!frontmatter || typeof frontmatter !== 'object') throw new Error('Frontmatter did not parse to an object');
    } catch (err) {
      console.error(pc.red(`✗ Failed to parse YAML frontmatter: ${(err as Error).message}`));
      process.exit(1);
    }

    const skillName = (frontmatter.name as string | undefined) ?? 'OpenClaw Skill';
    const skillDescription = (frontmatter.description as string | undefined) ?? '';
    const skillVersion = toSemver((frontmatter.version as string | undefined) ?? '1.0.0');
    const author = (frontmatter.author as string | undefined) ?? 'openclaw-community';
    const tags = (frontmatter.tags as string[] | undefined) ?? [];
    const openclawTools = (frontmatter.tools as Array<Record<string, unknown>> | undefined) ?? [];

    if (openclawTools.length === 0) {
      console.error(pc.red('✗ No tools defined in SKILL.md frontmatter'));
      process.exit(1);
    }

    console.log(pc.green(`✓ Parsed SKILL.md: "${skillName}" with ${openclawTools.length} tool${openclawTools.length === 1 ? '' : 's'}`));

    // ── 3. Convert OpenClaw tools to PactSpec skills ───────────────────────
    const skills = openclawTools.map((tool) => {
      const toolName = (tool.name as string | undefined) ?? 'tool';
      const toolDesc = (tool.description as string | undefined) ?? toolName;
      const params = (tool.parameters as Array<Record<string, unknown>> | undefined) ?? [];

      // Convert parameter list to JSON Schema object
      const properties: Record<string, Record<string, unknown>> = {};
      const required: string[] = [];
      for (const param of params) {
        const pName = param.name as string;
        const pType = (param.type as string | undefined) ?? 'string';
        const pDesc = param.description as string | undefined;
        const prop: Record<string, unknown> = { type: pType };
        if (pDesc) prop.description = pDesc;
        properties[pName] = prop;
        if (param.required === true) required.push(pName);
      }

      const inputSchema: Record<string, unknown> = { type: 'object', properties };
      if (required.length > 0) inputSchema.required = required;

      return {
        id: slugify(toolName) || 'tool',
        name: toolName,
        description: toolDesc,
        inputSchema,
        outputSchema: { type: 'object', description: 'OpenClaw does not define output schemas — fill in manually' },
        pricing: { model: 'free', amount: 0, currency: 'USD' },
      };
    });

    // ── 4. Build the PactSpec ──────────────────────────────────────────────
    const nameSlug = slugify(skillName) || 'skill';
    const providerSlug = slugify(author).split('-')[0] || 'openclaw';
    const endpointUrl = opts.endpoint ?? 'http://localhost:3000';

    const specId = `urn:pactspec:openclaw:${nameSlug}`;

    const spec = {
      specVersion: '1.0.0',
      id: specId,
      name: skillName,
      version: skillVersion,
      description: skillDescription || undefined,
      provider: { name: author, url: `https://clawhub.ai` },
      endpoint: { url: endpointUrl, auth: { type: 'none' as const } },
      skills,
      tags: [...tags, 'openclaw'],
    };

    // ── 5. Write the spec ──────────────────────────────────────────────────
    const outFile = opts.out ?? `${nameSlug}.pactspec.json`;
    writeFileSync(resolve(outFile), JSON.stringify(spec, null, 2));
    console.log(pc.green(`✓ Spec written to ${outFile}`));

    // ── 6. Validate against bundled schema ─────────────────────────────────
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateFn = ajv.compile(bundledSchema as object);
    if (validateFn(spec)) {
      console.log(pc.green(`✓ Spec is valid`));
    } else {
      console.log(pc.yellow('\n  Spec has validation issues (fix before publishing):'));
      for (const e of (validateFn.errors ?? [])) {
        console.log(pc.yellow(`    ! ${e.instancePath || '/'} ${e.message}`));
      }
    }

    // ── 7. Print warnings about manual attention needed ────────────────────
    const warnings: string[] = [];
    if (!opts.endpoint) {
      warnings.push('endpoint.url is set to http://localhost:3000 — update to your actual MCP server URL');
    }
    warnings.push('outputSchema for each skill is a placeholder — define actual output schemas');
    warnings.push('All skills defaulted to free pricing — edit to set paid pricing if needed');

    if (warnings.length > 0) {
      console.log(pc.yellow('\nWarnings (review before publishing):'));
      for (const w of warnings) console.log(pc.yellow(`  ! ${w}`));
    }

    // ── 8. Publish if requested ────────────────────────────────────────────
    if (opts.publish) {
      if (!opts.agentId) {
        console.error(pc.red('\n✗ --publish requires --agent-id'));
        process.exit(1);
      }
      console.log(pc.dim(`\nPublishing to ${opts.registry}...`));
      let pubRes: Response;
      try {
        const pubHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Agent-ID': opts.agentId,
        };
        if (opts.publishToken) pubHeaders['X-Publish-Token'] = opts.publishToken;
        pubRes = await fetch(`${opts.registry}/api/agents`, {
          method: 'POST',
          headers: pubHeaders,
          body: JSON.stringify(spec),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        console.error(pc.red(`✗ Network error: ${(err as Error).message}`));
        process.exit(1);
      }
      const pubText = await pubRes.text();
      let pubData: { agent?: { id: string; spec_id?: string }; error?: string; errors?: string[] } = {};
      try { pubData = JSON.parse(pubText); } catch { /* non-JSON */ }
      if (pubRes.ok && pubData.agent) {
        console.log(pc.green(`✓ Published: ${pubData.agent.spec_id ?? pubData.agent.id}`));
        console.log(pc.dim(`  ${opts.registry}/agents/${pubData.agent.id}`));
      } else {
        console.error(pc.red(`✗ Publish failed: ${pubData.error ?? 'Unknown error'}`));
        if (pubData.errors) for (const e of pubData.errors) console.error(pc.red(`  ${e}`));
        process.exit(1);
      }
    } else {
      console.log(pc.dim(`\nNext steps:`));
      console.log(pc.dim(`  1. Edit ${outFile} — fill in outputSchema for each skill`));
      if (!opts.endpoint) console.log(pc.dim(`  2. Set endpoint.url to your MCP server URL`));
      console.log(pc.dim(`  ${opts.endpoint ? '2' : '3'}. pactspec validate ${outFile}`));
      console.log(pc.dim(`  ${opts.endpoint ? '3' : '4'}. pactspec publish ${outFile} --agent-id <your-org>`));
    }
  });

// ─── OpenAPI 3.x → PactSpec converter ────────────────────────────────────────

interface ConvertResult {
  spec: Record<string, unknown>;
  warnings: string[];
}

/** Infer a JSON Schema from a concrete example value. */
function inferSchema(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { type: 'object' };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferSchema(value[0]) : {},
    };
  }
  if (typeof value === 'object') {
    const props: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      props[k] = inferSchema(v);
      if (v !== null && v !== undefined) required.push(k);
    }
    const schema: Record<string, unknown> = { type: 'object', properties: props };
    if (required.length > 0) schema.required = required;
    return schema;
  }
  return { type: typeof value };
}

function resolveRef(ref: string, doc: Record<string, unknown>): Record<string, unknown> | null {
  if (!ref.startsWith('#/')) return null;
  const parts = ref
    .replace(/^#\//, '')
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node: unknown = doc;
  for (const part of parts) {
    if (!isRecord(node)) return null;
    node = node[part];
  }
  return isRecord(node) ? (node as Record<string, unknown>) : null;
}

function resolveSchema(
  schema: Record<string, unknown>,
  doc: Record<string, unknown>,
  warnings: string[],
  context: string,
  seen: Set<string> = new Set()
): Record<string, unknown> {
  const ref = schema.$ref;
  if (typeof ref === 'string') {
    if (seen.has(ref)) {
      warnings.push(`${context}: $ref cycle detected (${ref})`);
      return { type: 'object' };
    }
    seen.add(ref);
    const resolved = resolveRef(ref, doc);
    if (!resolved) {
      warnings.push(`${context}: Unresolved $ref ${ref}`);
      return { type: 'object' };
    }
    return resolveSchema(resolved, doc, warnings, context, seen);
  }

  const out: Record<string, unknown> = { ...schema };
  if (isRecord(out.properties)) {
    const props = { ...(out.properties as Record<string, unknown>) };
    for (const [k, v] of Object.entries(props)) {
      if (isRecord(v)) props[k] = resolveSchema(v, doc, warnings, context, new Set(seen));
    }
    out.properties = props;
  }
  if (isRecord(out.items)) {
    out.items = resolveSchema(out.items as Record<string, unknown>, doc, warnings, context, new Set(seen));
  }
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    const value = out[key] as unknown;
    if (Array.isArray(value)) {
      out[key] = value.map((v) => (isRecord(v) ? resolveSchema(v, doc, warnings, context, new Set(seen)) : v));
    }
  }
  return out;
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
  const providerSlug = titleSlug.split('-')[0] || 'provider';
  const agentSlug = titleSlug || 'agent';
  const specId = `urn:pactspec:${providerSlug}:${agentSlug}`;

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
        if (jsonContent?.schema && isRecord(jsonContent.schema)) {
          inputSchema = resolveSchema(jsonContent.schema as Record<string, unknown>, doc, warnings, `${method.toUpperCase()} ${path} requestBody`);
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
              params.map((p) => {
                const schema = p.schema as Record<string, unknown> | undefined;
                const resolved = schema && isRecord(schema)
                  ? resolveSchema(schema, doc, warnings, `${method.toUpperCase()} ${path} parameter ${p.name}`)
                  : { type: 'string' };
                return [p.name, resolved];
              })
            ),
          };
        }
      }

      // Output schema from 200/201 response — schema first, then examples, then warn
      let outputSchema: Record<string, unknown> = { type: 'object' };
      const responses = (op.responses ?? {}) as Record<string, unknown>;
      const ok = (responses['200'] ?? responses['201']) as Record<string, unknown> | undefined;
      if (ok) {
        const content = ok.content as Record<string, unknown> | undefined;
        const jsonContent = content?.['application/json'] as Record<string, unknown> | undefined;
        if (jsonContent?.schema && isRecord(jsonContent.schema)) {
          outputSchema = resolveSchema(jsonContent.schema as Record<string, unknown>, doc, warnings, `${method.toUpperCase()} ${path} response`);
        } else if (jsonContent?.example) {
          // Infer schema from inline example
          outputSchema = inferSchema(jsonContent.example);
          warnings.push(`${method.toUpperCase()} ${path}: outputSchema inferred from response example — review before publishing`);
        } else if (jsonContent?.examples) {
          // Use first named example
          const examples = jsonContent.examples as Record<string, Record<string, unknown>>;
          const first = Object.values(examples)[0];
          if (first?.value !== undefined) {
            outputSchema = inferSchema(first.value);
            warnings.push(`${method.toUpperCase()} ${path}: outputSchema inferred from response example — review before publishing`);
          } else {
            warnings.push(`${method.toUpperCase()} ${path}: No response schema or example — define outputSchema manually`);
          }
        } else {
          warnings.push(`${method.toUpperCase()} ${path}: No response schema or example — define outputSchema manually`);
        }
      } else {
        warnings.push(`${method.toUpperCase()} ${path}: No 200/201 response defined — define outputSchema manually`);
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

  let providerUrl: string | undefined;
  if (endpointUrl.startsWith('http')) {
    try {
      providerUrl = new URL(endpointUrl).origin;
    } catch {
      warnings.push('servers[0].url is not a valid absolute URL — provider.url omitted');
    }
  }

  const spec = {
    specVersion: '1.0.0',
    id: specId,
    name: rawTitle,
    version: toSemver(rawVersion),
    description: description || undefined,
    provider: {
      name: rawTitle,
      url: providerUrl,
    },
    endpoint: { url: endpointUrl },
    skills,
    tags: [],
  };

  return { spec, warnings };
}

// ─── MCP tool manifest → PactSpec converter ──────────────────────────────────

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
  const providerSlug = titleSlug.split('-')[0] || 'provider';
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
    id: `urn:pactspec:${providerSlug}:${agentSlug}`,
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
