
create type public.org_role as enum ('owner','admin','writer');
create type public.plan_tier as enum ('basic','office','unlimited');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name_am text not null default '',
  name_en text not null default '',
  address text default '', phone text default '', email text default '', tin text default '',
  logo_url text, letterhead_header_url text, letterhead_footer_url text,
  ref_prefix text not null default 'REF',
  ref_pattern text not null default '{PREFIX}/{SEQ3}/{ETH_YEAR}',
  incoming_prefix text not null default 'IN',
  dept text default '',
  reset_yearly boolean not null default true,
  plan public.plan_tier not null default 'basic',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text default '',
  email text default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.org_role not null,
  unique (user_id, organization_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.current_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.has_org_role(_roles public.org_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid()
    and organization_id = public.current_org() and role = any(_roles))
$$;

create policy "org read" on public.organizations for select to authenticated using (id = public.current_org());
create policy "org admin update" on public.organizations for update to authenticated
  using (id = public.current_org() and public.has_org_role(array['owner','admin']::public.org_role[]));
create policy "profiles same org" on public.profiles for select to authenticated using (organization_id = public.current_org());
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "roles same org" on public.user_roles for select to authenticated using (organization_id = public.current_org());

create table public.signatories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name_am text not null, name_en text default '', position_am text default '', position_en text default '',
  signature_url text, created_at timestamptz not null default now()
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, title text default '', organization_name text default '', city text default '',
  type text not null default 'recipient' check (type in ('recipient','cc')),
  created_at timestamptz not null default now()
);
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title_am text not null, title_en text not null default '', category text not null default 'General',
  subject_am text not null default '', body_am text not null default '',
  fields jsonb not null default '[]'::jsonb, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction text not null default 'outgoing' check (direction in ('outgoing','incoming')),
  template_id uuid references public.templates(id) on delete set null,
  source text not null default 'manual' check (source in ('template','ai','manual','incoming')),
  reference_no text, sequence_no int, eth_year int,
  letter_date date not null default current_date,
  subject text not null default '',
  recipient jsonb not null default '{}'::jsonb,
  body jsonb not null default '[]'::jsonb,
  cc jsonb not null default '[]'::jsonb,
  field_values jsonb not null default '{}'::jsonb,
  signatory_id uuid references public.signatories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','final')),
  sender text, their_reference text, assigned_to text,
  created_by uuid, finalized_at timestamptz, file_url text,
  ai_prompt text, ai_output jsonb, edit_ratio numeric,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index letters_ref_unique on public.letters(organization_id, direction, reference_no) where reference_no is not null;
create table public.reference_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction text not null, eth_year int not null, last_seq int not null default 0,
  primary key (organization_id, direction, eth_year)
);
create table public.letter_events (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null, user_id uuid, at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number text not null, period_start date not null, period_end date not null,
  plan public.plan_tier not null, amount numeric not null, vat numeric not null, total numeric not null,
  status text not null default 'unpaid' check (status in ('unpaid','paid')), paid_at timestamptz
);
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid, letter_id uuid references public.letters(id) on delete set null,
  prompt text not null, output jsonb, final_text text, edit_ratio numeric, mock boolean default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.signatories, public.contacts, public.templates, public.letters, public.letter_events to authenticated;
grant select on public.reference_counters, public.invoices to authenticated;
grant select, insert, update on public.ai_generations to authenticated;
grant all on public.signatories, public.contacts, public.templates, public.letters, public.letter_events, public.reference_counters, public.invoices, public.ai_generations to service_role;

alter table public.signatories enable row level security;
alter table public.contacts enable row level security;
alter table public.templates enable row level security;
alter table public.letters enable row level security;
alter table public.reference_counters enable row level security;
alter table public.letter_events enable row level security;
alter table public.invoices enable row level security;
alter table public.ai_generations enable row level security;

create policy "sig read" on public.signatories for select to authenticated using (organization_id = public.current_org());
create policy "sig admin write" on public.signatories for all to authenticated
  using (organization_id = public.current_org() and public.has_org_role(array['owner','admin']::public.org_role[]))
  with check (organization_id = public.current_org() and public.has_org_role(array['owner','admin']::public.org_role[]));
