import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = (import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL) as
  | string
  | undefined;
const supabaseKey = (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

if (!supabaseUrl || !supabaseKey) {
  // The app still renders a setup screen, but logging helps during local development.
  console.warn('Missing Supabase environment variables. Copy .env.example to .env.local.');
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const createClient = () => createBrowserClient(supabaseUrl ?? 'https://example.supabase.co', supabaseKey ?? 'missing-key');

export const supabase = createClient();
