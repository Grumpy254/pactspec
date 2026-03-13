import { NextResponse } from 'next/server';
import schema from '@/lib/schema/agent-spec.v1.json';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(schema, {
    headers: {
      'Content-Type': 'application/schema+json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
