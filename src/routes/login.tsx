import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AmharicKeyboardToggle } from "@/components/AmharicKeyboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { USING_MOCK } from "@/integrations/supabase/client";
import { resetMockDb } from "@/lib/mock/client";
import { DEMO_EMAIL, DEMO_PASSWORD, signInDemo, useSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · Debdabe" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const session = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", orgEn: "", orgAm: "" });

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName, org_name: form.orgEn, org_name_am: form.orgAm },
          },
        });
        if (error) throw error;
        if (!data.session)
          toast.success(
            t("Check your email to confirm your account.", "መለያዎን ለማረጋገጥ ኢሜይልዎን ይመልከቱ።"),
          );
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    const err = await signInDemo();
    setBusy(false);
    if (err) toast.error(err);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-current font-ethiopic font-semibold">
            ደ
          </span>
          <span className="font-serif text-2xl font-semibold">Debdabe</span>
        </div>
        <div className="max-w-md">
          <p className="font-ethiopic text-3xl leading-snug">
            ደብዳቤዎን በደብዳቤ ራስጌዎ ላይ፣ ለህትመት ዝግጁ፣ በአንድ ደቂቃ።
          </p>
          <p className="mt-4 text-lg opacity-90">
            Formal Amharic letters on your letterhead, with the Ethiopian date and reference number,
            ready to print in one minute.
          </p>
        </div>
        <p className="text-sm opacity-75">ቁጥር · ቀን · ጉዳዩ · ግልባጭ — all in the right place.</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex justify-end">
            <AmharicKeyboardToggle />
          </div>
          <h1 className="text-2xl">
            {mode === "login"
              ? t("Sign in", "ግባ")
              : t("Create your office account", "የቢሮ መለያ ይፍጠሩ")}
          </h1>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === "signup" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="fullName">{t("Your name", "ስምዎ")}</Label>
                  <Input id="fullName" value={form.fullName} onChange={set("fullName")} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="orgAm">
                    {t("Organisation name (Amharic)", "የድርጅቱ ስም (አማርኛ)")}
                  </Label>
                  <Input
                    id="orgAm"
                    value={form.orgAm}
                    onChange={set("orgAm")}
                    className="font-ethiopic"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="orgEn">
                    {t("Organisation name (English)", "የድርጅቱ ስም (እንግሊዝኛ)")}
                  </Label>
                  <Input id="orgEn" value={form.orgEn} onChange={set("orgEn")} required />
                </div>
              </>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t("Email", "ኢሜይል")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">{t("Password", "የይለፍ ቃል")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                value={form.password}
                onChange={set("password")}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {mode === "login" ? t("Sign in", "ግባ") : t("Create account", "መለያ ፍጠር")}
            </Button>
          </form>

          {DEMO_PASSWORD && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("or", "ወይም")}
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" disabled={busy} onClick={demo}>
                {t("Use demo account", "የሙከራ መለያ ተጠቀም")}
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t("Demo login", "የሙከራ መግቢያ")}: <span className="font-mono">{DEMO_EMAIL}</span> /{" "}
                <span className="font-mono">{DEMO_PASSWORD}</span>
              </p>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login"
              ? t("New office?", "አዲስ ቢሮ?")
              : t("Already have an account?", "መለያ አለዎት?")}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? t("Create an account", "መለያ ይፍጠሩ") : t("Sign in", "ግባ")}
            </button>
          </p>

          {USING_MOCK && (
            <div className="mt-8 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              {t(
                "Mock mode: all data lives in this browser only.",
                "የሙከራ ሁኔታ፡ ሁሉም መረጃ በዚህ አሳሽ ውስጥ ብቻ ይቀመጣል።",
              )}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  resetMockDb();
                  toast.success(t("Demo data reset", "የሙከራ መረጃው ታድሷል"));
                }}
              >
                {t("Reset demo data", "የሙከራ መረጃውን አድስ")}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
