import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { todayAddisIso } from "./ethiopianCalendar";
import type { Recipient, TemplateField } from "./letters";

export type Org = Tables<"organizations">;
export type LetterRow = Tables<"letters">;
export type TemplateRow = Tables<"templates">;
export type Signatory = Tables<"signatories">;
export type Contact = Tables<"contacts">;
export type Invoice = Tables<"invoices">;
export type Role = "owner" | "admin" | "writer";

// ---- JSON column helpers -------------------------------------------------

export function asStrings(v: Json | null | undefined): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function asRecipient(v: Json | null | undefined): Recipient {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, Json | undefined>;
  const r: Recipient = {};
  if (typeof o["name"] === "string") r.name = o["name"];
  if (typeof o["title"] === "string") r.title = o["title"];
  if (typeof o["city"] === "string") r.city = o["city"];
  return r;
}

export function asRecord(v: Json | null | undefined): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
  return out;
}

export function asFields(v: Json | null | undefined): TemplateField[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((f) => {
    if (!f || typeof f !== "object" || Array.isArray(f)) return [];
    const o = f as Record<string, Json | undefined>;
    if (typeof o["key"] !== "string") return [];
    const type = o["type"];
    return [
      {
        key: o["key"],
        label_am: typeof o["label_am"] === "string" ? o["label_am"] : o["key"],
        label_en: typeof o["label_en"] === "string" ? o["label_en"] : o["key"],
        type: type === "date" || type === "number" || type === "money" ? type : "text",
        required: o["required"] === true,
      },
    ];
  });
}

/** Start of the current month in Addis Ababa, as an ISO timestamp. */
export function monthStartAddis(): string {
  return `${todayAddisIso().slice(0, 7)}-01T00:00:00+03:00`;
}

// ---- Queries ---------------------------------------------------------------

export type Me = { userId: string; email: string; fullName: string; role: Role; org: Org };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me> => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) throw new Error("Not signed in");
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (pErr) throw pErr;
      const [{ data: org, error: oErr }, { data: roles }] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", profile.organization_id).single(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (oErr) throw oErr;
      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: profile.full_name ?? "",
        role: (roles?.[0]?.role as Role | undefined) ?? "writer",
        org,
      };
    },
  });
}

export function isAdmin(role: Role | undefined) {
  return role === "owner" || role === "admin";
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("templates").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useLetters(direction?: "outgoing" | "incoming", limit = 500) {
  return useQuery({
    queryKey: ["letters", direction ?? "all", limit],
    queryFn: async () => {
      let q = supabase
        .from("letters")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (direction) q = q.eq("direction", direction);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useLetter(id: string) {
  return useQuery({
    queryKey: ["letter", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("letters").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useLetterEvents(id: string) {
  return useQuery({
    queryKey: ["letter-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letter_events")
        .select("*")
        .eq("letter_id", id)
        .order("at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSignatories() {
  return useQuery({
    queryKey: ["signatories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signatories").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      if (error) throw error;
      return profiles.map((p) => ({
        ...p,
        role: (roles?.find((r) => r.user_id === p.id)?.role ?? "writer") as Role,
      }));
    },
  });
}

/** Finalized outgoing letters this month (what the plan limit counts). */
export function useMonthlyUsage() {
  return useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("letters")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outgoing")
        .eq("status", "final")
        .gte("finalized_at", monthStartAddis());
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export async function logEvent(letterId: string, orgId: string, type: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase
    .from("letter_events")
    .insert({ letter_id: letterId, organization_id: orgId, type, user_id: data.user.id });
}
