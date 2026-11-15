-- TroyLens (optional extension): public event cards published from a plan.
-- Run in the Supabase SQL editor AFTER 0001_event_plans.sql.
--
-- A listing reuses its plan's ID and holds ONLY the shareable card fields.
-- Budgets, tasks, notes, questions and account data stay in event_plans.
-- There is deliberately no owner column: ownership is proven through the plan
-- row, which RLS already restricts to its owner, so the public table never
-- exposes who created a card.

create table if not exists public.event_listings (
  id               uuid primary key references public.event_plans (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 160),
  organizer        text not null default '' check (char_length(organizer) <= 160),
  event_date       date,
  start_time       text check (start_time ~ '^\d{2}:\d{2}$'),
  end_time         text check (end_time ~ '^\d{2}:\d{2}$'),
  location         text not null default '' check (char_length(location) <= 160),
  location_status  text not null check (location_status in ('confirmed', 'tba')),
  description      text not null default '' check (char_length(description) <= 1000),
  tags             text[] not null default '{}' check (
                     cardinality(tags) <= 5 and
                     tags <@ array['tech','career','entrepreneurship','design','science','health','arts','social_impact','culture','academic']::text[]
                   ),
  is_sample        boolean not null default false,
  plan_version     integer not null,
  published_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Times only make sense with a confirmed date.
  constraint times_need_date check (event_date is not null or (start_time is null and end_time is null))
);

create index if not exists event_listings_date on public.event_listings (event_date);

create or replace function public.event_listings_before_update()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id then
    raise exception 'listing id cannot be changed';
  end if;
  new.published_at := old.published_at;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists event_listings_before_update on public.event_listings;
create trigger event_listings_before_update
  before update on public.event_listings
  for each row execute function public.event_listings_before_update();

alter table public.event_listings enable row level security;
alter table public.event_listings force row level security;

drop policy if exists "anyone can read listings" on public.event_listings;
drop policy if exists "plan owner can insert listing" on public.event_listings;
drop policy if exists "plan owner can update listing" on public.event_listings;
drop policy if exists "plan owner can delete listing" on public.event_listings;

-- Published cards are public by design.
create policy "anyone can read listings" on public.event_listings
  for select to anon, authenticated using (true);

-- The subquery runs under event_plans' own RLS, so it only finds the caller's plans.
create policy "plan owner can insert listing" on public.event_listings
  for insert to authenticated
  with check (exists (select 1 from public.event_plans p where p.id = event_listings.id and p.owner_id = (select auth.uid())));
create policy "plan owner can update listing" on public.event_listings
  for update to authenticated
  using (exists (select 1 from public.event_plans p where p.id = event_listings.id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.event_plans p where p.id = event_listings.id and p.owner_id = (select auth.uid())));
create policy "plan owner can delete listing" on public.event_listings
  for delete to authenticated
  using (exists (select 1 from public.event_plans p where p.id = event_listings.id and p.owner_id = (select auth.uid())));

revoke all on public.event_listings from anon, authenticated;
grant select on public.event_listings to anon, authenticated;
grant insert, update, delete on public.event_listings to authenticated;
