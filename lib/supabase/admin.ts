import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service_role key — only for server-side admin operations
 * (creating/deleting auth users). Never expose to the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
