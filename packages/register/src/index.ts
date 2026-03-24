/**
 * @pactspec/register — Zero-config Express middleware that auto-publishes
 * your agent to the PactSpec registry on startup.
 *
 * @example
 * ```ts
 * const { pactspec } = require('@pactspec/register');
 *
 * app.use(pactspec({
 *   name: 'My Agent',
 *   provider: { name: 'Acme Corp' },
 *   skills: [{
 *     id: 'do-thing',
 *     name: 'Do Thing',
 *     description: 'Does the thing',
 *     path: '/api/do-thing',
 *     inputSchema: { type: 'object' },
 *     outputSchema: { type: 'object' },
 *   }],
 * }));
 * ```
 */

export { pactspec } from './middleware.js';
export { buildSpec, publishToRegistry, deriveAgentId } from './register.js';
export type {
  PactSpecRegisterOptions,
  SkillConfig,
  PublishResult,
} from './types.js';
