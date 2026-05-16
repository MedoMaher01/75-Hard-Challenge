import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Vite SPA: only expose VITE_* variables to the browser bundle.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  // The app renders a setup screen instead of crashing, but warn during dev.
  console.warn('Missing Supabase environment variables. Copy .env.example to .env.local and fill in your project URL and anon key.');
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Use the standard browser client — NOT @supabase/ssr which is designed for
// Next.js server-side rendering and causes incorrect cookie behaviour in a
// pure Vite SPA.
export const supabase = createSupabaseClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'missing-key',
);
