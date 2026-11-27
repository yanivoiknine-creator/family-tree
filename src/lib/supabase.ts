import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Cloud mode: the family data lives in Supabase behind Google sign-in.
 * Local mode (VITE_BACKEND=local, or no Supabase settings): the old browser-only prototype.
 */
export const CLOUD = Boolean(url && key) && import.meta.env.VITE_BACKEND !== 'local';

export const supabase: SupabaseClient | null = CLOUD
  ? createClient(url!, key!, {
      // PKCE returns ?code=… in the query string, so it never collides with our #p=… links
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null;

/** guest = not signed in, view only (never stored in the database) */
export type Role = 'guest' | 'pending' | 'member' | 'admin';

export interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  person_id: string | null;
  claim: Record<string, string> | null;
  attempts: number;
  registered_at: string | null;
  created_at: string;
}
