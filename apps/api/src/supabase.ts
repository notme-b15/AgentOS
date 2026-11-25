import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Service-role client: bypasses RLS. Backend only, never ship this key elsewhere.
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