create policy "contacts org" on public.contacts for all to authenticated
  using (organization_id = public.current_org()) with check (organization_id = public.current_org());
create policy "tpl read" on public.templates for select to authenticated using (organization_id is null or organization_id = public.current_org());
create policy "tpl admin write" on public.templates for all to authenticated
  using (organization_id = public.current_org() and public.has_org_role(array['owner','admin']::public.org_role[]))
  with check (organization_id = public.current_org() and public.has_org_role(array['owner','admin']::public.org_role[]));
create policy "letters read" on public.letters for select to authenticated using (organization_id = public.current_org());
create policy "letters insert" on public.letters for insert to authenticated
  with check (organization_id = public.current_org() and status = 'draft' and reference_no is null);
create policy "letters update draft" on public.letters for update to authenticated
  using (organization_id = public.current_org() and status = 'draft')
  with check (organization_id = public.current_org() and status = 'draft' and reference_no is null);
create policy "letters delete draft" on public.letters for delete to authenticated
  using (organization_id = public.current_org() and status = 'draft');
create policy "counters read" on public.reference_counters for select to authenticated using (organization_id = public.current_org());
create policy "events org" on public.letter_events for all to authenticated
  using (organization_id = public.current_org()) with check (organization_id = public.current_org() and user_id = auth.uid());
create policy "invoices read" on public.invoices for select to authenticated using (organization_id = public.current_org());
create policy "ai org" on public.ai_generations for all to authenticated
  using (organization_id = public.current_org()) with check (organization_id = public.current_org());

create or replace view public.usage_monthly with (security_invoker = true) as
  select organization_id, date_trunc('month', finalized_at)::date as month, count(*)::int as finalized_count
  from public.letters where status = 'final' and direction = 'outgoing'
  group by 1, 2;
grant select on public.usage_monthly to authenticated;

create or replace function public.plan_limit(_p public.plan_tier) returns int language sql immutable as $$
  select case _p when 'basic' then 30 when 'office' then 150 else null end
$$;

create or replace function public.format_reference(_pattern text, _prefix text, _seq int, _year int, _dept text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(_pattern,
    '{PREFIX}', coalesce(_prefix,'')), '{SEQ3}', lpad(_seq::text, 3, '0')),
    '{SEQ}', _seq::text), '{ETH_YEAR}', _year::text), '{DEPT}', coalesce(_dept,''))
$$;

-- Atomic reference allocation
create or replace function public.next_reference(_org uuid, _direction text, _eth_year int)
returns table(reference_no text, seq int)
language plpgsql security definer set search_path = public as $$
declare o public.organizations; k int; n int;
begin
  if _org is distinct from public.current_org() and auth.role() <> 'service_role' then
    raise exception 'not allowed';
  end if;
  select * into o from public.organizations where id = _org;
  k := case when o.reset_yearly then _eth_year else 0 end;
  insert into public.reference_counters(organization_id, direction, eth_year, last_seq)
    values (_org, _direction, k, 1)
    on conflict (organization_id, direction, eth_year)
    do update set last_seq = public.reference_counters.last_seq + 1
    returning last_seq into n;
  if _direction = 'incoming' then
    reference_no := public.format_reference('{PREFIX}/{SEQ3}/{ETH_YEAR}', o.incoming_prefix, n, _eth_year, o.dept);
  else
    reference_no := public.format_reference(o.ref_pattern, o.ref_prefix, n, _eth_year, o.dept);
  end if;
  seq := n;
  return next;
end $$;

