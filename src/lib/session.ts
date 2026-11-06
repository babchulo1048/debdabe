import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/mock/seed";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/mock/seed";

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
