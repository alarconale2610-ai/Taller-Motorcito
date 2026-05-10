import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('branches').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'down' }, { status: 503 });
  }
}