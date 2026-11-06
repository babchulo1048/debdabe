import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CreditCard,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { AmharicKeyboardToggle } from "@/components/AmharicKeyboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin, useMe, type Me } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type NavItem = { to: string; en: string; am: string; icon: typeof FileText; admin?: boolean };

const NAV: NavItem[] = [
  { to: "/", en: "Dashboard", am: "ዳሽቦርድ", icon: LayoutDashboard },
  { to: "/letters/new", en: "New letter", am: "አዲስ ደብዳቤ", icon: FilePlus2 },
  { to: "/register", en: "Register", am: "መዝገብ", icon: BookOpen },
  { to: "/templates", en: "Templates", am: "አብነቶች", icon: FileText, admin: true },
  { to: "/settings", en: "Settings", am: "ቅንብሮች", icon: Settings, admin: true },
  { to: "/billing", en: "Plan & billing", am: "ዕቅድ እና ክፍያ", icon: CreditCard },
];

/** Signed-in layout: redirects to /login when there is no session. */
export function AppShell({ children }: { children: (me: Me) => ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();
  const me = useMe();
  const qc = useQueryClient();
  const { lang, setLang, t } = useT();

  useEffect(() => {
    if (session === null) navigate({ to: "/login" });
  }, [session, navigate]);

  if (!session || me.isLoading) {
    return (
      <div className="mx-auto grid max-w-[1200px] gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (me.error || !me.data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl">{t("Your account isn't ready", "መለያዎ ዝግጁ አይደለም")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(me.error as Error | null)?.message}</p>
        <Button className="mt-6" onClick={() => supabase.auth.signOut()}>
          {t("Sign out", "ውጣ")}
        </Button>
      </div>
    );
  }

  const data = me.data;
  const items = NAV.filter((n) => !n.admin || isAdmin(data.role));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-primary font-ethiopic text-sm font-semibold text-primary">
              ደ
            </span>
            <span className="font-serif text-lg font-semibold">Debdabe</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Main">
            {items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-primary-soft text-foreground font-medium" }}
              >
                <n.icon className="size-4" />
                {t(n.en, n.am)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <AmharicKeyboardToggle />
            <div
              className="flex rounded-md border p-0.5 text-xs"
              role="group"
              aria-label="Language"
            >
              {(["en", "am"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`rounded px-2 py-1 ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {l === "en" ? "EN" : "አማ"}
                </button>
              ))}
            </div>
            <span className="hidden text-sm text-muted-foreground md:inline">
              {data.org.name_en || data.org.name_am}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("Sign out", "ውጣ")}
              onClick={async () => {
                await supabase.auth.signOut();
                qc.clear();
              }}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6">{children(data)}</main>
    </div>
  );
}

export function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const final = status === "final";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${final ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
    >
      {final ? t("Final", "የተጠናቀቀ") : t("Draft", "ረቂቅ")}
    </span>
  );
}

export function UsageMeter({ used, limit }: { used: number; limit: number | null }) {
  const { t } = useT();
  if (limit == null) {
    return (
      <div className="text-sm">
        <span className="font-semibold tabular-nums">{used}</span>{" "}
        {t("letters this month · Unlimited plan", "ደብዳቤዎች በዚህ ወር · ያልተገደበ")}
      </div>
    );
  }
  const pct = Math.min(100, (used / limit) * 100);
  const color = used > limit ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-success";
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span>{t("Letters finalized this month", "በዚህ ወር የተጠናቀቁ ደብዳቤዎች")}</span>
        <span className="font-semibold tabular-nums">
          {used} / {limit}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemax={limit}
      >
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
