import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug: verificar que las variables existen
  if (!url || !key) {
    console.error('❌ Missing Supabase env vars:', { url: !!url, key: !!key });
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  console.log('✅ Supabase client created with URL:', url);

  return createBrowserClient<Database>(url, key);
}

// Exportación singleton para uso directo (opcional pero recomendado)
export const supabase = createClient();