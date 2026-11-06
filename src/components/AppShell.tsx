import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CreditCard,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AmharicKeyboardToggle } from "@/components/AmharicKeyboard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  async function signOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    qc.clear();
  }

  const langSwitch = (
    <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Language">
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
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 lg:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-primary font-ethiopic text-sm font-semibold text-primary">
              ደ
            </span>
            <span className="font-serif text-lg font-semibold">Debdabe</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
            {items.map((n) => (
              <NavLink key={n.to} item={n} label={t(n.en, n.am)} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <div className="hidden sm:block">
              <AmharicKeyboardToggle />
            </div>
            {langSwitch}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              aria-label={t("Sign out", "ውጣ")}
              title={t("Sign out", "ውጣ")}
              onClick={signOut}
            >
              <LogOut />
            </Button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label={t("Menu", "ማውጫ")}
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-72 flex-col gap-4 p-5">
                <SheetTitle className="font-serif">Debdabe</SheetTitle>
                <p className="-mt-3 truncate text-sm text-muted-foreground">
                  {data.org.name_en || data.org.name_am}
                </p>
                <nav className="grid gap-1" aria-label="Main">
                  {items.map((n) => (
                    <NavLink
                      key={n.to}
                      item={n}
                      label={t(n.en, n.am)}
                      onClick={() => setMenuOpen(false)}
                    />
                  ))}
                </nav>
                <div className="sm:hidden">
                  <AmharicKeyboardToggle />
                </div>
                <Button variant="outline" className="mt-auto" onClick={signOut}>
                  <LogOut /> {t("Sign out", "ውጣ")}
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-6">{children(data)}</main>
    </div>
  );
}

function NavLink({ item, label, onClick }: { item: NavItem; label: string; onClick?: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      activeOptions={{ exact: item.to === "/" }}
      className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-primary-soft text-foreground font-medium" }}
    >
      <item.icon className="size-4" />
      {label}
    </Link>
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
