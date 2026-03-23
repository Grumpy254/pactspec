import { NextRequest, NextResponse } from 'next/server';
import { assertSafeUrl } from '@/lib/validator';

function extractMeta(html: string, property: string): string {
  // og: and name= meta tags
  const og = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  );
  if (og) return og[1];
  const name = html.match(
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  );
  if (name) return name[1];
  // reversed attribute order
  const rev = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i')
  );
  return rev ? rev[1] : '';
}

function extractTitle(html: string): string {
  const og = extractMeta(html, 'og:title');
  if (og) return og;
  const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return tag ? tag[1].trim() : '';
}

function extractFavicon(html: string, baseUrl: string): string {
  const rel = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (rel) {
    const href = rel[1];
    if (href.startsWith('http')) return href;
    const base = new URL(baseUrl);
    return href.startsWith('/') ? `${base.origin}${href}` : `${base.origin}/${href}`;
  }
  const base = new URL(baseUrl);
  return `${base.origin}/favicon.ico`;
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: '`url` must be a string' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(body.url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Only http/https URLs allowed');
    }
  } catch (e) {
    return NextResponse.json({ error: `Invalid URL: ${(e as Error).message}` }, { status: 400 });
  }

  // SSRF protection: block private/internal IPs
  try {
    await assertSafeUrl(parsed.toString(), 'url');
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'PactSpec-Metadata/1.0' },
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `URL returned HTTP ${res.status}` },
        { status: 422 }
      );
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return NextResponse.json(
        { error: 'URL does not return HTML' },
        { status: 422 }
      );
    }

    // Read only first 64KB — enough for <head>
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < 65536) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytes += value.byteLength;
      }
      reader.cancel();
    }

    const title = extractTitle(html);
    const description =
      extractMeta(html, 'og:description') || extractMeta(html, 'description');
    const favicon = extractFavicon(html, parsed.toString());

    return NextResponse.json({ title, description, favicon });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to fetch URL: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}
