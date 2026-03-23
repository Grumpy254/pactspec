import { NextRequest, NextResponse } from 'next/server';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export async function POST(req: NextRequest) {
  let body: { schema?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.schema || typeof body.schema !== 'object') {
    return NextResponse.json({ error: '`schema` must be a JSON Schema object' }, { status: 400 });
  }
  if (body.data === undefined) {
    return NextResponse.json({ error: '`data` is required' }, { status: 400 });
  }

  // Limit schema size to prevent DoS via pathological schemas
  const schemaStr = JSON.stringify(body.schema);
  if (schemaStr.length > 100_000) {
    return NextResponse.json({ error: 'Schema too large (max 100KB)' }, { status: 400 });
  }

  // Fresh AJV instance per request to prevent memory accumulation
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(body.schema as object);
  } catch (e) {
    return NextResponse.json(
      { error: `Invalid JSON Schema: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const valid = validate(body.data) as boolean;
  const errors = valid
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);

  return NextResponse.json({ valid, errors });
}
