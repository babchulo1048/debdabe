import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/AppShell";
import { LetterSheet, ScaledSheet } from "@/components/LetterSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import {
  isAdmin,
  useContacts,
  useMembers,
  useSignatories,
  type Me,
  type Org,
  type Signatory,
} from "@/lib/data";
import { isoToEthYear, todayAddisIso } from "@/lib/ethiopianCalendar";
import { useT } from "@/lib/i18n";
import { defaultSender, formatReference } from "@/lib/letters";
import { uploadOrgFile, useSignedUrl } from "@/lib/storage";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings · Debdabe" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useT();
  return (
    <AppShell>
      {(me) =>
        !isAdmin(me.role) ? (
          <p className="text-muted-foreground">
            {t("Only admins can change settings.", "ቅንብሮችን መቀየር የሚችሉት አስተዳዳሪዎች ብቻ ናቸው።")}
          </p>
        ) : (
          <>
            <PageTitle title={t("Settings", "ቅንብሮች")} />
            <Tabs defaultValue="org">
              <TabsList className="flex-wrap">
                <TabsTrigger value="org">{t("Organisation", "ድርጅት")}</TabsTrigger>
                <TabsTrigger value="letterhead">{t("Letterhead", "የደብዳቤ ራስጌ")}</TabsTrigger>
                <TabsTrigger value="ref">{t("Reference numbers", "የደብዳቤ ቁጥሮች")}</TabsTrigger>
                <TabsTrigger value="sig">{t("Signatories", "ፈራሚዎች")}</TabsTrigger>
                <TabsTrigger value="contacts">{t("Contacts", "አድራሻዎች")}</TabsTrigger>
                <TabsTrigger value="users">{t("Users", "ተጠቃሚዎች")}</TabsTrigger>
              </TabsList>
              <TabsContent value="org" className="mt-4">
                <OrgForm org={me.org} />
              </TabsContent>
              <TabsContent value="letterhead" className="mt-4">
                <LetterheadForm me={me} />
              </TabsContent>
              <TabsContent value="ref" className="mt-4">
                <RefForm org={me.org} />
              </TabsContent>
              <TabsContent value="sig" className="mt-4">
                <Signatories me={me} />
              </TabsContent>
              <TabsContent value="contacts" className="mt-4">
                <Contacts me={me} />
              </TabsContent>
              <TabsContent value="users" className="mt-4">
                <Users />
              </TabsContent>
            </Tabs>
          </>
        )
      }
    </AppShell>
  );
}

function useUpdateOrg(orgId: string) {
  const qc = useQueryClient();
  const { t } = useT();
  return async (patch: TablesUpdate<"organizations">) => {
    const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(t("Saved", "ተቀምጧል"));
    await qc.invalidateQueries({ queryKey: ["me"] });
    return true;
  };
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid max-w-[720px] gap-4 rounded-lg border bg-card p-5">{children}</section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </div>
  );
}

