import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    // Debug info (only in development)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.error('[Supabase] Missing env vars:', {
        hasUrl: !!url,
        hasKey: !!key,
        urlLength: url?.length || 0,
        keyLength: key?.length || 0,
      });
    }
    
    throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
  }

  return createBrowserClient(url, key);
}

