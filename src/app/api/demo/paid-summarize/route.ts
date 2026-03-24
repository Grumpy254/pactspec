import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

const DEMO_PAY_TO = '0xDEMO000000000000000000000000000000000000';
const PRICE_AMOUNT = '0.001';
const CURRENCY = 'USDC';
const NETWORK = 'base';
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  return NextResponse.json({
    name: 'Paid Summarize Demo (x402)',
    description:
      'A demonstration endpoint that implements the x402 payment flow. ' +
      'POST without an X-Payment-Proof header to receive a 402 challenge. ' +
      'Then POST again with the header set to a transaction hash to receive the paid response.',
    usage: {
      step1: {
        description: 'Request a payment challenge',
        request: {
          method: 'POST',
          url: '/api/demo/paid-summarize',
          headers: { 'Content-Type': 'application/json' },
          body: { text: 'Your text here', maxSentences: 3 },
        },
        response: {
          status: 402,
          body: {
            type: 'x402-payment-required',
            amount: PRICE_AMOUNT,
            currency: CURRENCY,
            network: NETWORK,
            payTo: DEMO_PAY_TO,
            paymentId: '<uuid>',
            expiresAt: '<ISO-8601 timestamp>',
            description: 'PactSpec demo: summarize one text (0.001 USDC)',
          },
        },
      },
      step2: {
        description: 'Submit payment proof and get the summary',
        request: {
          method: 'POST',
          url: '/api/demo/paid-summarize',
          headers: {
            'Content-Type': 'application/json',
            'X-Payment-Proof': '<transaction-hash>',
          },
          body: { text: 'Your text here', maxSentences: 3 },
        },
        response: {
          status: 200,
          body: {
            summary: '...',
            sentences: 3,
            paid: true,
            paymentId: '<uuid>',
          },
        },
      },
    },
    pricing: {
      model: 'per-invocation',
      amount: PRICE_AMOUNT,
      currency: CURRENCY,
      protocol: 'x402',
      network: NETWORK,
    },
  });
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown; maxSentences?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return NextResponse.json({ error: '`text` must be a non-empty string' }, { status: 400 });
  }

  // x402 gate: check for X-Payment-Proof header
  const proofHeader = req.headers.get('x-payment-proof');

  if (!proofHeader) {
    const paymentId = randomUUID();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

    return NextResponse.json(
      {
        type: 'x402-payment-required',
        amount: PRICE_AMOUNT,
        currency: CURRENCY,
        network: NETWORK,
        payTo: DEMO_PAY_TO,
        paymentId,
        expiresAt,
        description: 'PactSpec demo: summarize one text (0.001 USDC)',
      },
      {
        status: 402,
        headers: {
          'X-Payment-Network': NETWORK,
          'X-Payment-Currency': CURRENCY,
        },
      },
    );
  }

  // Payment proof present — mock-verify it (this is a demo)
  const txHash = proofHeader.trim();
  if (txHash.length === 0) {
    return NextResponse.json(
      { error: 'X-Payment-Proof header must contain a non-empty transaction hash' },
      { status: 400 },
    );
  }

  const paymentId = randomUUID();

  // Summarize
  const maxSentences =
    typeof body.maxSentences === 'number' && body.maxSentences > 0
      ? Math.min(Math.floor(body.maxSentences), 10)
      : 3;

  const text = (body.text as string).slice(0, 8000);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      summary:
        '[Mock summary] This is a demo response. Set the ANTHROPIC_API_KEY environment variable to enable real summarization. ' +
        'The x402 payment flow completed successfully — your payment proof was accepted.',
      sentences: 2,
      paid: true,
      paymentId,
    });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Summarize the following text in exactly ${maxSentences} sentence${maxSentences > 1 ? 's' : ''}. Return only the summary, no preamble.\n\n${text}`,
        },
      ],
    });

    const summary =
      message.content[0].type === 'text' ? message.content[0].text.trim() : '';

    const sentences = summary
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0).length;

    return NextResponse.json({ summary, sentences, paid: true, paymentId });
  } catch (e) {
    console.error('Summarization failed:', (e as Error).message);
    return NextResponse.json(
      { error: 'Summarization failed' },
      { status: 502 },
    );
  }
}
