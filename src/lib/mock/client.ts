/**
 * Mock backend: a tiny stand-in for the Supabase client that keeps all data in
 * the browser's localStorage. It implements only the calls this app uses.
 * Reset it from the login page ("Reset demo data") or by clearing site data.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { formatReference, PLANS, type PlanKey } from "@/lib/letters";

import { buildSeed, DB_VERSION, type MockDb, type Row } from "./seed";

const DB_KEY = "debdabe.mockdb";
const SESSION_KEY = "debdabe.mocksession";

type Err = { message: string; code?: string };
type Result = { data: unknown; error: Err | null; count?: number | null };
type MockSession = { access_token: string; user: { id: string; email: string } };

// ---- persistence -------------------------------------------------------------

let cache: MockDb | null = null;

function db(): MockDb {
  if (cache) return cache;
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === DB_VERSION) return (cache = parsed);
      }
    } catch {
      /* corrupt: reseed */
    }
  }
  cache = buildSeed();
  save();
  return cache;
}

function save() {
  if (!cache || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded (usually large uploads): drop stored files, keep the data.
    cache.files = {};
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(cache));
    } catch {
      /* keep in memory only */
    }
  }
}

function table(name: string): Row[] {
  const t = db().tables;
  return (t[name] ??= []);
}

export function resetMockDb() {
  cache = buildSeed();
  save();
  setSession(null);
}

// ---- auth ----------------------------------------------------------------------

type Listener = (event: string, session: MockSession | null) => void;
const listeners = new Set<Listener>();

function getSession(): MockSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

function setSession(s: MockSession | null) {
  if (typeof localStorage !== "undefined") {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }
  listeners.forEach((l) => l(s ? "SIGNED_IN" : "SIGNED_OUT", s));
}

function currentUserId() {
  return getSession()?.user.id ?? null;
}

function currentOrg(): string | null {
  const uid = currentUserId();
  if (!uid) return null;
  return (table("profiles").find((p) => p["id"] === uid)?.["organization_id"] as string) ?? null;
}

const tick = () => new Promise((r) => setTimeout(r, 120));

const auth = {
  async getSession() {
    return { data: { session: getSession() }, error: null };
  },
  async getUser() {
    return { data: { user: getSession()?.user ?? null }, error: null };
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await tick();
    const u = db().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password)
      return {
        data: { session: null, user: null },
        error: { message: "Invalid login credentials" },
      };
    const session = { access_token: `mock-${u.id}`, user: { id: u.id, email: u.email } };
    setSession(session);
    return { data: { session, user: session.user }, error: null };
  },
  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: Record<string, string> };
  }) {
    await tick();
    const d = db();
    if (d.users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase()))
      return { data: { session: null, user: null }, error: { message: "User already registered" } };
    const meta = options?.data ?? {};
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    d.users.push({ id, email: email.trim(), password, full_name: meta["full_name"] ?? "" });
    // What the handle_new_user trigger does: new org + owner profile.
    const orgId = crypto.randomUUID();
    table("organizations").push({
      ...ORG_DEFAULTS,
      id: orgId,
      name_am: meta["org_name_am"] ?? "",
      name_en: meta["org_name"] || "My Organisation",
      created_at: now,
    });
    table("profiles").push({
      id,
      organization_id: orgId,
      full_name: meta["full_name"] ?? "",
      email,
      created_at: now,
    });
    table("user_roles").push({
      id: crypto.randomUUID(),
      user_id: id,
      organization_id: orgId,
      role: "owner",
    });
    save();
    const session = { access_token: `mock-${id}`, user: { id, email: email.trim() } };
    setSession(session);
    return { data: { session, user: session.user }, error: null };
  },
  async signOut() {
    setSession(null);
    return { error: null };
  },
};

// ---- table defaults --------------------------------------------------------------

const ORG_DEFAULTS: Row = {
  name_am: "",
  name_en: "",
  address: "",
  phone: "",
  email: "",
  tin: "",
  logo_url: null,
  letterhead_header_url: null,
  letterhead_footer_url: null,
  ref_prefix: "REF",
  ref_pattern: "{PREFIX}/{SEQ3}/{ETH_YEAR}",
  incoming_prefix: "IN",
  dept: "",
  reset_yearly: true,
  plan: "basic",
};

