import { createServerFn } from "@tanstack/react-start";
import * as z from "zod/v4";

export const LetterDraftSchema = z.object({
  subject: z.string(),
  recipient: z.object({ name: z.string(), title: z.string(), city: z.string() }),
  body_paragraphs: z.array(z.string()),
  cc: z.array(z.string()),
});
export type LetterDraft = z.infer<typeof LetterDraftSchema>;

const InputSchema = z.object({
  prompt: z.string().min(3).max(4000),
  recipient: z.string().max(300).optional(),
  tone: z.enum(["formal", "very_formal"]).default("formal"),
  length: z.enum(["short", "normal"]).default("normal"),
});

const SYSTEM = `You are an expert writer of formal Ethiopian business letters in Amharic.
Write only formal, polite, correct Amharic suitable for official correspondence in Ethiopia.
Return the letter content only, matching the JSON schema:
- Do not include the date, reference number, letterhead, signature or the closing "ከሰላምታ ጋር" (the app adds them).
- "subject" is short, in the style "… ስለመጠየቅ", "… ስለመስጠት" or "… ስለማሳወቅ", without the "ጉዳዩ፡" prefix.
- "body_paragraphs" has 1–4 paragraphs.
- "recipient": the addressee's organisation or person, their title or branch, and city; use empty strings when unknown.
- "cc": copy recipients written like "ለፋይናንስ ክፍል"; an empty list when none are implied.
Never invent amounts, names, dates or reference numbers that the user did not give; write placeholders such as [ስም], [ቀን] or [መጠን] instead.`;

function mockLetter(prompt: string, recipient?: string): LetterDraft {
  return {
    subject: "ትብብር ስለመጠየቅ",
    recipient: { name: recipient || "[ተቀባይ]", title: "", city: "አዲስ አበባ" },
    body_paragraphs: [
      "ከዚህ በታች በተገለጸው ጉዳይ ላይ ትብብራችሁን ለመጠየቅ እንወዳለን።",
      `የጥያቄው ዝርዝር፡ ${prompt}`,
      "ስለምታደርጉልን ትብብር ከወዲሁ እናመሰግናለን።",
    ],
    cc: ["ለማህደር"],
  };
}

/** Draft a formal Amharic letter. Returns a demo letter when no Anthropic key is configured. */
export const generateLetter = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ letter: LetterDraft; mock: boolean }> => {
    if (!process.env["ANTHROPIC_API_KEY"]) {
      return { letter: mockLetter(data.prompt, data.recipient), mock: true };
    }

    // Loaded inside the handler so the SDK stays out of the browser bundle.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
    const client = new Anthropic();

    const userText = [
      `Request: ${data.prompt}`,
      data.recipient ? `Recipient: ${data.recipient}` : "",
      `Tone: ${data.tone === "very_formal" ? "very formal" : "formal"}`,
      `Length: ${data.length === "short" ? "short (1–2 paragraphs)" : "normal (2–4 paragraphs)"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(LetterDraftSchema) },
      messages: [{ role: "user", content: userText }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The AI declined this request. Try rephrasing it.");
    }
    if (!response.parsed_output) {
      throw new Error("The AI returned an incomplete letter. Please try again.");
    }
    return { letter: response.parsed_output, mock: false };
  });
