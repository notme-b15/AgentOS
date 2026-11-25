import { createClient } from "@supabase/supabase-js";

// Anon key + Row Level Security: the dashboard can only read what RLS allows.
// The service_role key must NEVER be used here.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);
