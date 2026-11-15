-- EvntSC schema: one owner-scoped plan table with structured JSON.
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.event_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 160),
  is_sample   boolean not null default false,
  intake      jsonb not null,
  budget      jsonb not null default '[]'::jsonb,
  tasks       jsonb not null default '[]'::jsonb,
  questions   jsonb not null default '[]'::jsonb,
  ai_notes    jsonb not null default '[]'::jsonb,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint budget_is_array    check (jsonb_typeof(budget) = 'array'),
  constraint tasks_is_array     check (jsonb_typeof(tasks) = 'array'),
  constraint questions_is_array check (jsonb_typeof(questions) = 'array'),
  constraint intake_is_object   check (jsonb_typeof(intake) = 'object'),
  constraint doc_size check (pg_column_size(intake) + pg_column_size(budget) + pg_column_size(tasks) + pg_column_size(questions) + pg_column_size(ai_notes) < 512000)
);

create index if not exists event_plans_owner_updated on public.event_plans (owner_id, updated_at desc);

-- Owner cannot be reassigned; version/updated_at are maintained by the database.
create or replace function public.event_plans_before_update()
returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists event_plans_before_update on public.event_plans;
create trigger event_plans_before_update
  before update on public.event_plans
  for each row execute function public.event_plans_before_update();

alter table public.event_plans enable row level security;
alter table public.event_plans force row level security;

-- Explicit per-operation owner policies. No policy grants access to anon.
drop policy if exists "owner can select" on public.event_plans;
drop policy if exists "owner can insert" on public.event_plans;
drop policy if exists "owner can update" on public.event_plans;
drop policy if exists "owner can delete" on public.event_plans;

create policy "owner can select" on public.event_plans
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owner can insert" on public.event_plans
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "owner can update" on public.event_plans
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owner can delete" on public.event_plans
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.event_plans from anon;
grant select, insert, update, delete on public.event_plans to authenticated;
