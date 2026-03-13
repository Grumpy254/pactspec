import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Try by UUID first, then by spec_id
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  const { data, error } = isUuid
    ? await supabase.from('agents').select('*, skills(*)').eq('id', id).single()
    : await supabase.from('agents').select('*, skills(*)').eq('spec_id', decodeURIComponent(id)).single();

  if (error || !data) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ agent: data });
}
