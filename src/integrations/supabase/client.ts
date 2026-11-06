// Mock mode: the app runs entirely on browser-local demo data (src/lib/mock).
// To go back to a real Supabase backend, restore the original client from git
// (`git checkout src/integrations/supabase/client.ts`).
import { mockSupabase } from "@/lib/mock/client";

export const supabase = mockSupabase;