function OrgForm({ org }: { org: Org }) {
  const { t } = useT();
  const update = useUpdateOrg(org.id);
  const [f, setF] = useState({
    name_am: org.name_am,
    name_en: org.name_en,
    address: org.address ?? "",
    phone: org.phone ?? "",
    email: org.email ?? "",
    tin: org.tin ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="o-am"
          label={t("Name (Amharic)", "ስም (አማርኛ)")}
          value={f.name_am}
          onChange={set("name_am")}
          className="font-ethiopic"
        />
        <TextField
          id="o-en"
          label={t("Name (English)", "ስም (እንግሊዝኛ)")}
          value={f.name_en}
          onChange={set("name_en")}
        />
        <TextField
          id="o-addr"
          label={t("Address", "አድራሻ")}
          value={f.address}
          onChange={set("address")}
        />
        <TextField id="o-phone" label={t("Phone", "ስልክ")} value={f.phone} onChange={set("phone")} />
        <TextField
          id="o-email"
          label={t("Email", "ኢሜይል")}
          value={f.email}
          onChange={set("email")}
        />
        <TextField id="o-tin" label="TIN" value={f.tin} onChange={set("tin")} />
      </div>
      <Button className="w-fit" onClick={() => update(f)}>
        {t("Save", "አስቀምጥ")}
      </Button>
    </Card>
  );
}

function ImageSlot({
  me,
  label,
  column,
  prefix,
}: {
  me: Me;
  label: string;
  column: "letterhead_header_url" | "letterhead_footer_url" | "logo_url";
  prefix: string;
}) {
  const { t } = useT();
  const update = useUpdateOrg(me.org.id);
  const url = useSignedUrl("letterheads", me.org[column]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-1">
          <Button asChild size="sm" variant="outline" disabled={busy}>
            <label className="cursor-pointer">
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              {t("Upload", "ስቀል")}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const path = await uploadOrgFile("letterheads", me.org.id, file, prefix);
                    await update({ [column]: path });
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </Button>
          {me.org[column] && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("Remove", "አስወግድ")}
              onClick={() => update({ [column]: null })}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {url ? (
        <img src={url} alt="" className="max-h-24 object-contain" />
      ) : (
        <span className="text-xs text-muted-foreground">{t("None uploaded", "ምንም አልተሰቀለም")}</span>
      )}
    </div>
  );
}

function LetterheadForm({ me }: { me: Me }) {
  const { t } = useT();
  const today = todayAddisIso();
  return (
    <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-3">
        <p className="text-sm text-muted-foreground">
          {t(
            "Upload your printed letterhead as an image (A4 width, PNG or JPG). Without one, a header is generated from your organisation details and logo.",
            "የታተመ የደብዳቤ ራስጌዎን እንደ ምስል ይስቀሉ (A4 ስፋት፣ PNG ወይም JPG)። ከሌለ ከድርጅቱ መረጃ እና አርማ ራስጌ ይፈጠራል።",
          )}
        </p>
        <ImageSlot
          me={me}
          label={t("Header image", "የራስጌ ምስል")}
          column="letterhead_header_url"
          prefix="header"
        />
        <ImageSlot
          me={me}
          label={t("Footer image (optional)", "የግርጌ ምስል (አማራጭ)")}
          column="letterhead_footer_url"
          prefix="footer"
        />
        <ImageSlot
          me={me}
          label={t("Logo (for the generated header)", "አርማ (ለሚፈጠረው ራስጌ)")}
          column="logo_url"
          prefix="logo"
        />
      </div>
      <ScaledSheet>
        <LetterSheet
          org={me.org}
          letter={{
            referenceNo: formatReference(me.org.ref_pattern, {
              prefix: me.org.ref_prefix,
              seq: 1,
              year: isoToEthYear(today),
              dept: me.org.dept ?? "",
            }),
            dateIso: today,
            recipient: { name: "[ተቀባይ]", city: "አዲስ አበባ" },
            subject: "[የደብዳቤው ጉዳይ]",
            body: ["[የደብዳቤው ዋና ጽሑፍ እዚህ ይገባል።]"],
            cc: ["ለማህደር"],
            signatory: null,
            sender: defaultSender(me.org, null),
          }}
        />
      </ScaledSheet>
    </div>
  );
}

function RefForm({ org }: { org: Org }) {
  const { t } = useT();
  const update = useUpdateOrg(org.id);
  const [f, setF] = useState({
    ref_prefix: org.ref_prefix,
    ref_pattern: org.ref_pattern,
    incoming_prefix: org.incoming_prefix,
    dept: org.dept ?? "",
    reset_yearly: org.reset_yearly,
  });
  const year = isoToEthYear(todayAddisIso());
  const example = formatReference(f.ref_pattern, {
    prefix: f.ref_prefix,
    seq: 45,
    year,
    dept: f.dept,
  });
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="r-prefix"
          label={t("Outgoing prefix", "የወጪ መነሻ")}
          value={f.ref_prefix}
          onChange={(v) => setF((x) => ({ ...x, ref_prefix: v }))}
        />
        <TextField
          id="r-in"
          label={t("Incoming prefix", "የገቢ መነሻ")}
          value={f.incoming_prefix}
          onChange={(v) => setF((x) => ({ ...x, incoming_prefix: v }))}
        />
        <TextField
          id="r-pattern"
          label={t("Pattern", "ቅርጸት")}
          value={f.ref_pattern}
          onChange={(v) => setF((x) => ({ ...x, ref_pattern: v }))}
        />
        <TextField
          id="r-dept"
          label={t("Department code ({DEPT})", "የክፍል ኮድ ({DEPT})")}
          value={f.dept}
          onChange={(v) => setF((x) => ({ ...x, dept: v }))}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Tokens:", "ምልክቶች፡")} <code>{"{PREFIX}"}</code> <code>{"{SEQ}"}</code>{" "}
        <code>{"{SEQ3}"}</code> <code>{"{ETH_YEAR}"}</code> <code>{"{DEPT}"}</code>
      </p>
      <div className="rounded-md bg-primary-soft px-3 py-2 text-sm">
        {t("Example:", "ምሳሌ፡")} <span className="font-mono font-semibold">{example}</span>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch
          checked={f.reset_yearly}
          onCheckedChange={(v) => setF((x) => ({ ...x, reset_yearly: v }))}
        />
        {t(
          "Restart numbering every Ethiopian new year (መስከረም 1)",
          "በየአዲስ ዓመቱ (መስከረም 1) ቁጥሩን እንደገና ጀምር",
        )}
      </label>
      <Button className="w-fit" onClick={() => update(f)}>
        {t("Save", "አስቀምጥ")}
      </Button>
    </Card>
  );
}

