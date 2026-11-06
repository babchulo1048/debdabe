import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { asFields, isAdmin, useTemplates, type Me, type TemplateRow } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { fillTemplate, type FieldType, type TemplateField } from "@/lib/letters";

export const Route = createFileRoute("/templates")({
  ssr: false,
  head: () => ({ meta: [{ title: "Templates · Debdabe" }] }),
  component: TemplatesPage,
});

type Draft = {
  id: string | null;
  title_am: string;
  title_en: string;
  category: string;
  subject_am: string;
  body_am: string;
  fields: TemplateField[];
  is_active: boolean;
};

const EMPTY: Draft = {
  id: null,
  title_am: "",
  title_en: "",
  category: "General",
  subject_am: "",
  body_am: "",
  fields: [],
  is_active: true,
};

function toDraft(tpl: TemplateRow, copy: boolean): Draft {
  return {
    id: copy ? null : tpl.id,
    title_am: tpl.title_am,
    title_en: copy ? `${tpl.title_en} (copy)` : tpl.title_en,
    category: tpl.category,
    subject_am: tpl.subject_am,
    body_am: tpl.body_am,
    fields: asFields(tpl.fields),
    is_active: tpl.is_active,
  };
}

function TemplatesPage() {
  const { t } = useT();
  const templates = useTemplates();
  const [editing, setEditing] = useState<Draft | null>(null);
  return (
    <AppShell>
      {(me) =>
        !isAdmin(me.role) ? (
          <p className="text-muted-foreground">
            {t("Only admins can manage templates.", "አብነቶችን ማስተዳደር የሚችሉት አስተዳዳሪዎች ብቻ ናቸው።")}
          </p>
        ) : (
          <>
            <PageTitle
              title={t("Templates", "አብነቶች")}
              sub={t(
                "Built-in templates are shared by everyone; duplicate one to change it for your office.",
                "አብሮገነብ አብነቶች ለሁሉም የጋራ ናቸው፤ ለቢሮዎ ለመቀየር ይቅዱት።",
              )}
              action={
                <Button onClick={() => setEditing(EMPTY)}>
                  <Plus />
                  {t("New template", "አዲስ አብነት")}
                </Button>
              }
            />
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t("Template", "አብነት")}</th>
                    <th className="px-4 py-2 font-medium">{t("Category", "ምድብ")}</th>
                    <th className="px-4 py-2 font-medium">{t("Fields", "መስኮች")}</th>
                    <th className="px-4 py-2 font-medium">{t("Owner", "ባለቤት")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {templates.data?.map((tpl) => {
                    const global = tpl.organization_id === null;
                    return (
                      <tr
                        key={tpl.id}
                        className={`border-b last:border-0 ${tpl.is_active ? "" : "opacity-50"}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-ethiopic">{tpl.title_am}</div>
                          <div className="text-xs text-muted-foreground">{tpl.title_en}</div>
                        </td>
                        <td className="px-4 py-2.5">{tpl.category}</td>
                        <td className="px-4 py-2.5 tabular-nums">{asFields(tpl.fields).length}</td>
                        <td className="px-4 py-2.5">
                          {global ? t("Built-in", "አብሮገነብ") : t("Your office", "የእርስዎ ቢሮ")}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          {!global && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={t("Edit", "አስተካክል")}
                              onClick={() => setEditing(toDraft(tpl, false))}
                            >
                              <Pencil />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("Duplicate", "ቅዳ")}
                            onClick={() => setEditing(toDraft(tpl, true))}
                          >
                            <Copy />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {editing && <TemplateDialog me={me} draft={editing} onClose={() => setEditing(null)} />}
          </>
        )
      }
    </AppShell>
  );
}

function TemplateDialog({ me, draft, onClose }: { me: Me; draft: Draft; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(draft);
  const [sample, setSample] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setField = (i: number, patch: Partial<TemplateField>) =>
    setD((x) => ({ ...x, fields: x.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = {
      title_am: d.title_am,
      title_en: d.title_en,
      category: d.category,
      subject_am: d.subject_am,
      body_am: d.body_am,
      fields: d.fields,
      is_active: d.is_active,
    };
    const { error } = d.id
      ? await supabase.from("templates").update(row).eq("id", d.id)
      : await supabase.from("templates").insert({ ...row, organization_id: me.org.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("Template saved", "አብነቱ ተቀምጧል"));
    qc.invalidateQueries({ queryKey: ["templates"] });
    onClose();
  }

  const placeholders = Array.from(
    d.body_am.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
    (m) => m[1] ?? "",
  );
  const unknown = Array.from(
    new Set(placeholders.filter((p) => p && !d.fields.some((f) => f.key === p))),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {d.id ? t("Edit template", "አብነት አስተካክል") : t("New template", "አዲስ አብነት")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-am">{t("Title (Amharic)", "ርዕስ (አማርኛ)")}</Label>
              <Input
                id="t-am"
                required
                className="font-ethiopic"
                value={d.title_am}
                onChange={(e) => set("title_am", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-en">{t("Title (English)", "ርዕስ (እንግሊዝኛ)")}</Label>
              <Input
                id="t-en"
                value={d.title_en}
                onChange={(e) => set("title_en", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-cat">{t("Category", "ምድብ")}</Label>
              <Input
                id="t-cat"
                value={d.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-subj">{t("Subject (ጉዳዩ)", "ጉዳዩ")}</Label>
            <Input
              id="t-subj"
              className="font-ethiopic"
              value={d.subject_am}
              onChange={(e) => set("subject_am", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-body">
              {t("Body: use {{field_key}} for blanks", "ዋና ጽሑፍ፡ ለባዶ ቦታዎች {{field_key}} ይጠቀሙ")}
            </Label>
            <Textarea
              id="t-body"
              rows={6}
              className="font-ethiopic"
              value={d.body_am}
              onChange={(e) => set("body_am", e.target.value)}
            />
            {unknown.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-warning">
                {t("Placeholders without a field:", "መስክ የሌላቸው ቦታ ያዥዎች፡")}
                {unknown.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="rounded border border-warning px-1.5 py-0.5"
                    onClick={() =>
                      set("fields", [
                        ...d.fields,
                        { key: k, label_am: k, label_en: k, type: "text", required: true },
                      ])
                    }
                  >
                    + {k}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("Fields", "መስኮች")}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  set("fields", [
                    ...d.fields,
                    {
                      key: `field_${d.fields.length + 1}`,
                      label_am: "",
                      label_en: "",
                      type: "text",
                      required: true,
                    },
                  ])
                }
              >
                <Plus />
                {t("Add field", "መስክ አክል")}
              </Button>
            </div>
            {d.fields.map((f, i) => (
              <div
                key={i}
                className="grid grid-cols-2 items-center gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_1fr_7rem_auto_auto]"
              >
                <Input
                  aria-label="Key"
                  className="font-mono text-xs"
                  value={f.key}
                  onChange={(e) =>
                    setField(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })
                  }
                />
                <Input
                  aria-label={t("Amharic label", "የአማርኛ መለያ")}
                  placeholder="መለያ"
                  className="font-ethiopic"
                  value={f.label_am}
                  onChange={(e) => setField(i, { label_am: e.target.value })}
                />
                <Input
                  aria-label={t("English label", "የእንግሊዝኛ መለያ")}
                  placeholder="Label"
                  value={f.label_en}
                  onChange={(e) => setField(i, { label_en: e.target.value })}
                />
                <select
                  aria-label={t("Type", "ዓይነት")}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={f.type}
                  onChange={(e) => setField(i, { type: e.target.value as FieldType })}
                >
                  <option value="text">text</option>
                  <option value="date">date</option>
                  <option value="number">number</option>
                  <option value="money">money</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch
                    checked={f.required ?? false}
                    onCheckedChange={(v) => setField(i, { required: v })}
                  />
                  {t("Required", "ግዴታ")}
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("Remove field", "መስኩን አስወግድ")}
                  onClick={() =>
                    set(
                      "fields",
                      d.fields.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-2 rounded-md bg-muted p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Preview", "ቅድመ እይታ")}
            </span>
            {d.fields.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {d.fields.map((f) => (
                  <Input
                    key={f.key}
                    aria-label={f.label_en || f.key}
                    placeholder={f.label_am || f.key}
                    type={f.type === "date" ? "date" : f.type === "text" ? "text" : "number"}
                    className="h-8 bg-background font-ethiopic text-xs"
                    value={sample[f.key] ?? ""}
                    onChange={(e) => setSample((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                ))}
              </div>
            )}
            <p className="font-ethiopic text-sm leading-relaxed">
              <b>ጉዳዩ፡ {d.subject_am}</b>
              <br />
              {fillTemplate(d.body_am, d.fields, sample)}
            </p>
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={d.is_active} onCheckedChange={(v) => set("is_active", v)} />
              {t("Active (shown in the gallery)", "ንቁ (በማዕከለ-ስዕላቱ ይታያል)")}
            </label>
            <Button type="submit">{t("Save template", "አብነቱን አስቀምጥ")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