create or replace function public.finalize_letter(_letter uuid, _eth_year int)
returns text language plpgsql security definer set search_path = public as $$
declare l public.letters; o public.organizations; used int; lim int; r record;
begin
  select * into l from public.letters where id = _letter for update;
  if l.id is null or l.organization_id <> public.current_org() then raise exception 'Letter not found'; end if;
  if not public.has_org_role(array['owner','admin']::public.org_role[]) then
    raise exception 'Only admins can finalize letters';
  end if;
  if l.status = 'final' then return l.reference_no; end if;
  select * into o from public.organizations where id = l.organization_id;
  lim := public.plan_limit(o.plan);
  if lim is not null then
    select count(*) into used from public.letters
      where organization_id = o.id and status = 'final' and direction = 'outgoing'
      and finalized_at >= date_trunc('month', now() at time zone 'Africa/Addis_Ababa') at time zone 'Africa/Addis_Ababa';
    if used >= lim then raise exception 'PLAN_LIMIT: monthly letter limit reached'; end if;
  end if;
  select * into r from public.next_reference(o.id, 'outgoing', _eth_year);
  update public.letters set status = 'final', reference_no = r.reference_no, sequence_no = r.seq,
    eth_year = _eth_year, finalized_at = now(), updated_at = now() where id = _letter;
  insert into public.letter_events(letter_id, organization_id, type, user_id) values (_letter, o.id, 'finalized', auth.uid());
  return r.reference_no;
end $$;

create or replace function public.register_incoming(_sender text, _their_ref text, _received date, _subject text,
  _file_url text, _assigned text, _eth_year int)
returns uuid language plpgsql security definer set search_path = public as $$
declare org uuid := public.current_org(); r record; nid uuid;
begin
  if org is null then raise exception 'No organisation'; end if;
  select * into r from public.next_reference(org, 'incoming', _eth_year);
  insert into public.letters(organization_id, direction, source, reference_no, sequence_no, eth_year, letter_date,
    subject, recipient, sender, their_reference, assigned_to, file_url, status, created_by, finalized_at)
  values (org, 'incoming', 'incoming', r.reference_no, r.seq, _eth_year, _received, _subject,
    jsonb_build_object('name', _sender), _sender, _their_ref, _assigned, _file_url, 'final', auth.uid(), now())
  returning id into nid;
  insert into public.letter_events(letter_id, organization_id, type, user_id) values (nid, org, 'created', auth.uid());
  return nid;
end $$;

revoke execute on function public.next_reference(uuid, text, int) from anon, public;
grant execute on function public.finalize_letter(uuid, int), public.register_incoming(text,text,date,text,text,text,int), public.next_reference(uuid,text,int) to authenticated;

