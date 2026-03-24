/**
 * Express middleware + auto-registration for PactSpec.
 *
 * Usage:
 * ```ts
 * const { pactspec } = require('@pactspec/register');
 * app.use(pactspec({ name: 'My Agent', skills: [...] }));
 * ```
 */

import type {
  PactSpecRegisterOptions,
  MinimalRequest,
  MinimalResponse,
  NextFunction,
} from './types.js';
import { buildSpec, publishToRegistry, deriveAgentId } from './register.js';

const WELL_KNOWN_PATH = '/.well-known/pactspec.json';
const STARTUP_DELAY_MS = 2_000;
const LOG_PREFIX = 'PactSpec:';

/**
 * Create Express middleware that auto-publishes the agent spec to the PactSpec
 * registry and serves `/.well-known/pactspec.json`.
 */
export function pactspec(
  options: PactSpecRegisterOptions,
): (req: MinimalRequest, res: MinimalResponse, next: NextFunction) => void {
  const registry =
    options.registry ??
    process.env.PACTSPEC_REGISTRY ??
    'https://pactspec.dev';

  const publishToken =
    options.publishToken ?? process.env.PACTSPEC_PUBLISH_TOKEN ?? undefined;

  const autoPublish = options.autoPublish !== false;
  const publishOnStart = options.publishOnStart !== false;
  const republishInterval = options.republishInterval ?? 0;

  const providerName = options.provider?.name ?? 'Unknown';
  const agentId =
    options.agentId ?? deriveAgentId(providerName, options.name);

  let resolvedBaseUrl: string | null = options.baseUrl ?? null;
  let cachedSpec: Record<string, unknown> | null = null;
  let published = false;
  let publishScheduled = false;
  let republishTimer: ReturnType<typeof setInterval> | null = null;

  function getSpec(): Record<string, unknown> {
    if (!cachedSpec && resolvedBaseUrl) {
      cachedSpec = buildSpec(options, resolvedBaseUrl);
    }
    return cachedSpec ?? buildSpec(options, resolvedBaseUrl ?? 'http://localhost');
  }

  function invalidateCache(): void {
    cachedSpec = null;
  }

  async function doPublish(): Promise<void> {
    if (!autoPublish) return;

    const spec = getSpec();
    try {
      const result = await publishToRegistry(spec, {
        registry,
        agentId,
        publishToken,
      });
      if (result.success) {
        console.log(`${LOG_PREFIX} Published to ${result.agentUrl}`);
        published = true;
      } else {
        console.warn(`${LOG_PREFIX} Publish failed: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${LOG_PREFIX} Publish failed: ${message}`);
    }
  }

  function scheduleStartupPublish(): void {
    if (publishScheduled) return;
    publishScheduled = true;

    setTimeout(() => {
      doPublish().then(() => {
        if (republishInterval > 0 && !republishTimer) {
          republishTimer = setInterval(() => {
            invalidateCache();
            doPublish();
          }, republishInterval);
          if (republishTimer.unref) republishTimer.unref();
        }
      });
    }, STARTUP_DELAY_MS);
  }

  if (resolvedBaseUrl && publishOnStart && autoPublish) {
    scheduleStartupPublish();
  }

  return function pactspecMiddleware(
    req: MinimalRequest,
    res: MinimalResponse,
    next: NextFunction,
  ): void {
    if (!resolvedBaseUrl) {
      resolvedBaseUrl = detectBaseUrl(req);
      invalidateCache();

      if (publishOnStart && autoPublish) {
        scheduleStartupPublish();
      }
    }

    const reqPath = req.path ?? req.url?.split('?')[0];
    if (
      reqPath === WELL_KNOWN_PATH &&
      (!req.method || req.method === 'GET')
    ) {
      const spec = getSpec();
      const body = JSON.stringify(spec, null, 2);

      if (res.status && res.json) {
        res.status(200).json!(spec);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
      }
      return;
    }

    next();
  };
}

function detectBaseUrl(req: MinimalRequest): string {
  if (typeof req.get === 'function') {
    const host = req.get('host');
    if (host) {
      const proto = req.protocol ?? 'http';
      return `${proto}://${host}`;
    }
  }

  const host =
    (req.headers?.['x-forwarded-host'] as string) ??
    (req.headers?.['host'] as string);
  if (host) {
    const proto =
      (req.headers?.['x-forwarded-proto'] as string) ?? 'http';
    return `${proto}://${host}`;
  }

  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}`;
}
