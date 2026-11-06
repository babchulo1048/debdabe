import { toast } from "sonner";

import type { LetterContent } from "@/components/LetterSheet";
import { supabase } from "@/integrations/supabase/client";
import {
  asRecipient,
  asRecord,
  asStrings,
  logEvent,
  type LetterRow,
  type Org,
  type Signatory,
} from "./data";
import { buildLetterDocx, downloadBlob } from "./docx";
import { defaultSender, docxFileName, readSender } from "./letters";

export function toContent(
  l: LetterRow,
  signatories: Signatory[] | undefined,
  org: Org,
): LetterContent {
  const signatory = signatories?.find((s) => s.id === l.signatory_id) ?? null;
  return {
    referenceNo: l.reference_no,
    dateIso: l.letter_date,
    recipient: asRecipient(l.recipient),
    subject: l.subject,
    body: asStrings(l.body),
    cc: asStrings(l.cc),
    signatory,
    sender: readSender(asRecord(l.field_values), defaultSender(org, signatory)),
  };
}

export async function printLetter(letterId: string | null, orgId: string) {
  window.print();
  if (letterId) await logEvent(letterId, orgId, "printed");
}

export async function exportDocx(org: Org, content: LetterContent, letterId: string | null) {
  try {
    const blob = await buildLetterDocx(org, content);
    downloadBlob(blob, docxFileName(content.referenceNo, content.subject));
    if (letterId) await logEvent(letterId, org.id, "exported_docx");
  } catch (e) {
    toast.error(`DOCX export failed: ${(e as Error).message}`);
  }
}

/** Copy a letter into a new draft; returns the new id. */
export async function duplicateLetter(l: LetterRow, userId: string) {
  const { data, error } = await supabase
    .from("letters")
    .insert({
      organization_id: l.organization_id,
      direction: "outgoing",
      source: l.source === "incoming" ? "manual" : l.source,
      template_id: l.template_id,
      subject: l.subject,
      body: l.body,
      recipient: l.recipient,
      cc: l.cc,
      field_values: l.field_values,
      signatory_id: l.signatory_id,
      letter_date: l.letter_date,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  await logEvent(data.id, l.organization_id, "created");
  return data.id;
}