-- Signup: create org + owner (demo email joins the demo org)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  if new.email = 'demo@debdabe.app' then
    org := '00000000-0000-0000-0000-0000000000d1';
  else
    insert into public.organizations(name_am, name_en, ref_prefix)
    values (coalesce(new.raw_user_meta_data->>'org_name_am', ''),
            coalesce(new.raw_user_meta_data->>'org_name', 'My Organisation'), 'REF')
    returning id into org;
  end if;
  insert into public.profiles(id, organization_id, full_name, email)
    values (new.id, org, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  insert into public.user_roles(user_id, organization_id, role) values (new.id, org, 'owner');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== SEED =====
insert into public.organizations(id, name_am, name_en, address, phone, email, tin, ref_prefix, ref_pattern, plan, incoming_prefix)
values ('00000000-0000-0000-0000-0000000000d1', 'ናሙና ትሬዲንግ ኃ.የተ.የግ.ማ', 'Namuna Trading PLC (Demo)',
  'Bole Sub-City, Addis Ababa', '+251 11 000 0000', 'info@namuna-demo.et', '0000000000 (demo)', 'NT', '{PREFIX}/{SEQ3}/{ETH_YEAR}', 'office', 'IN');

insert into public.reference_counters values
  ('00000000-0000-0000-0000-0000000000d1','outgoing',2019,43),
  ('00000000-0000-0000-0000-0000000000d1','incoming',2019,14);

insert into public.signatories(id, organization_id, name_am, name_en, position_am, position_en) values
 ('00000000-0000-0000-0000-00000000a501','00000000-0000-0000-0000-0000000000d1','አቶ ሰለሞን ታደሰ','Ato Solomon Tadesse','ዋና ሥራ አስኪያጅ','General Manager'),
 ('00000000-0000-0000-0000-00000000a502','00000000-0000-0000-0000-0000000000d1','ወ/ሮ ሔለን ገብሩ','W/ro Helen Gebru','የሰው ሀብት አስተዳደር ኃላፊ','Head of Human Resources');

insert into public.contacts(organization_id, name, title, organization_name, city, type) values
 ('00000000-0000-0000-0000-0000000000d1','የኢትዮጵያ ንግድ ባንክ','ቦሌ ቅርንጫፍ','Commercial Bank of Ethiopia, Bole Branch','አዲስ አበባ','recipient'),
 ('00000000-0000-0000-0000-0000000000d1','የገቢዎች ሚኒስቴር','','Ministry of Revenues','አዲስ አበባ','recipient'),
 ('00000000-0000-0000-0000-0000000000d1','ናሙና አቅራቢ ኃ.የተ.የግ.ማ','','Namuna Supplier PLC (demo)','አዲስ አበባ','recipient'),
 ('00000000-0000-0000-0000-0000000000d1','ለሰው ሀብት አስተዳደር ክፍል','','','','cc'),
 ('00000000-0000-0000-0000-0000000000d1','ለፋይናንስ ክፍል','','','','cc'),
 ('00000000-0000-0000-0000-0000000000d1','ለማህደር','','','','cc');

insert into public.templates(id, organization_id, title_am, title_en, category, subject_am, body_am, fields) values
('00000000-0000-0000-0000-0000000007e1', null, 'የሥራ ልምድ ማረጋገጫ', 'Work experience confirmation', 'HR', 'የሥራ ልምድ ማረጋገጫ ስለመስጠት',
 '{{title}} {{employee_name}} በድርጅታችን ከ{{start_date}} ጀምሮ በ{{position}} የሥራ መደብ ላይ በወር ብር {{salary}} ደመወዝ እየተከፈላቸው በማገልገል ላይ መሆናቸውን እየገለጽን፣ ይህ የሥራ ልምድ ማረጋገጫ በጠየቁት መሠረት የተሰጠ መሆኑን እናሳውቃለን።',
 '[{"key":"title","label_am":"መጠሪያ (አቶ/ወ/ሮ/ወ/ሪት)","label_en":"Title","type":"text","required":true},{"key":"employee_name","label_am":"የሠራተኛ ስም","label_en":"Employee name","type":"text","required":true},{"key":"start_date","label_am":"የተቀጠሩበት ቀን","label_en":"Start date","type":"date","required":true},{"key":"position","label_am":"የሥራ መደብ","label_en":"Position","type":"text","required":true},{"key":"salary","label_am":"ደመወዝ","label_en":"Salary","type":"money","required":true}]'),
('00000000-0000-0000-0000-0000000007e2', null, 'የደመወዝ ማረጋገጫ', 'Salary confirmation (for a bank)', 'HR / Banking', 'የደመወዝ ማረጋገጫ ስለመስጠት',
 '{{title}} {{employee_name}} በድርጅታችን በ{{position}} የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር {{gross_salary}} መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለ{{purpose}} እንዲያገለግል የተሰጠ ነው።',
 '[{"key":"title","label_am":"መጠሪያ","label_en":"Title","type":"text","required":true},{"key":"employee_name","label_am":"የሠራተኛ ስም","label_en":"Employee name","type":"text","required":true},{"key":"position","label_am":"የሥራ መደብ","label_en":"Position","type":"text","required":true},{"key":"gross_salary","label_am":"ጠቅላላ ደመወዝ","label_en":"Gross salary","type":"money","required":true},{"key":"purpose","label_am":"ዓላማ","label_en":"Purpose","type":"text","required":true}]'),
('00000000-0000-0000-0000-0000000007e3', null, 'የስብሰባ ጥሪ', 'Meeting invitation', 'Administration', 'የስብሰባ ጥሪ',
 '{{meeting_topic}}ን አስመልክቶ {{meeting_date}} {{meeting_time}} ሰዓት በ{{venue}} ስብሰባ ስለሚካሄድ፣ በስብሰባው ላይ እንድትገኙልን በአክብሮት እንጠይቃለን።',
 '[{"key":"meeting_topic","label_am":"የስብሰባው ርዕስ","label_en":"Meeting topic","type":"text","required":true},{"key":"meeting_date","label_am":"ቀን","label_en":"Date","type":"date","required":true},{"key":"meeting_time","label_am":"ሰዓት","label_en":"Time","type":"text","required":true},{"key":"venue","label_am":"ቦታ","label_en":"Venue","type":"text","required":true}]'),
('00000000-0000-0000-0000-0000000007e4', null, 'የዓመት ፈቃድ ጥያቄ', 'Annual leave request', 'HR', 'የዓመት ፈቃድ ስለመጠየቅ',
 'እኔ {{employee_name}} በ{{department}} ክፍል በ{{position}} የሥራ መደብ ላይ የምሠራ ሲሆን፣ ከ{{from_date}} እስከ {{to_date}} ድረስ ለ{{days}} ቀናት የዓመት ፈቃዴን እንድወስድ እንዲፈቀድልኝ በአክብሮት እጠይቃለሁ።',
 '[{"key":"employee_name","label_am":"ስም","label_en":"Employee name","type":"text","required":true},{"key":"department","label_am":"ክፍል","label_en":"Department","type":"text","required":true},{"key":"position","label_am":"የሥራ መደብ","label_en":"Position","type":"text","required":true},{"key":"from_date","label_am":"ከ","label_en":"From","type":"date","required":true},{"key":"to_date","label_am":"እስከ","label_en":"To","type":"date","required":true},{"key":"days","label_am":"የቀናት ብዛት","label_en":"Days","type":"number","required":true}]'),
('00000000-0000-0000-0000-0000000007e5', null, 'የዋጋ ማቅረቢያ ጥያቄ', 'Request for quotation', 'Procurement', 'የዋጋ ማቅረቢያ ስለመጠየቅ',
 'ድርጅታችን {{items}} ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ {{deadline}} ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።',
 '[{"key":"items","label_am":"የሚገዙ እቃዎች","label_en":"Items","type":"text","required":true},{"key":"deadline","label_am":"የመጨረሻ ቀን","label_en":"Deadline","type":"date","required":true}]'),
('00000000-0000-0000-0000-0000000007e6', null, 'የክፍያ ጥያቄ', 'Payment request', 'Finance', 'ክፍያ ስለመጠየቅ',
 'በ{{invoice_date}} በደረሰኝ ቁጥር {{invoice_number}} የተጠየቀው ብር {{amount}} እስካሁን ያልተከፈለ በመሆኑ፣ ክፍያውን እስከ {{due_date}} ድረስ እንድትፈጽሙልን በአክብሮት እንጠይቃለን።',
 '[{"key":"invoice_date","label_am":"የደረሰኝ ቀን","label_en":"Invoice date","type":"date","required":true},{"key":"invoice_number","label_am":"የደረሰኝ ቁጥር","label_en":"Invoice number","type":"text","required":true},{"key":"amount","label_am":"መጠን","label_en":"Amount","type":"money","required":true},{"key":"due_date","label_am":"የክፍያ ቀን","label_en":"Due date","type":"date","required":true}]');

-- sample outgoing letters
insert into public.letters(organization_id, direction, template_id, source, reference_no, sequence_no, eth_year, letter_date, subject, recipient, body, cc, signatory_id, status, finalized_at, created_at, updated_at)
select '00000000-0000-0000-0000-0000000000d1', 'outgoing', t.tid, 'template', t.ref, t.seq, 2019, (now() - (t.ago || ' days')::interval)::date, t.subj,
  t.rec::jsonb, t.body::jsonb, t.cc::jsonb, t.sig, t.st,
  case when t.st='final' then now() - (t.ago || ' days')::interval end,
  now() - (t.ago || ' days')::interval, now() - (t.ago || ' days')::interval
from (values
 ('00000000-0000-0000-0000-0000000007e2'::uuid,'NT/038/2019',38,28,'የደመወዝ ማረጋገጫ ስለመስጠት','{"name":"የኢትዮጵያ ንግድ ባንክ","title":"ቦሌ ቅርንጫፍ","city":"አዲስ አበባ"}','["አቶ አበበ ከበደ በድርጅታችን በሂሳብ ሠራተኛ የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር 18,500.00 መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለብድር አገልግሎት እንዲያገለግል የተሰጠ ነው።"]','["ለሰው ሀብት አስተዳደር ክፍል","ለማህደር"]','00000000-0000-0000-0000-00000000a502'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e1'::uuid,'NT/039/2019',39,24,'የሥራ ልምድ ማረጋገጫ ስለመስጠት','{"name":"ለሚመለከተው ሁሉ","title":"","city":"አዲስ አበባ"}','["ወ/ሮ ትዕግሥት አለሙ በድርጅታችን ከመስከረም 1 ቀን 2015 ዓ.ም ጀምሮ በሽያጭ ባለሙያ የሥራ መደብ ላይ በወር ብር 12,000.00 ደመወዝ እየተከፈላቸው በማገልገል ላይ መሆናቸውን እየገለጽን፣ ይህ የሥራ ልምድ ማረጋገጫ በጠየቁት መሠረት የተሰጠ መሆኑን እናሳውቃለን።"]','["ለማህደር"]','00000000-0000-0000-0000-00000000a502'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e5'::uuid,'NT/040/2019',40,20,'የዋጋ ማቅረቢያ ስለመጠየቅ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ","title":"","city":"አዲስ አበባ"}','["ድርጅታችን 20 የቢሮ ኮምፒውተሮች ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ ጥቅምት 30 ቀን 2019 ዓ.ም ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።"]','["ለፋይናንስ ክፍል"]','00000000-0000-0000-0000-00000000a501'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e3'::uuid,'NT/041/2019',41,15,'የስብሰባ ጥሪ','{"name":"ለሁሉም የክፍል ኃላፊዎች","title":"","city":""}','["የ2019 ዓ.ም የመጀመሪያ ሩብ ዓመት ዕቅድ አፈጻጸም ግምገማን አስመልክቶ ጥቅምት 20 ቀን 2019 ዓ.ም 3:00 ሰዓት በዋናው መሰብሰቢያ አዳራሽ ስብሰባ ስለሚካሄድ፣ በስብሰባው ላይ እንድትገኙልን በአክብሮት እንጠይቃለን።"]','["ለማህደር"]','00000000-0000-0000-0000-00000000a501'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e6'::uuid,'NT/042/2019',42,9,'ክፍያ ስለመጠየቅ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ","title":"","city":"አዲስ አበባ"}','["በመስከረም 15 ቀን 2019 ዓ.ም በደረሰኝ ቁጥር 00451 የተጠየቀው ብር 45,000.00 እስካሁን ያልተከፈለ በመሆኑ፣ ክፍያውን እስከ ጥቅምት 28 ቀን 2019 ዓ.ም ድረስ እንድትፈጽሙልን በአክብሮት እንጠይቃለን።"]','["ለፋይናንስ ክፍል","ለማህደር"]','00000000-0000-0000-0000-00000000a501'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e2'::uuid,'NT/043/2019',43,4,'የደመወዝ ማረጋገጫ ስለመስጠት','{"name":"የኢትዮጵያ ንግድ ባንክ","title":"ቦሌ ቅርንጫፍ","city":"አዲስ አበባ"}','["ወ/ሪት ሰላም ተስፋዬ በድርጅታችን በአስተዳደር ሠራተኛ የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር 14,200.00 መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለሂሳብ መክፈቻ እንዲያገለግል የተሰጠ ነው።"]','["ለሰው ሀብት አስተዳደር ክፍል"]','00000000-0000-0000-0000-00000000a502'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e4'::uuid,null,null,2,'የዓመት ፈቃድ ስለመጠየቅ','{"name":"የሰው ሀብት አስተዳደር ክፍል","title":"","city":""}','["እኔ [ስም] በ[ክፍል] ክፍል በ[የሥራ መደብ] የሥራ መደብ ላይ የምሠራ ሲሆን፣ ከ[ቀን] እስከ [ቀን] ድረስ ለ[ቀናት] ቀናት የዓመት ፈቃዴን እንድወስድ እንዲፈቀድልኝ በአክብሮት እጠይቃለሁ።"]','[]','00000000-0000-0000-0000-00000000a502'::uuid,'draft'),
 ('00000000-0000-0000-0000-0000000007e5'::uuid,null,null,1,'የዋጋ ማቅረቢያ ስለመጠየቅ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ","title":"","city":"አዲስ አበባ"}','["ድርጅታችን የቢሮ ወንበሮች ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ [ቀን] ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።"]','["ለፋይናንስ ክፍል"]','00000000-0000-0000-0000-00000000a501'::uuid,'draft')
) as t(tid, ref, seq, ago, subj, rec, body, cc, sig, st);

insert into public.letters(organization_id, direction, source, reference_no, sequence_no, eth_year, letter_date, subject, recipient, sender, their_reference, assigned_to, status, finalized_at, created_at)
values
 ('00000000-0000-0000-0000-0000000000d1','incoming','incoming','IN/012/2019',12,2019,(now()-interval '22 days')::date,'የሠራተኛ ደመወዝ ማረጋገጫ ጥያቄ','{"name":"የኢትዮጵያ ንግድ ባንክ — ቦሌ ቅርንጫፍ"}','የኢትዮጵያ ንግድ ባንክ — ቦሌ ቅርንጫፍ','CBE/BL/2231/19','ወ/ሮ ሔለን ገብሩ','final',now()-interval '22 days',now()-interval '22 days'),
 ('00000000-0000-0000-0000-0000000000d1','incoming','incoming','IN/013/2019',13,2019,(now()-interval '12 days')::date,'የ2018 ዓ.ም የግብር ማሳወቂያ ማስታወሻ','{"name":"የገቢዎች ሚኒስቴር"}','የገቢዎች ሚኒስቴር','MoR/7781/19','አቶ ሰለሞን ታደሰ','final',now()-interval '12 days',now()-interval '12 days'),
 ('00000000-0000-0000-0000-0000000000d1','incoming','incoming','IN/014/2019',14,2019,(now()-interval '3 days')::date,'የዋጋ ማቅረቢያ ምላሽ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ"}','ናሙና አቅራቢ ኃ.የተ.የግ.ማ','NS/104/19','አቶ ሰለሞን ታደሰ','final',now()-interval '3 days',now()-interval '3 days');

insert into public.letter_events(letter_id, organization_id, type, at)
select id, organization_id, 'created', created_at from public.letters where organization_id = '00000000-0000-0000-0000-0000000000d1';
insert into public.letter_events(letter_id, organization_id, type, at)
select id, organization_id, 'finalized', finalized_at from public.letters where organization_id = '00000000-0000-0000-0000-0000000000d1' and status='final' and direction='outgoing';

insert into public.invoices(organization_id, number, period_start, period_end, plan, amount, vat, total, status, paid_at) values
 ('00000000-0000-0000-0000-0000000000d1', 'INV-' || to_char(date_trunc('month', now()) - interval '3 months','YYYYMM'), (date_trunc('month', now()) - interval '3 months')::date, (date_trunc('month', now()) - interval '2 months' - interval '1 day')::date, 'office', 1500, 225, 1725, 'paid', date_trunc('month', now()) - interval '2 months' + interval '5 days'),
 ('00000000-0000-0000-0000-0000000000d1', 'INV-' || to_char(date_trunc('month', now()) - interval '2 months','YYYYMM'), (date_trunc('month', now()) - interval '2 months')::date, (date_trunc('month', now()) - interval '1 month' - interval '1 day')::date, 'office', 1500, 225, 1725, 'paid', date_trunc('month', now()) - interval '1 month' + interval '4 days'),
 ('00000000-0000-0000-0000-0000000000d1', 'INV-' || to_char(date_trunc('month', now()) - interval '1 month','YYYYMM'), (date_trunc('month', now()) - interval '1 month')::date, (date_trunc('month', now()) - interval '1 day')::date, 'office', 1500, 225, 1725, 'unpaid', null);
