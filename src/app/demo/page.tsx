'use client';

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepLog {
  label: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status: number;
  responseBody: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CodeBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 mb-1 font-mono">{title}</p>
      <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
        {children}
      </pre>
    </div>
  );
}

function StepCard({
  step,
  log,
  active,
}: {
  step: number;
  log: StepLog;
  active: boolean;
}) {
  const statusColor =
    log.status >= 200 && log.status < 300
      ? 'text-green-400'
      : log.status === 402
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        active ? 'border-indigo-500 bg-gray-900/60' : 'border-gray-800 bg-gray-900/30'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold">
          {step}
        </span>
        <span className="font-semibold text-white text-sm">{log.label}</span>
        <span className={`ml-auto font-mono text-sm font-bold ${statusColor}`}>
          HTTP {log.status}
        </span>
      </div>

      <CodeBlock title="Request">
        {`${log.method} ${log.url}\n` +
          Object.entries(log.requestHeaders)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n') +
          '\n\n' +
          JSON.stringify(log.requestBody, null, 2)}
      </CodeBlock>

      <CodeBlock title="Response">
        {JSON.stringify(log.responseBody, null, 2)}
      </CodeBlock>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const [text, setText] = useState(
    'The James Webb Space Telescope (JWST) is a space telescope designed primarily to conduct infrared astronomy. As the largest optical telescope in space, its high infrared resolution and sensitivity allow it to view objects too distant or faint for the Hubble Space Telescope. This is expected to enable a broad range of investigations across the fields of astronomy and cosmology, such as observation of the first stars and the formation of the first galaxies.',
  );
  const [maxSentences, setMaxSentences] = useState(3);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [waitingForSimulate, setWaitingForSimulate] = useState(false);
  const [challengeBody, setChallengeBody] = useState<Record<string, unknown> | null>(null);

  const reset = useCallback(() => {
    setLogs([]);
    setActiveStep(0);
    setWaitingForSimulate(false);
    setChallengeBody(null);
  }, []);

  // -------------------------------------------------------------------------
  // Free summarize
  // -------------------------------------------------------------------------

  const handleFree = useCallback(async () => {
    reset();
    setLoading(true);
    const url = '/api/demo/summarize';
    const reqBody = { text, maxSentences };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });
      const resBody = await res.json();
      setLogs([
        {
          label: 'Free summarize request',
          method: 'POST',
          url,
          requestHeaders: headers,
          requestBody: reqBody,
          status: res.status,
          responseBody: resBody,
        },
      ]);
      setActiveStep(1);
    } catch (e) {
      setLogs([
        {
          label: 'Free summarize request',
          method: 'POST',
          url,
          requestHeaders: headers,
          requestBody: reqBody,
          status: 0,
          responseBody: { error: (e as Error).message },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [text, maxSentences, reset]);

  // -------------------------------------------------------------------------
  // Paid x402 — Step 1: get 402 challenge
  // -------------------------------------------------------------------------

  const handlePaidStep1 = useCallback(async () => {
    reset();
    setLoading(true);
    const url = '/api/demo/paid-summarize';
    const reqBody = { text, maxSentences };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });
      const resBody = await res.json();
      setLogs([
        {
          label: 'Call paid endpoint (no payment header)',
          method: 'POST',
          url,
          requestHeaders: headers,
          requestBody: reqBody,
          status: res.status,
          responseBody: resBody,
        },
      ]);
      setActiveStep(1);

      if (res.status === 402) {
        setChallengeBody(resBody);
        setWaitingForSimulate(true);
      }
    } catch (e) {
      setLogs([
        {
          label: 'Call paid endpoint (no payment header)',
          method: 'POST',
          url,
          requestHeaders: headers,
          requestBody: reqBody,
          status: 0,
          responseBody: { error: (e as Error).message },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [text, maxSentences, reset]);

  // -------------------------------------------------------------------------
  // Paid x402 — Step 2: simulate payment + retry with proof
  // -------------------------------------------------------------------------

  const handleSimulatePayment = useCallback(async () => {
    setLoading(true);
    setWaitingForSimulate(false);

    const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const url = '/api/demo/paid-summarize';
    const reqBody = { text, maxSentences };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Payment-Proof': mockTxHash,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });
      const resBody = await res.json();
      setLogs((prev) => [
        ...prev,
        {
          label: 'Retry with X-Payment-Proof header',
          method: 'POST',
          url,
          requestHeaders: headers,
          requestBody: reqBody,
          status: res.status,
          responseBody: resBody,
        },
      ]);
      setActiveStep(2);
    } catch (e) {
      setLogs((prev) => [
        ...prev,
        {
          label: 'Retry with X-Payment-Proof header',
          method: 'POST',
          url,
          requestHeaders: headers,
          requestBody: reqBody,
          status: 0,
          responseBody: { error: (e as Error).message },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [text, maxSentences]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <h1 className="text-3xl font-bold text-white mb-2">
          x402 Payment Flow Demo
        </h1>
        <p className="text-gray-400 max-w-2xl">
          See the HTTP 402 payment protocol in action. This demo shows how an agent
          charges per-invocation using on-chain USDC payments — no platform needed.
        </p>
      </section>

      {/* How it works */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            step: '1',
            title: 'Agent returns 402',
            desc: 'The consumer calls the agent without payment. The agent responds with HTTP 402 and a JSON challenge containing price, currency, network, and a wallet address.',
          },
          {
            step: '2',
            title: 'Consumer pays on-chain',
            desc: 'The consumer (or their wallet SDK) sends the specified amount of USDC to the given address on Base. They receive a transaction hash.',
          },
          {
            step: '3',
            title: 'Retry with proof',
            desc: 'The consumer retries the same request with an X-Payment-Proof header containing the tx hash. The agent verifies and returns the result.',
          },
        ].map((item) => (
          <div
            key={item.step}
            className="border border-gray-800 rounded-lg p-5 bg-gray-900/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                {item.step}
              </span>
              <h3 className="font-semibold text-white text-sm">{item.title}</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Input */}
      <section className="border border-gray-800 rounded-lg p-6 bg-gray-900/30">
        <h2 className="text-lg font-semibold text-white mb-4">Input</h2>
        <label className="block text-sm text-gray-400 mb-1">
          Text to summarize
        </label>
        <textarea
          className="w-full h-32 bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type text here..."
        />
        <div className="mt-3 flex items-center gap-4">
          <label className="text-sm text-gray-400">
            Max sentences:{' '}
            <input
              type="number"
              min={1}
              max={10}
              value={maxSentences}
              onChange={(e) => setMaxSentences(Number(e.target.value))}
              className="w-16 ml-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleFree}
            disabled={loading || !text.trim()}
            className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Try Free
          </button>
          <button
            onClick={handlePaidStep1}
            disabled={loading || !text.trim()}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Try Paid (x402)
          </button>
          {logs.length > 0 && (
            <button
              onClick={reset}
              className="px-5 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* Simulate payment button */}
      {waitingForSimulate && challengeBody && (
        <section className="border border-yellow-600/40 rounded-lg p-6 bg-yellow-950/20">
          <h2 className="text-lg font-semibold text-yellow-300 mb-2">
            Payment Required (HTTP 402)
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            The agent returned a 402 challenge. In production, your wallet SDK
            would now send{' '}
            <span className="text-white font-mono">
              {String(challengeBody.amount)} {String(challengeBody.currency)}
            </span>{' '}
            on{' '}
            <span className="text-white font-mono">{String(challengeBody.network)}</span>{' '}
            to{' '}
            <span className="text-white font-mono text-xs break-all">
              {String(challengeBody.payTo)}
            </span>
            . For this demo, click below to simulate the on-chain payment.
          </p>
          <button
            onClick={handleSimulatePayment}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Simulate Payment & Retry'}
          </button>
        </section>
      )}

      {/* Step logs */}
      {logs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            HTTP Request / Response Log
          </h2>
          {logs.map((log, i) => (
            <StepCard
              key={i}
              step={i + 1}
              log={log}
              active={i + 1 === activeStep}
            />
          ))}
        </section>
      )}

      {/* Protocol note */}
      <section className="border border-gray-800 rounded-lg p-6 bg-gray-900/30 text-sm text-gray-400 space-y-3">
        <h2 className="text-base font-semibold text-white">
          How x402 works in PactSpec
        </h2>
        <p>
          The <span className="text-indigo-400 font-mono">x402</span> protocol
          lets any HTTP API charge for usage with zero sign-up and zero
          platform fees. It uses the standard{' '}
          <span className="text-white font-mono">HTTP 402 Payment Required</span>{' '}
          status code that has been reserved in the HTTP spec since 1997 but
          rarely used until now.
        </p>
        <p>
          PactSpec agents declare their pricing in the spec file (including the
          protocol field set to{' '}
          <span className="text-white font-mono">&quot;x402&quot;</span>). Consumers
          read the spec, discover the price, and handle the 402 challenge
          automatically. The{' '}
          <span className="text-indigo-400 font-mono">
            @pactspec/x402-middleware
          </span>{' '}
          npm package provides Express/Connect middleware that implements this
          flow in a few lines of code.
        </p>
        <p>
          In this demo, payment verification is mocked. In production, the
          middleware verifies the transaction on-chain (Base or Solana) before
          passing the request through to the agent handler.
        </p>
      </section>
    </div>
  );
}
