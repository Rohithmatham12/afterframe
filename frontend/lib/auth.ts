import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'local-auth-only';
export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (input, init) => {
      if (
        process.env.NEXT_PUBLIC_AUTH_DIRECT === 'true' &&
        typeof input === 'string' &&
        input.startsWith(url + '/auth/v1/')
      )
        return fetch(input.replace(url + '/auth/v1/', url + '/'), init);
      return fetch(input, init);
    },
  },
});
