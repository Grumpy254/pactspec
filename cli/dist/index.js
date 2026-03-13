#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const picocolors_1 = __importDefault(require("picocolors"));
const fs_1 = require("fs");
const path_1 = require("path");
const _2020_1 = __importDefault(require("ajv/dist/2020"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const program = new commander_1.Command();
program
    .name('agentspec')
    .description('Official CLI for the AgentSpec protocol')
    .version('0.1.0');
// ── validate ─────────────────────────────────────────────────────────────────
program
    .command('validate <file>')
    .description('Validate an AgentSpec JSON file against the v1 schema')
    .action(async (file) => {
    const ajv = new _2020_1.default({ strict: false });
    (0, ajv_formats_1.default)(ajv);
    let spec;
    try {
        spec = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(file), 'utf-8'));
    }
    catch {
        console.error(picocolors_1.default.red(`✗ Could not read or parse ${file}`));
        process.exit(1);
    }
    let schema;
    try {
        // Try local schema first, then fetch from registry
        const localSchema = (0, path_1.join)(__dirname, '../../src/lib/schema/agent-spec.v1.json');
        schema = JSON.parse((0, fs_1.readFileSync)(localSchema, 'utf-8'));
    }
    catch {
        console.log(picocolors_1.default.dim('Fetching schema from registry...'));
        const res = await fetch('https://agentspec.dev/api/spec/v1');
        schema = await res.json();
    }
    const validate = ajv.compile(schema);
    const valid = validate(spec);
    if (valid) {
        console.log(picocolors_1.default.green('✓ Valid AgentSpec document'));
    }
    else {
        console.error(picocolors_1.default.red('✗ Validation failed:'));
        for (const err of validate.errors ?? []) {
            console.error(picocolors_1.default.red(`  ${err.instancePath || '/'} ${err.message}`));
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
    .action(async (file, opts) => {
    let spec;
    try {
        spec = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(file), 'utf-8'));
    }
    catch {
        console.error(picocolors_1.default.red(`✗ Could not read or parse ${file}`));
        process.exit(1);
    }
    if (!opts.agentId) {
        console.error(picocolors_1.default.red('✗ --agent-id is required'));
        process.exit(1);
    }
    console.log(picocolors_1.default.dim(`Publishing to ${opts.registry}...`));
    let res;
    try {
        res = await fetch(`${opts.registry}/api/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Agent-ID': opts.agentId,
            },
            body: JSON.stringify(spec),
        });
    }
    catch (err) {
        console.error(picocolors_1.default.red(`✗ Network error: ${err.message}`));
        process.exit(1);
    }
    const data = await res.json();
    if (res.ok && data.agent) {
        console.log(picocolors_1.default.green(`✓ Published: ${data.agent.id}`));
        console.log(picocolors_1.default.dim(`  ${opts.registry}/agents/${data.agent.id}`));
    }
    else {
        console.error(picocolors_1.default.red(`✗ Publish failed: ${data.error ?? 'Unknown error'}`));
        if (data.errors) {
            for (const e of data.errors)
                console.error(picocolors_1.default.red(`  ${e}`));
        }
        process.exit(1);
    }
});
// ── verify ────────────────────────────────────────────────────────────────────
program
    .command('verify <agent-id> <skill-id>')
    .description('Trigger a validation run for an agent skill')
    .option('-r, --registry <url>', 'Registry URL', 'https://agentspec.dev')
    .action(async (agentId, skillId, opts) => {
    console.log(picocolors_1.default.dim(`Running validation for ${agentId} / ${skillId}...`));
    let res;
    try {
        res = await fetch(`${opts.registry}/api/agents/${agentId}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillId }),
        });
    }
    catch (err) {
        console.error(picocolors_1.default.red(`✗ Network error: ${err.message}`));
        process.exit(1);
    }
    const data = await res.json();
    if (data.status === 'PASSED') {
        console.log(picocolors_1.default.green(`✓ Validation PASSED`));
        console.log(picocolors_1.default.dim(`  Attestation: ${data.attestationHash}`));
    }
    else {
        console.error(picocolors_1.default.red(`✗ Validation ${data.status}`));
        if (data.error)
            console.error(picocolors_1.default.red(`  ${data.error}`));
        if (data.results) {
            for (const r of data.results) {
                const icon = r.passed ? picocolors_1.default.green('✓') : picocolors_1.default.red('✗');
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
    .action(async (opts) => {
    const ajv = new _2020_1.default({ strict: false });
    (0, ajv_formats_1.default)(ajv);
    let schema;
    try {
        const res = await fetch(`${opts.registry}/api/spec/v1`);
        schema = await res.json();
    }
    catch {
        console.error(picocolors_1.default.red('✗ Could not fetch schema'));
        process.exit(1);
    }
    const validate = ajv.compile(schema);
    const conformanceDir = (0, path_1.join)(__dirname, '../../conformance');
    let passed = 0;
    let failed = 0;
    // Valid cases — must accept
    const validDir = (0, path_1.join)(conformanceDir, 'valid');
    for (const file of (0, fs_1.readdirSync)(validDir).filter(f => f.endsWith('.json'))) {
        const doc = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(validDir, file), 'utf-8'));
        const ok = validate(doc);
        if (ok) {
            console.log(picocolors_1.default.green(`✓ valid/${file}`));
            passed++;
        }
        else {
            console.error(picocolors_1.default.red(`✗ valid/${file} — should be valid but got errors:`));
            for (const e of validate.errors ?? [])
                console.error(picocolors_1.default.red(`    ${e.instancePath} ${e.message}`));
            failed++;
        }
    }
    // Invalid cases — must reject
    const invalidDir = (0, path_1.join)(conformanceDir, 'invalid');
    for (const file of (0, fs_1.readdirSync)(invalidDir).filter(f => f.endsWith('.json'))) {
        const doc = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(invalidDir, file), 'utf-8'));
        const ok = validate(doc);
        if (!ok) {
            console.log(picocolors_1.default.green(`✓ invalid/${file} — correctly rejected`));
            passed++;
        }
        else {
            console.error(picocolors_1.default.red(`✗ invalid/${file} — should be invalid but was accepted`));
            failed++;
        }
    }
    console.log('');
    console.log(`${picocolors_1.default.green(`${passed} passed`)}  ${failed > 0 ? picocolors_1.default.red(`${failed} failed`) : picocolors_1.default.dim('0 failed')}`);
    if (failed > 0)
        process.exit(1);
});
// ── init ──────────────────────────────────────────────────────────────────────
program
    .command('init')
    .description('Generate a skeleton AgentSpec JSON file')
    .option('-o, --out <file>', 'Output file', 'agentspec.json')
    .action((opts) => {
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
    (0, fs_1.writeFileSync)((0, path_1.resolve)(opts.out), JSON.stringify(skeleton, null, 2));
    console.log(picocolors_1.default.green(`✓ Created ${opts.out}`));
    console.log(picocolors_1.default.dim('Edit the file, then run: agentspec validate ' + opts.out));
});
program.parse();