function Signatories({ me }: { me: Me }) {
  const { t } = useT();
  const qc = useQueryClient();
  const sigs = useSignatories();
  const [f, setF] = useState({ name_am: "", name_en: "", position_am: "", position_en: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("signatories")
      .insert({ ...f, organization_id: me.org.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setF({ name_am: "", name_en: "", position_am: "", position_en: "" });
    qc.invalidateQueries({ queryKey: ["signatories"] });
  }

  return (
    <div className="grid max-w-[720px] gap-4">
      {sigs.data?.map((s) => (
        <SignatoryRow key={s.id} me={me} s={s} />
      ))}
      <form onSubmit={add} className="grid gap-3 rounded-lg border border-dashed bg-card p-4">
        <h3 className="text-sm font-semibold">{t("Add signatory", "ፈራሚ አክል")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="s-nam"
            label={t("Name (Amharic)", "ስም (አማርኛ)")}
            value={f.name_am}
            onChange={(v) => setF((x) => ({ ...x, name_am: v }))}
            className="font-ethiopic"
          />
          <TextField
            id="s-nen"
            label={t("Name (English)", "ስም (እንግሊዝኛ)")}
            value={f.name_en}
            onChange={(v) => setF((x) => ({ ...x, name_en: v }))}
          />
          <TextField
            id="s-pam"
            label={t("Position (Amharic)", "ኃላፊነት (አማርኛ)")}
            value={f.position_am}
            onChange={(v) => setF((x) => ({ ...x, position_am: v }))}
            className="font-ethiopic"
          />
          <TextField
            id="s-pen"
            label={t("Position (English)", "ኃላፊነት (እንግሊዝኛ)")}
            value={f.position_en}
            onChange={(v) => setF((x) => ({ ...x, position_en: v }))}
          />
        </div>
        <Button type="submit" className="w-fit" disabled={!f.name_am}>
          <Plus />
          {t("Add", "አክል")}
        </Button>
      </form>
    </div>
  );
}

function SignatoryRow({ me, s }: { me: Me; s: Signatory }) {
  const { t } = useT();
  const qc = useQueryClient();
  const url = useSignedUrl("signatures", s.signature_url);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="font-ethiopic font-semibold">{s.name_am}</div>
        <div className="text-sm text-muted-foreground">
          <span className="font-ethiopic">{s.position_am}</span> · {s.name_en} · {s.position_en}
        </div>
      </div>
      {url && <img src={url} alt={t("Signature", "ፊርማ")} className="h-12 object-contain" />}
      <Button asChild size="sm" variant="outline">
        <label className="cursor-pointer">
          <Upload />
          {t("Signature image", "የፊርማ ምስል")}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const path = await uploadOrgFile("signatures", me.org.id, file, `sig-${s.id}`);
                const { error } = await supabase
                  .from("signatories")
                  .update({ signature_url: path })
                  .eq("id", s.id);
                if (error) throw error;
                qc.invalidateQueries({ queryKey: ["signatories"] });
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
        </label>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("Delete signatory", "ፈራሚውን ሰርዝ")}
        onClick={async () => {
          const { error } = await supabase.from("signatories").delete().eq("id", s.id);
          if (error) {
            toast.error(error.message);
            return;
          }
          qc.invalidateQueries({ queryKey: ["signatories"] });
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function Contacts({ me }: { me: Me }) {
  const { t } = useT();
  const qc = useQueryClient();
  const contacts = useContacts();
  const [f, setF] = useState({
    name: "",
    title: "",
    organization_name: "",
    city: "",
    type: "recipient" as "recipient" | "cc",
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("contacts").insert({ ...f, organization_id: me.org.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setF({ name: "", title: "", organization_name: "", city: "", type: f.type });
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }

  return (
    <div className="grid max-w-[820px] gap-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("Name", "ስም")}</th>
              <th className="px-4 py-2 font-medium">{t("Title / branch", "ማዕረግ / ቅርንጫፍ")}</th>
              <th className="px-4 py-2 font-medium">{t("City", "ከተማ")}</th>
              <th className="px-4 py-2 font-medium">{t("Used for", "ለ")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contacts.data?.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-ethiopic">
                  {c.name}
                  <div className="text-xs text-muted-foreground">{c.organization_name}</div>
                </td>
                <td className="px-4 py-2 font-ethiopic">{c.title}</td>
                <td className="px-4 py-2 font-ethiopic">{c.city}</td>
                <td className="px-4 py-2">
                  {c.type === "cc" ? t("Copy (ግልባጭ)", "ግልባጭ") : t("Recipient (ለ)", "ተቀባይ")}
                </td>
                <td className="px-2 py-2 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("Delete contact", "አድራሻውን ሰርዝ")}
                    onClick={async () => {
                      const { error } = await supabase.from("contacts").delete().eq("id", c.id);
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      qc.invalidateQueries({ queryKey: ["contacts"] });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={add}
        className="grid gap-3 rounded-lg border border-dashed bg-card p-4 sm:grid-cols-2"
      >
        <TextField
          id="c-name"
          label={t("Name", "ስም")}
          value={f.name}
          onChange={(v) => setF((x) => ({ ...x, name: v }))}
          className="font-ethiopic"
        />
        <TextField
          id="c-title"
          label={t("Title / branch", "ማዕረግ / ቅርንጫፍ")}
          value={f.title}
          onChange={(v) => setF((x) => ({ ...x, title: v }))}
          className="font-ethiopic"
        />
        <TextField
          id="c-org"
          label={t("Organisation (English, optional)", "ድርጅት (እንግሊዝኛ፣ አማራጭ)")}
          value={f.organization_name}
          onChange={(v) => setF((x) => ({ ...x, organization_name: v }))}
        />
        <TextField
          id="c-city"
          label={t("City", "ከተማ")}
          value={f.city}
          onChange={(v) => setF((x) => ({ ...x, city: v }))}
          className="font-ethiopic"
        />
        <div className="grid gap-1.5">
          <Label htmlFor="c-type">{t("Used for", "ለ")}</Label>
          <select
            id="c-type"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={f.type}
            onChange={(e) => setF((x) => ({ ...x, type: e.target.value as "recipient" | "cc" }))}
          >
            <option value="recipient">{t("Recipient (ለ)", "ተቀባይ (ለ)")}</option>
            <option value="cc">{t("Copy (ግልባጭ)", "ግልባጭ")}</option>
          </select>
        </div>
        <Button type="submit" className="w-fit self-end" disabled={!f.name}>
          <Plus />
          {t("Add contact", "አድራሻ አክል")}
        </Button>
      </form>
    </div>
  );
}

function Users() {
  const { t } = useT();
  const members = useMembers();
  return (
    <div className="grid max-w-[720px] gap-4">
      <ul className="divide-y rounded-lg border bg-card">
        {members.data?.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{m.full_name || m.email}</div>
              <div className="text-muted-foreground">{m.email}</div>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{m.role}</span>
          </li>
        ))}
      </ul>
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {t(
          "Inviting colleagues into this organisation is coming next. For now, each new sign-up creates its own organisation.",
          "የሥራ ባልደረቦችን ወደዚህ ድርጅት መጋበዝ በቅርቡ ይመጣል። ለአሁን እያንዳንዱ አዲስ ምዝገባ የራሱን ድርጅት ይፈጥራል።",
        )}
      </p>
    </div>
  );
}