function defaults(name: string): Row {
  const now = new Date().toISOString();
  switch (name) {
    case "organizations":
      return { ...ORG_DEFAULTS, created_at: now };
    case "letters":
      return {
        direction: "outgoing",
        template_id: null,
        source: "manual",
        reference_no: null,
        sequence_no: null,
        eth_year: null,
        letter_date: now.slice(0, 10),
        subject: "",
        recipient: {},
        body: [],
        cc: [],
        field_values: {},
        signatory_id: null,
        status: "draft",
        sender: null,
        their_reference: null,
        assigned_to: null,
        created_by: currentUserId(),
        finalized_at: null,
        file_url: null,
        ai_prompt: null,
        ai_output: null,
        edit_ratio: null,
        created_at: now,
        updated_at: now,
      };
    case "letter_events":
      return { at: now, user_id: currentUserId() };
    case "templates":
      return {
        category: "General",
        subject_am: "",
        body_am: "",
        fields: [],
        is_active: true,
        created_at: now,
      };
    case "signatories":
      return {
        name_en: "",
        position_am: "",
        position_en: "",
        signature_url: null,
        created_at: now,
      };
    case "contacts":
      return { title: "", organization_name: "", city: "", type: "recipient", created_at: now };
    case "ai_generations":
      return { output: null, final_text: null, edit_ratio: null, mock: false, created_at: now };
    default:
      return { created_at: now };
  }
}

/** Row-level scoping, like the RLS policies: you only see your organisation's rows. */
function visible(name: string, row: Row, org: string | null) {
  if (name === "templates") return row["organization_id"] == null || row["organization_id"] === org;
  if (name === "organizations") return row["id"] === org;
  if (name === "user_roles" || name === "profiles" || "organization_id" in row)
    return row["organization_id"] === org;
  return true;
}

// ---- query builder ---------------------------------------------------------------

type Filter = (r: Row) => boolean;
const cmp = (a: unknown, b: unknown) =>
  a == null ? -1 : b == null ? 1 : a < b ? -1 : a > b ? 1 : 0;
