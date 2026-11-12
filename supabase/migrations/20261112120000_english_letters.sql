-- English version of template letters (no AI).
-- 1. Templates get English wording next to the Amharic.
-- 2. Each company gets a translation memory: once someone writes the English for an
--    Amharic word or name, it is filled in automatically next time.
-- Safe to re-run.

alter table public.templates add column if not exists subject_en text not null default '';
alter table public.templates add column if not exists body_en text not null default '';

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,              -- normalized Amharic
  target text not null,              -- English
  updated_at timestamptz not null default now(),
  unique (organization_id, source)
);

grant select, insert, update, delete on public.translations to authenticated;
grant all on public.translations to service_role;
alter table public.translations enable row level security;

-- Anyone in the company may read and add to its own memory; nobody sees another company's.
drop policy if exists "translations org" on public.translations;
create policy "translations org" on public.translations for all to authenticated
  using (organization_id = public.current_org()) with check (organization_id = public.current_org());
