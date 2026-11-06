import { createFileRoute, Link } from "@tanstack/react-router";
import { FilePlus2, Inbox, Sparkles } from "lucide-react";

import { AppShell, PageTitle, StatusBadge, UsageMeter } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { asRecipient, useLetters, useMonthlyUsage } from "@/lib/data";
import { formatGregorian, isoToEthiopianString, todayAddisIso } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { PLANS } from "@/lib/letters";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { t } = useT();
  const letters = useLetters(undefined, 10);
  const usage = useMonthlyUsage();
  const today = todayAddisIso();

  return (
    <AppShell>
      {(me) => {
        const plan = PLANS[me.org.plan];
        const name = me.fullName || me.email.split("@")[0];
        return (
          <>
            <PageTitle
              title={t(`Welcome, ${name}`, `እንኳን ደህና መጡ፣ ${name}`)}
              sub={`${formatGregorian(today)} · ${isoToEthiopianString(today)}`}
            />

            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <section className="grid gap-4 rounded-lg border bg-card p-5">
                <h2 className="text-lg">{t("Quick actions", "ፈጣን ተግባራት")}</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <QuickAction
                    to="/letters/new"
                    icon={<FilePlus2 />}
                    title={t("New letter from template", "ከአብነት አዲስ ደብዳቤ")}
                  />
                  <QuickAction
                    to="/letters/new"
                    search={{ tab: "ai" }}
                    icon={<Sparkles />}
                    title={t("Write with AI", "በAI ይጻፉ")}
                  />
                  <QuickAction
                    to="/register"
                    search={{ incoming: "1" }}
                    icon={<Inbox />}
                    title={t("Register incoming letter", "ገቢ ደብዳቤ መዝግብ")}
                  />
                </div>
              </section>
              <section className="grid content-start gap-4 rounded-lg border bg-card p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg">{t("This month", "በዚህ ወር")}</h2>
                  <Link to="/billing" className="text-sm text-primary hover:underline">
                    {plan.name} {t("plan", "ዕቅድ")}
                  </Link>
                </div>
                {usage.isLoading ? (
                  <Skeleton className="h-10" />
                ) : (
                  <UsageMeter used={usage.data ?? 0} limit={plan.limit} />
                )}
              </section>
            </div>

            <section className="mt-6 rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="text-lg">{t("Recent letters", "የቅርብ ጊዜ ደብዳቤዎች")}</h2>
                <Link to="/register" className="text-sm text-primary hover:underline">
                  {t("Open register", "መዝገቡን ክፈት")}
                </Link>
              </div>
              {letters.isLoading ? (
                <div className="grid gap-2 p-5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : letters.data?.length ? (
                <ul className="divide-y">
                  {letters.data.map((l) => (
                    <li key={l.id}>
                      <Link
                        to={l.status === "draft" ? "/letters/$id/edit" : "/letters/$id"}
                        params={{ id: l.id }}
                        className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-accent/50 sm:grid-cols-[7rem_1fr_12rem_auto]"
                      >
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {l.reference_no ?? "—"}
                        </span>
                        <span className="min-w-0 truncate font-ethiopic">
                          {l.direction === "incoming" ? "↘ " : ""}
                          {l.subject}
                          <span className="ml-2 text-sm text-muted-foreground">
                            {asRecipient(l.recipient).name}
                          </span>
                        </span>
                        <span className="hidden font-ethiopic text-sm text-muted-foreground sm:block">
                          {isoToEthiopianString(l.letter_date)}
                        </span>
                        <StatusBadge status={l.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {t("No letters yet. Start with a template.", "እስካሁን ደብዳቤ የለም። በአብነት ይጀምሩ።")}
                </p>
              )}
            </section>
          </>
        );
      }}
    </AppShell>
  );
}

function QuickAction({
  to,
  search,
  icon,
  title,
}: {
  to: "/letters/new" | "/register";
  search?: Record<string, string>;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="flex items-center gap-3 rounded-md border p-4 text-sm font-medium transition-colors hover:border-primary hover:bg-primary-soft [&_svg]:size-5 [&_svg]:text-primary"
    >
      {icon}
      {title}
    </Link>
  );
}
