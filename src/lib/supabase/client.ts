import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseConfig } from "@/lib/supabase/config";

export { isSupabaseConfigured };

export function createClient() {
  if (!supabaseConfig) return null;
  return createBrowserClient(supabaseConfig.url, supabaseConfig.key);
}
