import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import { USING_MOCK } from "@/integrations/supabase/client";
import { DEMO_EMAIL as MOCK_EMAIL, DEMO_PASSWORD as MOCK_PASSWORD } from "@/lib/mock/seed";

/**
 * Demo account. Mock mode: built in. Real Supabase: set VITE_DEMO_PASSWORD (and sign up once
 * as demo@debdabe.app); without it the demo button is hidden.
 */
export const DEMO_EMAIL = USING_MOCK
  ? MOCK_EMAIL
  : ((import.meta.env["VITE_DEMO_EMAIL"] as string | undefined) ?? MOCK_EMAIL);
export const DEMO_PASSWORD = USING_MOCK
  ? MOCK_PASSWORD
  : ((import.meta.env["VITE_DEMO_PASSWORD"] as string | undefined) ?? "");

/** Current Supabase session; `undefined` while the first check is running. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return session;
}

/** Log into the demo organisation (always exists in mock mode). */
export async function signInDemo(): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  return error ? error.message : null;
}
