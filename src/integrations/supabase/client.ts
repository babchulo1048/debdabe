// Real Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY are set (your own project),
// otherwise the browser-only mock (src/lib/mock) so the app still runs without a backend.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mockSupabase } from "@/lib/mock/client";
import type { Database } from "./types";

const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim();
const key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined)?.trim();

export const USING_MOCK = !(url && key);

export const supabase: SupabaseClient<Database> = USING_MOCK
  ? mockSupabase
  : createClient<Database>(url!, key!, {
      auth: {
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
