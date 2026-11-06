-- Debdabe database: tables, security rules (RLS), letter numbering, signup.
-- Run ONCE on a new Supabase project: SQL Editor -> New query -> paste -> Run.
-- Then run supabase/seed/00_templates.sql and (optional) 01_demo.sql.


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
  if new.email = 'demo@debdabe.app'
     and exists (select 1 from public.organizations where id = '00000000-0000-0000-0000-0000000000d1') then
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

-- Private file buckets (letterheads, signature images, scanned incoming letters).
-- Each organisation's files live in a folder named after its id.
insert into storage.buckets (id, name, public) values
  ('letterheads', 'letterheads', false),
  ('signatures', 'signatures', false),
  ('incoming-letters', 'incoming-letters', false)
on conflict (id) do nothing;


create policy "org files read" on storage.objects for select to authenticated
  using (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
create policy "org files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
create policy "org files update" on storage.objects for update to authenticated
  using (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
create policy "org files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
