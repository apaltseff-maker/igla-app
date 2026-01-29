'use client';

import { useEffect } from 'react';

export function PreconnectSupabase() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    try {
      const origin = new URL(url).origin;
      if (document.querySelector(`link[href="${origin}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
