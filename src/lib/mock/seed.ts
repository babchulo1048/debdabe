/**
 * Demo data for the mock backend. Mirrors the seed in drizzle/migrations/0000.
 * Dates are relative to "now" so the dashboard always looks current.
 */

export type Row = Record<string, unknown>;
export type MockUser = { id: string; email: string; password: string; full_name: string };
export type MockDb = {
  version: number;
  users: MockUser[];
  files: Record<string, { type: string; dataUrl: string }>;
  tables: Record<string, Row[]>;
};

export const DB_VERSION = 1;
export const DEMO_ORG = "00000000-0000-0000-0000-0000000000d1";
export const DEMO_USER = "00000000-0000-0000-0000-0000000005e1";
export const DEMO_EMAIL = "demo@debdabe.app";
export const DEMO_PASSWORD = "demo";

const SIG_GM = "00000000-0000-0000-0000-00000000a501";
const SIG_HR = "00000000-0000-0000-0000-00000000a502";
const T = (n: number) => `00000000-0000-0000-0000-0000000007e${n}`;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function dateOnly(iso: string) {
  return iso.slice(0, 10);
}
function monthStart(offset: number) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}

export function buildSeed(): MockDb {
  const created = daysAgo(60);

  const templates: Row[] = [
    {
      id: T(1),
      title_am: "የሥራ ልምድ ማረጋገጫ",
      title_en: "Work experience confirmation",
      category: "HR",
      subject_am: "የሥራ ልምድ ማረጋገጫ ስለመስጠት",
      body_am:
        "{{title}} {{employee_name}} በድርጅታችን ከ{{start_date}} ጀምሮ በ{{position}} የሥራ መደብ ላይ በወር ብር {{salary}} ደመወዝ እየተከፈላቸው በማገልገል ላይ መሆናቸውን እየገለጽን፣ ይህ የሥራ ልምድ ማረጋገጫ በጠየቁት መሠረት የተሰጠ መሆኑን እናሳውቃለን።",
      fields: [
        {
          key: "title",
          label_am: "መጠሪያ (አቶ/ወ/ሮ/ወ/ሪት)",
          label_en: "Title",
          type: "text",
          required: true,
        },
        {
          key: "employee_name",
          label_am: "የሠራተኛ ስም",
          label_en: "Employee name",
          type: "text",
          required: true,
        },
        {
          key: "start_date",
          label_am: "የተቀጠሩበት ቀን",
          label_en: "Start date",
          type: "date",
          required: true,
        },
        {
          key: "position",
          label_am: "የሥራ መደብ",
          label_en: "Position",
          type: "text",
          required: true,
        },
        { key: "salary", label_am: "ደመወዝ", label_en: "Salary", type: "money", required: true },
      ],
    },
    {
      id: T(2),
      title_am: "የደመወዝ ማረጋገጫ",
      title_en: "Salary confirmation (for a bank)",
      category: "HR / Banking",
      subject_am: "የደመወዝ ማረጋገጫ ስለመስጠት",
      body_am:
        "{{title}} {{employee_name}} በድርጅታችን በ{{position}} የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር {{gross_salary}} መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለ{{purpose}} እንዲያገለግል የተሰጠ ነው።",
      fields: [
        { key: "title", label_am: "መጠሪያ", label_en: "Title", type: "text", required: true },
        {
          key: "employee_name",
          label_am: "የሠራተኛ ስም",
          label_en: "Employee name",
          type: "text",
          required: true,
        },
        {
          key: "position",
          label_am: "የሥራ መደብ",
          label_en: "Position",
          type: "text",
          required: true,
        },
        {
          key: "gross_salary",
          label_am: "ጠቅላላ ደመወዝ",
          label_en: "Gross salary",
          type: "money",
          required: true,
        },
        { key: "purpose", label_am: "ዓላማ", label_en: "Purpose", type: "text", required: true },
      ],
    },
    {
      id: T(3),
      title_am: "የስብሰባ ጥሪ",
      title_en: "Meeting invitation",
      category: "Administration",
      subject_am: "የስብሰባ ጥሪ",
      body_am:
        "{{meeting_topic}}ን አስመልክቶ {{meeting_date}} {{meeting_time}} ሰዓት በ{{venue}} ስብሰባ ስለሚካሄድ፣ በስብሰባው ላይ እንድትገኙልን በአክብሮት እንጠይቃለን።",
      fields: [
        {
          key: "meeting_topic",
          label_am: "የስብሰባው ርዕስ",
          label_en: "Meeting topic",
          type: "text",
          required: true,
        },
        { key: "meeting_date", label_am: "ቀን", label_en: "Date", type: "date", required: true },
        { key: "meeting_time", label_am: "ሰዓት", label_en: "Time", type: "text", required: true },
        { key: "venue", label_am: "ቦታ", label_en: "Venue", type: "text", required: true },
      ],
    },
    {
      id: T(4),
      title_am: "የዓመት ፈቃድ ጥያቄ",
      title_en: "Annual leave request",
      category: "HR",
      subject_am: "የዓመት ፈቃድ ስለመጠየቅ",
      body_am:
        "እኔ {{employee_name}} በ{{department}} ክፍል በ{{position}} የሥራ መደብ ላይ የምሠራ ሲሆን፣ ከ{{from_date}} እስከ {{to_date}} ድረስ ለ{{days}} ቀናት የዓመት ፈቃዴን እንድወስድ እንዲፈቀድልኝ በአክብሮት እጠይቃለሁ።",
      fields: [
        {
          key: "employee_name",
          label_am: "ስም",
          label_en: "Employee name",
          type: "text",
          required: true,
        },
        {
          key: "department",
          label_am: "ክፍል",
          label_en: "Department",
          type: "text",
          required: true,
        },
        {
          key: "position",
          label_am: "የሥራ መደብ",
          label_en: "Position",
          type: "text",
          required: true,
        },
        { key: "from_date", label_am: "ከ", label_en: "From", type: "date", required: true },
        { key: "to_date", label_am: "እስከ", label_en: "To", type: "date", required: true },
        { key: "days", label_am: "የቀናት ብዛት", label_en: "Days", type: "number", required: true },
      ],
    },
    {
      id: T(5),
      title_am: "የዋጋ ማቅረቢያ ጥያቄ",
      title_en: "Request for quotation",
      category: "Procurement",
      subject_am: "የዋጋ ማቅረቢያ ስለመጠየቅ",
      body_am:
        "ድርጅታችን {{items}} ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ {{deadline}} ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።",
      fields: [
        { key: "items", label_am: "የሚገዙ እቃዎች", label_en: "Items", type: "text", required: true },
        {
          key: "deadline",
          label_am: "የመጨረሻ ቀን",
          label_en: "Deadline",
          type: "date",
          required: true,
        },
      ],
    },
    {
      id: T(6),
      title_am: "የክፍያ ጥያቄ",
      title_en: "Payment request",
      category: "Finance",
      subject_am: "ክፍያ ስለመጠየቅ",
      body_am:
        "በ{{invoice_date}} በደረሰኝ ቁጥር {{invoice_number}} የተጠየቀው ብር {{amount}} እስካሁን ያልተከፈለ በመሆኑ፣ ክፍያውን እስከ {{due_date}} ድረስ እንድትፈጽሙልን በአክብሮት እንጠይቃለን።",
      fields: [
        {
          key: "invoice_date",
          label_am: "የደረሰኝ ቀን",
          label_en: "Invoice date",
          type: "date",
          required: true,
        },
        {
          key: "invoice_number",
          label_am: "የደረሰኝ ቁጥር",
          label_en: "Invoice number",
          type: "text",
          required: true,
        },
        { key: "amount", label_am: "መጠን", label_en: "Amount", type: "money", required: true },
        {
          key: "due_date",
          label_am: "የክፍያ ቀን",
          label_en: "Due date",
          type: "date",
          required: true,
        },
      ],
    },
  ].map((t, i) => ({ organization_id: null, is_active: true, created_at: daysAgo(90 - i), ...t }));

  type Out = [
    number,
    string | null,
    number,
    string,
    Row,
    string[],
    string[],
    string,
    "final" | "draft",
  ];
  const out: Out[] = [
    [
      2,
      "NT/038/2019",
      28,
      "የደመወዝ ማረጋገጫ ስለመስጠት",
      { name: "የኢትዮጵያ ንግድ ባንክ", title: "ቦሌ ቅርንጫፍ", city: "አዲስ አበባ" },
      [
        "አቶ አበበ ከበደ በድርጅታችን በሂሳብ ሠራተኛ የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር 18,500.00 መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለብድር አገልግሎት እንዲያገለግል የተሰጠ ነው።",
      ],
      ["ለሰው ሀብት አስተዳደር ክፍል", "ለማህደር"],
      SIG_HR,
      "final",
    ],
    [
      1,
      "NT/039/2019",
      24,
      "የሥራ ልምድ ማረጋገጫ ስለመስጠት",
      { name: "ለሚመለከተው ሁሉ", title: "", city: "አዲስ አበባ" },
      [
        "ወ/ሮ ትዕግሥት አለሙ በድርጅታችን ከመስከረም 1 ቀን 2015 ዓ.ም ጀምሮ በሽያጭ ባለሙያ የሥራ መደብ ላይ በወር ብር 12,000.00 ደመወዝ እየተከፈላቸው በማገልገል ላይ መሆናቸውን እየገለጽን፣ ይህ የሥራ ልምድ ማረጋገጫ በጠየቁት መሠረት የተሰጠ መሆኑን እናሳውቃለን።",
      ],
      ["ለማህደር"],
      SIG_HR,
      "final",
    ],
    [
      5,
      "NT/040/2019",
      20,
      "የዋጋ ማቅረቢያ ስለመጠየቅ",
      { name: "ናሙና አቅራቢ ኃ.የተ.የግ.ማ", title: "", city: "አዲስ አበባ" },
      [
        "ድርጅታችን 20 የቢሮ ኮምፒውተሮች ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ ጥቅምት 30 ቀን 2019 ዓ.ም ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።",
      ],
      ["ለፋይናንስ ክፍል"],
      SIG_GM,
      "final",
    ],
    [
      3,
      "NT/041/2019",
      15,
      "የስብሰባ ጥሪ",
      { name: "ለሁሉም የክፍል ኃላፊዎች", title: "", city: "" },
      [
        "የ2019 ዓ.ም የመጀመሪያ ሩብ ዓመት ዕቅድ አፈጻጸም ግምገማን አስመልክቶ ጥቅምት 20 ቀን 2019 ዓ.ም 3:00 ሰዓት በዋናው መሰብሰቢያ አዳራሽ ስብሰባ ስለሚካሄድ፣ በስብሰባው ላይ እንድትገኙልን በአክብሮት እንጠይቃለን።",
      ],
      ["ለማህደር"],
      SIG_GM,
      "final",
    ],
    [
      6,
      "NT/042/2019",
      9,
      "ክፍያ ስለመጠየቅ",
      { name: "ናሙና አቅራቢ ኃ.የተ.የግ.ማ", title: "", city: "አዲስ አበባ" },
      [
        "በመስከረም 15 ቀን 2019 ዓ.ም በደረሰኝ ቁጥር 00451 የተጠየቀው ብር 45,000.00 እስካሁን ያልተከፈለ በመሆኑ፣ ክፍያውን እስከ ጥቅምት 28 ቀን 2019 ዓ.ም ድረስ እንድትፈጽሙልን በአክብሮት እንጠይቃለን።",
      ],
      ["ለፋይናንስ ክፍል", "ለማህደር"],
      SIG_GM,
      "final",
    ],
    [
      2,
      "NT/043/2019",
      4,
      "የደመወዝ ማረጋገጫ ስለመስጠት",
      { name: "የኢትዮጵያ ንግድ ባንክ", title: "ቦሌ ቅርንጫፍ", city: "አዲስ አበባ" },
      [
        "ወ/ሪት ሰላም ተስፋዬ በድርጅታችን በአስተዳደር ሠራተኛ የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር 14,200.00 መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለሂሳብ መክፈቻ እንዲያገለግል የተሰጠ ነው።",
      ],
      ["ለሰው ሀብት አስተዳደር ክፍል"],
      SIG_HR,
      "final",
    ],
    [
      4,
      null,
      2,
      "የዓመት ፈቃድ ስለመጠየቅ",
      { name: "የሰው ሀብት አስተዳደር ክፍል", title: "", city: "" },
      [
        "እኔ [ስም] በ[ክፍል] ክፍል በ[የሥራ መደብ] የሥራ መደብ ላይ የምሠራ ሲሆን፣ ከ[ቀን] እስከ [ቀን] ድረስ ለ[ቀናት] ቀናት የዓመት ፈቃዴን እንድወስድ እንዲፈቀድልኝ በአክብሮት እጠይቃለሁ።",
      ],
      [],
      SIG_HR,
      "draft",
    ],
    [
      5,
      null,
      1,
      "የዋጋ ማቅረቢያ ስለመጠየቅ",
      { name: "ናሙና አቅራቢ ኃ.የተ.የግ.ማ", title: "", city: "አዲስ አበባ" },
      [
        "ድርጅታችን የቢሮ ወንበሮች ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ [ቀን] ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።",
      ],
      ["ለፋይናንስ ክፍል"],
      SIG_GM,
      "draft",
    ],
  ];

  const letters: Row[] = out.map(
    ([tpl, ref, ago, subject, recipient, body, cc, sig, status], i) => ({
      id: `00000000-0000-0000-0000-00000000b${String(i).padStart(3, "0")}`,
      organization_id: DEMO_ORG,
      direction: "outgoing",
      template_id: T(tpl),
      source: "template",
      reference_no: ref,
      sequence_no: ref ? Number(ref.split("/")[1]) : null,
      eth_year: ref ? 2019 : null,
      letter_date: dateOnly(daysAgo(ago)),
      subject,
      recipient,
      body,
      cc,
      field_values: {},
      signatory_id: sig,
      status,
      sender: null,
      their_reference: null,
      assigned_to: null,
      created_by: DEMO_USER,
      finalized_at: status === "final" ? daysAgo(ago) : null,
      file_url: null,
      ai_prompt: null,
      ai_output: null,
      edit_ratio: null,
      created_at: daysAgo(ago),
      updated_at: daysAgo(ago),
    }),
  );

  const incoming: [string, number, string, string, string, string][] = [
    [
      "IN/012/2019",
      22,
      "የሠራተኛ ደመወዝ ማረጋገጫ ጥያቄ",
      "የኢትዮጵያ ንግድ ባንክ — ቦሌ ቅርንጫፍ",
      "CBE/BL/2231/19",
      "ወ/ሮ ሔለን ገብሩ",
    ],
    ["IN/013/2019", 12, "የ2018 ዓ.ም የግብር ማሳወቂያ ማስታወሻ", "የገቢዎች ሚኒስቴር", "MoR/7781/19", "አቶ ሰለሞን ታደሰ"],
    ["IN/014/2019", 3, "የዋጋ ማቅረቢያ ምላሽ", "ናሙና አቅራቢ ኃ.የተ.የግ.ማ", "NS/104/19", "አቶ ሰለሞን ታደሰ"],
  ];
  incoming.forEach(([ref, ago, subject, sender, theirRef, assigned], i) =>
    letters.push({
      id: `00000000-0000-0000-0000-00000000c${String(i).padStart(3, "0")}`,
      organization_id: DEMO_ORG,
      direction: "incoming",
      template_id: null,
      source: "incoming",
      reference_no: ref,
      sequence_no: Number(ref.split("/")[1]),
      eth_year: 2019,
      letter_date: dateOnly(daysAgo(ago)),
      subject,
      recipient: { name: sender },
      body: [],
      cc: [],
      field_values: {},
      signatory_id: null,
      status: "final",
      sender,
      their_reference: theirRef,
      assigned_to: assigned,
      created_by: DEMO_USER,
      finalized_at: daysAgo(ago),
      file_url: null,
      ai_prompt: null,
      ai_output: null,
      edit_ratio: null,
      created_at: daysAgo(ago),
      updated_at: daysAgo(ago),
    }),
  );

  const letter_events: Row[] = [];
  for (const l of letters) {
    letter_events.push({
      id: crypto.randomUUID(),
      letter_id: l["id"],
      organization_id: DEMO_ORG,
      type: "created",
      user_id: DEMO_USER,
      at: l["created_at"],
    });
    if (l["direction"] === "outgoing" && l["status"] === "final")
      letter_events.push({
        id: crypto.randomUUID(),
        letter_id: l["id"],
        organization_id: DEMO_ORG,
        type: "finalized",
        user_id: DEMO_USER,
        at: l["finalized_at"],
      });
  }

  const invoices: Row[] = [3, 2, 1].map((back) => {
    const start = monthStart(-back);
    const end = new Date(monthStart(-back + 1).getTime() - 86_400_000);
    const paid = back > 1;
    return {
      id: crypto.randomUUID(),
      organization_id: DEMO_ORG,
      number: `INV-${start.toISOString().slice(0, 7).replace("-", "")}`,
      period_start: dateOnly(start.toISOString()),
      period_end: dateOnly(end.toISOString()),
      plan: "office",
      amount: 1500,
      vat: 225,
      total: 1725,
      status: paid ? "paid" : "unpaid",
      paid_at: paid
        ? new Date(monthStart(-back + 1).getTime() + 4 * 86_400_000).toISOString()
        : null,
    };
  });

  const contact = (
    name: string,
    title: string,
    org: string,
    city: string,
    type: string,
    i: number,
  ) => ({
    id: crypto.randomUUID(),
    organization_id: DEMO_ORG,
    name,
    title,
    organization_name: org,
    city,
    type,
    created_at: daysAgo(80 - i),
  });

  return {
    version: DB_VERSION,
    users: [
      { id: DEMO_USER, email: DEMO_EMAIL, password: DEMO_PASSWORD, full_name: "Demo Secretary" },
    ],
    files: {},
    tables: {
      organizations: [
        {
          id: DEMO_ORG,
          name_am: "ናሙና ትሬዲንግ ኃ.የተ.የግ.ማ",
          name_en: "Namuna Trading PLC (Demo)",
          address: "Bole Sub-City, Addis Ababa",
          phone: "+251 11 000 0000",
          email: "info@namuna-demo.et",
          tin: "0000000000 (demo)",
          logo_url: null,
          letterhead_header_url: null,
          letterhead_footer_url: null,
          ref_prefix: "NT",
          ref_pattern: "{PREFIX}/{SEQ3}/{ETH_YEAR}",
          incoming_prefix: "IN",
          dept: "",
          reset_yearly: true,
          plan: "office",
          created_at: created,
        },
      ],
      profiles: [
        {
          id: DEMO_USER,
          organization_id: DEMO_ORG,
          full_name: "Demo Secretary",
          email: DEMO_EMAIL,
          created_at: created,
        },
      ],
      user_roles: [
        { id: crypto.randomUUID(), user_id: DEMO_USER, organization_id: DEMO_ORG, role: "owner" },
      ],
      reference_counters: [
        { organization_id: DEMO_ORG, direction: "outgoing", eth_year: 2019, last_seq: 43 },
        { organization_id: DEMO_ORG, direction: "incoming", eth_year: 2019, last_seq: 14 },
      ],
      signatories: [
        {
          id: SIG_GM,
          organization_id: DEMO_ORG,
          name_am: "አቶ ሰለሞን ታደሰ",
          name_en: "Ato Solomon Tadesse",
          position_am: "ዋና ሥራ አስኪያጅ",
          position_en: "General Manager",
          signature_url: null,
          created_at: daysAgo(85),
        },
        {
          id: SIG_HR,
          organization_id: DEMO_ORG,
          name_am: "ወ/ሮ ሔለን ገብሩ",
          name_en: "W/ro Helen Gebru",
          position_am: "የሰው ሀብት አስተዳደር ኃላፊ",
          position_en: "Head of Human Resources",
          signature_url: null,
          created_at: daysAgo(84),
        },
      ],
      contacts: [
        contact(
          "የኢትዮጵያ ንግድ ባንክ",
          "ቦሌ ቅርንጫፍ",
          "Commercial Bank of Ethiopia, Bole Branch",
          "አዲስ አበባ",
          "recipient",
          0,
        ),
        contact("የገቢዎች ሚኒስቴር", "", "Ministry of Revenues", "አዲስ አበባ", "recipient", 1),
        contact("ናሙና አቅራቢ ኃ.የተ.የግ.ማ", "", "Namuna Supplier PLC (demo)", "አዲስ አበባ", "recipient", 2),
        contact("ለሰው ሀብት አስተዳደር ክፍል", "", "", "", "cc", 3),
        contact("ለፋይናንስ ክፍል", "", "", "", "cc", 4),
        contact("ለማህደር", "", "", "", "cc", 5),
      ],
      templates,
      letters,
      letter_events,
      invoices,
      ai_generations: [],
    },
  };
}
