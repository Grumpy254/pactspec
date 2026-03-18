import { NextRequest, NextResponse } from 'next/server';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

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
