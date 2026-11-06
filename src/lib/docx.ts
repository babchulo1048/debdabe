import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type IRunOptions,
} from "docx";

import { supabase } from "@/integrations/supabase/client";
import { signatureFor, type LetterContent } from "@/components/LetterSheet";
import type { Org } from "./data";
import { isoToEthiopianString } from "./ethiopianCalendar";

const FONT = { ascii: "Nyala", hAnsi: "Nyala", eastAsia: "Nyala", cs: "Nyala" };
const SIZE = 24; // half-points = 12pt

function run(text: string, opts: Omit<IRunOptions, "text"> = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts });
}

async function loadImage(bucket: "letterheads" | "signatures", path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).download(path);
  if (!data) return null;
  const type = data.type.includes("png") ? "png" : data.type.includes("gif") ? "gif" : "jpg";
  const buf = new Uint8Array(await data.arrayBuffer());
  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 600, h: 120 });
    img.src = URL.createObjectURL(data);
  });
  return { buf, type: type as "png" | "gif" | "jpg", ...dims };
}

function imageParagraph(
  img: { buf: Uint8Array; type: "png" | "gif" | "jpg"; w: number; h: number },
  maxW: number,
  maxH: number,
) {
  const s = Math.min(maxW / img.w, maxH / img.h, 1);
  return new Paragraph({
    children: [
      new ImageRun({
        type: img.type,
        data: img.buf,
        transformation: { width: Math.round(img.w * s), height: Math.round(img.h * s) },
      }),
    ],
  });
}

export async function buildLetterDocx(org: Org, l: LetterContent): Promise<Blob> {
  const [header, footer, signature] = await Promise.all([
    loadImage("letterheads", org.letterhead_header_url),
    loadImage("letterheads", org.letterhead_footer_url),
    loadImage("signatures", signatureFor(l)),
  ]);

  const children: Paragraph[] = [];

  if (header) {
    children.push(imageParagraph(header, 600, 140));
  } else {
    children.push(
      new Paragraph({
        children: [run(l.sender.org_name_am, { bold: true, size: 28, color: "23305A" })],
      }),
      new Paragraph({
        border: { bottom: { style: "single", size: 12, color: "23305A", space: 4 } },
        children: [
          run(
            [
              l.sender.org_name_en,
              l.sender.address,
              l.sender.phone,
              l.sender.email,
              l.sender.tin && `TIN: ${l.sender.tin}`,
            ]
              .filter(Boolean)
              .join(" · "),
            {
              size: 18,
              color: "23305A",
            },
          ),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 240 },
      children: [run(`ቁጥር፡ ${l.referenceNo ?? "________"}`)],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [run(`ቀን፡ ${isoToEthiopianString(l.dateIso)}`)],
    }),
    new Paragraph({ spacing: { before: 240 }, children: [run(`ለ፡ ${l.recipient.name ?? ""}`)] }),
  );
  if (l.recipient.title) children.push(new Paragraph({ children: [run(l.recipient.title)] }));
  if (l.recipient.city)
    children.push(new Paragraph({ children: [run(l.recipient.city, { underline: {} })] }));

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [run("ጉዳዩ፡ ", { bold: true }), run(l.subject, { bold: true, underline: {} })],
    }),
  );

  for (const p of l.body.filter((x) => x.trim())) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        spacing: { after: 160, line: 360 },
        children: [run(p)],
      }),
    );
  }

  children.push(
    new Paragraph({
      indent: { left: 5200 },
      spacing: { before: 360 },
      keepNext: true,
      children: [run("ከሰላምታ ጋር")],
    }),
  );
  if (signature) {
    const p = imageParagraph(signature, 160, 60);
    children.push(new Paragraph({ indent: { left: 4400 }, keepNext: true, children: [] }), p);
  }
  children.push(
    new Paragraph({
      indent: { left: 4400 },
      keepNext: true,
      tabStops: [{ type: TabStopType.LEFT, position: 4400 }],
      children: [run(l.sender.signer_name, { bold: true })],
    }),
    new Paragraph({
      indent: { left: 4400 },
      keepNext: true,
      children: [run(l.sender.signer_position)],
    }),
  );

  if (l.cc.length) {
    children.push(
      new Paragraph({
        spacing: { before: 360 },
        keepNext: true,
        children: [run("ግልባጭ፡", { size: 22 })],
      }),
    );
    l.cc.forEach((c) =>
      children.push(
        new Paragraph({ indent: { left: 360 }, children: [run(`– ${c}`, { size: 22 })] }),
      ),
    );
  }

  if (footer) children.push(imageParagraph(footer, 600, 100));

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 in twips
            margin: { top: 1020, bottom: 1020, left: 1134, right: 1134 }, // 18mm / 20mm
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
