import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const maxSentences =
    typeof body.maxSentences === 'number' && body.maxSentences > 0
      ? Math.min(Math.floor(body.maxSentences), 10)
      : 3;

  const text = body.text.slice(0, 8000); // cap input

  try {
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

    return NextResponse.json({ summary, sentences });
  } catch (e) {
    console.error('Summarization failed:', (e as Error).message);
    return NextResponse.json(
      { error: 'Summarization failed' },
      { status: 502 }
    );
  }
}
