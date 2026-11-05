import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabaseConfigurationMessage =
  'Supabase is unavailable. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) for this Vercel environment, then redeploy.';

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
    throw new Error(supabaseConfigurationMessage);
  }

  return supabase;
};
