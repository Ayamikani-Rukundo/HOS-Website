import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
export const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublicKey &&
    !supabaseUrl.includes('YOUR_PROJECT') &&
    !supabasePublicKey.includes('YOUR_SUPABASE'),
);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.sessionStorage,
      },
    })
  : null;

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local, add the project URL and public anon/publishable key, then restart Vite.',
    );
  }

  return supabase;
};
