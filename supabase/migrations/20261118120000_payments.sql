-- Payments checked with Verify Mela (TESTING ONLY, not live).
-- 1. A customer pays, pastes the SMS on Plan & billing; the app checks it with Verify Mela and
--    saves a 'pending' payment with the receipt and the check results.
-- 2. A platform admin (Eyoel) sees all pending payments on /admin/payments and approves or rejects.
-- 3. Approve: the org gets the plan for one month, and a paid invoice is added.
-- Plans can no longer be switched from the browser; only approve_payment changes them.
-- Safe to re-run.
--
-- After running, make yourself platform admin (SQL editor):
--   insert into public.platform_admins(user_id)
--   select id from auth.users where email = '<your email>' on conflict do nothing;

alter table public.organizations add column if not exists paid_until timestamptz;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
grant all on public.platform_admins to service_role;
alter table public.platform_admins enable row level security;  -- no policies: invisible to the app

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan public.plan_tier not null,
  expected_amount numeric not null,
  method text not null,
  reference text not null,
  amount numeric,
  payer_name text,
  receiver_name text,
  receiver_account text,
  paid_at timestamptz,
  checks jsonb not null default '{}'::jsonb,
  receipt jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  submitted_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  unique (method, reference)   -- one transaction can pay only once
);
grant select, insert on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments for select to authenticated
  using (organization_id = public.current_org() or public.is_platform_admin());

drop policy if exists "payments submit" on public.payments;
create policy "payments submit" on public.payments for insert to authenticated
  with check (organization_id = public.current_org() and status = 'pending'
    and public.has_org_role(array['owner','admin']::public.org_role[]));

-- Platform admin sees every organisation's name on the payments page.
drop policy if exists "org read platform admin" on public.organizations;
create policy "org read platform admin" on public.organizations for select to authenticated
  using (public.is_platform_admin());

-- Block plan / paid_until changes from the browser; approve_payment sets the flag below.
-- The SQL editor (no JWT) and service_role are not blocked.
create or replace function public.guard_plan_change() returns trigger
language plpgsql as $$
begin
  if (new.plan is distinct from old.plan or new.paid_until is distinct from old.paid_until)
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
     and coalesce(current_setting('debdabe.plan_change', true), '') <> 'on' then
    raise exception 'Plans change only after a payment is approved';
  end if;
  return new;
end $$;
drop trigger if exists guard_plan_change on public.organizations;
create trigger guard_plan_change before update on public.organizations
  for each row execute function public.guard_plan_change();

create or replace function public.plan_price(_p public.plan_tier) returns numeric
language sql immutable as $$
  select case _p when 'basic' then 500 when 'office' then 1500 else 3000 end::numeric
$$;

create or replace function public.approve_payment(_payment uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments; o public.organizations; start_at timestamptz; end_at timestamptz;
  price numeric; vat numeric;
begin
  if not public.is_platform_admin() then raise exception 'Only platform admins can approve'; end if;
  select * into p from public.payments where id = _payment for update;
  if p.id is null then raise exception 'Payment not found'; end if;
  if p.status <> 'pending' then raise exception 'Payment is already %', p.status; end if;
  select * into o from public.organizations where id = p.organization_id for update;
  start_at := greatest(now(), coalesce(o.paid_until, now()));
  end_at := start_at + interval '1 month';
  update public.payments set status = 'approved', note = _note, reviewed_by = auth.uid(),
    reviewed_at = now() where id = _payment;
  perform set_config('debdabe.plan_change', 'on', true);
  update public.organizations set plan = p.plan, paid_until = end_at where id = o.id;
  perform set_config('debdabe.plan_change', '', true);
  price := public.plan_price(p.plan);
  vat := round(price * 0.15, 2);
  insert into public.invoices(organization_id, number, period_start, period_end, plan, amount, vat,
    total, status, paid_at)
  values (o.id, 'DB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(left(p.id::text, 6)),
    (start_at at time zone 'Africa/Addis_Ababa')::date, (end_at at time zone 'Africa/Addis_Ababa')::date,
    p.plan, price, vat, price + vat, 'paid', coalesce(p.paid_at, now()));
end $$;

create or replace function public.reject_payment(_payment uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Only platform admins can reject'; end if;
  update public.payments set status = 'rejected', note = _note, reviewed_by = auth.uid(),
    reviewed_at = now() where id = _payment and status = 'pending';
  if not found then raise exception 'Payment not found or not pending'; end if;
end $$;

revoke execute on function public.approve_payment(uuid, text), public.reject_payment(uuid, text) from anon, public;
grant execute on function public.approve_payment(uuid, text), public.reject_payment(uuid, text) to authenticated;
