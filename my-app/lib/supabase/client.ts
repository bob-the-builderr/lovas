import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Env } from '@/lib/env';

const supabaseUrl = Env.SUPABASE_URL;
const supabaseAnonKey = Env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      // Supabase's client relies on native fetch; AsyncStorage is used only if
      // auth is enabled, which we deliberately keep off.
      headers: {},
    },
  }
);

/**
 * Lighter-weight access used throughout the app that won't throw when the
 * Supabase project has not been configured yet (e.g. during early dev).
 */
export function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.'
    );
  }
  return supabase;
}