const clone = <T>(v: T): T => (v == null ? v : (JSON.parse(JSON.stringify(v)) as T));

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private from_ = 0;
  private to_: number | null = null;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";
  private countOnly = false;

  constructor(private name: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      if (opts?.head) this.countOnly = true;
    } else this.returning = true;
    return this;
  }
  insert(v: Row | Row[]) {
    this.op = "insert";
    this.payload = v;
    return this;
  }
  update(v: Row) {
    this.op = "update";
    this.payload = v;
    return this;
  }
  upsert(v: Row | Row[]) {
    return this.insert(v);
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  gt(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && String(r[c]) > String(v));
    return this;
  }
  gte(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && new Date(String(r[c])) >= new Date(String(v)));
    return this;
  }
  lt(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && new Date(String(r[c])) < new Date(String(v)));
    return this;
  }
  lte(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && new Date(String(r[c])) <= new Date(String(v)));
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  is(c: string, v: unknown) {
    this.filters.push((r) => (r[c] ?? null) === v);
    return this;
  }
  ilike(c: string, pattern: string) {
    const needle = pattern.replaceAll("%", "").toLowerCase();
    this.filters.push((r) =>
      String(r[c] ?? "")
        .toLowerCase()
        .includes(needle),
    );
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  range(from: number, to: number) {
    this.from_ = from;
    this.to_ = to;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  then<A = Result, B = never>(
    ok?: ((v: Result) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return tick()
      .then(() => this.run())
      .then(ok, fail);
  }

  private matches(org: string | null) {
    return table(this.name).filter(
      (r) => visible(this.name, r, org) && this.filters.every((f) => f(r)),
    );
  }

  private shape(rows: Row[]): Result {
    const out = clone(rows);
    if (this.mode === "many") return { data: out, error: null };
    if (out.length === 1) return { data: out[0], error: null };
    if (this.mode === "maybe" && out.length === 0) return { data: null, error: null };
    return { data: null, error: { message: "Row not found", code: "PGRST116" } };
  }

  private run(): Result {
    const uid = currentUserId();
    const org = currentOrg();
    if (!uid) return { data: null, error: { message: "Not signed in" } };
    const rows = table(this.name);

    if (this.op === "select") {
      let res = this.matches(org);
      for (const o of [...this.orders].reverse())
        res = [...res].sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
      if (this.countOnly) return { data: null, error: null, count: res.length };
      const count = res.length;
      res = res.slice(this.from_, this.to_ != null ? this.to_ + 1 : undefined);
      if (this.lim != null) res = res.slice(0, this.lim);
      return { ...this.shape(res), count };
    }

    if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const added = list.map((v) => ({ id: crypto.randomUUID(), ...defaults(this.name), ...v }));
      rows.push(...added);
      save();
      return this.returning ? this.shape(added) : { data: null, error: null };
    }

    const targets = this.matches(org);
    if (this.op === "update") {
      for (const r of targets) Object.assign(r, this.payload);
      save();
      return this.returning ? this.shape(targets) : { data: null, error: null };
    }

    // delete
    db().tables[this.name] = rows.filter((r) => !targets.includes(r));
    save();
    return this.returning ? this.shape(targets) : { data: null, error: null };
  }
}

// ---- RPCs (the SQL functions from the migration) -------------------------------------

function nextReference(orgId: string, direction: "outgoing" | "incoming", ethYear: number) {
  const o = table("organizations").find((x) => x["id"] === orgId) ?? ORG_DEFAULTS;
  const key = o["reset_yearly"] ? ethYear : 0;
  const counters = table("reference_counters");
  let c = counters.find(
    (x) => x["organization_id"] === orgId && x["direction"] === direction && x["eth_year"] === key,
  );
  if (!c) {
    c = { organization_id: orgId, direction, eth_year: key, last_seq: 0 };
    counters.push(c);
  }
  const seq = Number(c["last_seq"]) + 1;
  c["last_seq"] = seq;
  const ref =
    direction === "incoming"
      ? formatReference("{PREFIX}/{SEQ3}/{ETH_YEAR}", {
          prefix: String(o["incoming_prefix"]),
          seq,
          year: ethYear,
          dept: String(o["dept"] ?? ""),
        })
      : formatReference(String(o["ref_pattern"]), {
          prefix: String(o["ref_prefix"]),
          seq,
          year: ethYear,
          dept: String(o["dept"] ?? ""),
        });
  return { ref, seq };
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
  await tick();
  const uid = currentUserId();
  const org = currentOrg();
  if (!uid || !org) return { data: null, error: { message: "Not signed in" } };
  const now = new Date().toISOString();

  if (fn === "finalize_letter") {
    const l = table("letters").find(
      (x) => x["id"] === args["_letter"] && x["organization_id"] === org,
    );
    if (!l) return { data: null, error: { message: "Letter not found" } };
    if (l["status"] === "final") return { data: l["reference_no"], error: null };
    const o = table("organizations").find((x) => x["id"] === org);
    const limit = PLANS[(o?.["plan"] as PlanKey) ?? "basic"].limit;
    if (limit != null) {
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      const used = table("letters").filter(
        (x) =>
          x["organization_id"] === org &&
          x["status"] === "final" &&
          x["direction"] === "outgoing" &&
          new Date(String(x["finalized_at"])) >= start,
      ).length;
      if (used >= limit)
        return { data: null, error: { message: "PLAN_LIMIT: monthly letter limit reached" } };
    }
    const ethYear = Number(args["_eth_year"]);
    const { ref, seq } = nextReference(org, "outgoing", ethYear);
    Object.assign(l, {
      status: "final",
      reference_no: ref,
      sequence_no: seq,
      eth_year: ethYear,
      finalized_at: now,
      updated_at: now,
    });
    table("letter_events").push({
      id: crypto.randomUUID(),
      letter_id: l["id"],
      organization_id: org,
      type: "finalized",
      user_id: uid,
      at: now,
    });
    save();
    return { data: ref, error: null };
  }

  if (fn === "register_incoming") {
    const ethYear = Number(args["_eth_year"]);
    const { ref, seq } = nextReference(org, "incoming", ethYear);
    const id = crypto.randomUUID();
    table("letters").push({
      ...defaults("letters"),
      id,
      organization_id: org,
      direction: "incoming",
      source: "incoming",
      reference_no: ref,
      sequence_no: seq,
      eth_year: ethYear,
      letter_date: args["_received"],
      subject: args["_subject"],
      recipient: { name: args["_sender"] },
      sender: args["_sender"],
      their_reference: args["_their_ref"],
      assigned_to: args["_assigned"],
      file_url: args["_file_url"] ?? null,
      status: "final",
      finalized_at: now,
    });
    table("letter_events").push({
      id: crypto.randomUUID(),
      letter_id: id,
      organization_id: org,
      type: "created",
      user_id: uid,
      at: now,
    });
    save();
    return { data: id, error: null };
  }

  return { data: null, error: { message: `Unknown function ${fn}` } };
}

// ---- storage (files kept as data URLs) -------------------------------------------------

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const storage = {
  from(bucket: string) {
    const key = (path: string) => `${bucket}/${path}`;
    return {
      async upload(path: string, file: Blob) {
        if (file.size > 1_500_000)
          return { data: null, error: { message: "Demo mode: files must be under 1.5 MB" } };
        db().files[key(path)] = { type: file.type, dataUrl: await readAsDataUrl(file) };
        save();
        return { data: { path }, error: null };
      },
      async createSignedUrl(path: string) {
        const f = db().files[key(path)];
        return f
          ? { data: { signedUrl: f.dataUrl }, error: null }
          : { data: null, error: { message: "File not found" } };
      },
      async download(path: string) {
        const f = db().files[key(path)];
        if (!f) return { data: null, error: { message: "File not found" } };
        const blob = await (await fetch(f.dataUrl)).blob();
        return { data: blob, error: null };
      },
    };
  },
};

// Typed as the real client so every existing query keeps its types.
export const mockSupabase = {
  auth,
  from: (name: string) => new Query(name),
  rpc,
  storage,
} as unknown as SupabaseClient<Database>;
