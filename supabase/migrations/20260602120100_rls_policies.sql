-- =============================================================================
-- grocery-app — Phase 2: Row-Level Security (RLS) + access rules
-- -----------------------------------------------------------------------------
-- RLS is Postgres's way of saying "which ROWS can this user see/change". We turn
-- it on for every table and then add explicit policies. With RLS on and NO
-- matching policy, access is DENIED by default — which is exactly what we want.
--
-- Run this AFTER the initial schema migration. It is SAFE TO RE-RUN.
--
-- Roles to know (provided by Supabase):
--   - anon          = a visitor who is not logged in (uses the publishable key)
--   - authenticated = a logged-in user
--   - service_role  = our server/admin key; BYPASSES RLS entirely (used by the
--                     ingestion job and admin server actions). Never in browser.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- SECURITY DEFINER means it runs with the function owner's rights, so it can
-- read `profiles` without being blocked by RLS — and so policies that call it
-- don't recurse. `set search_path` hardens it against schema hijacking.
-- -----------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- =============================================================================
-- profiles
-- =============================================================================
alter table profiles enable row level security;

-- A user can read their own profile; admins can read everyone's.
drop policy if exists "read own profile or admin reads all" on profiles;
create policy "read own profile or admin reads all"
  on profiles for select
  using (id = auth.uid() or is_admin());

-- A user can update their own profile (admins too). BUT see the column grants
-- below — the row policy says "which rows", the grants say "which columns".
drop policy if exists "update own profile or admin" on profiles;
create policy "update own profile or admin"
  on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- Prevent privilege escalation: a logged-in user must NOT be able to set their
-- own role to 'admin' or fake their subscription_status / Stripe fields. We do
-- this with COLUMN-LEVEL privileges: revoke broad UPDATE, then grant UPDATE only
-- on the safe, user-editable columns. Sensitive columns (role,
-- subscription_status, stripe_*) can then only be changed by the service_role
-- key (Stripe webhook, admin tools), which bypasses these grants.
revoke update on profiles from anon, authenticated;
grant update (display_name, home_postal_code, home_lat, home_lng)
  on profiles to authenticated;

-- Note: there is intentionally NO insert policy. New profile rows are created
-- automatically by the signup trigger below (which runs as a definer and so is
-- not blocked by RLS). Deletes cascade from auth.users.


-- =============================================================================
-- Publicly readable catalog: stores, store_branches, products, prices
-- Anyone (even anonymous) can READ these so search works on the free tier.
-- Only admins can write through the app; the ingestion job writes via the
-- service_role key (which bypasses RLS).
-- =============================================================================

alter table stores enable row level security;
drop policy if exists "stores are publicly readable" on stores;
create policy "stores are publicly readable"
  on stores for select using (true);
drop policy if exists "admins manage stores" on stores;
create policy "admins manage stores"
  on stores for all using (is_admin()) with check (is_admin());

alter table store_branches enable row level security;
drop policy if exists "branches are publicly readable" on store_branches;
create policy "branches are publicly readable"
  on store_branches for select using (true);
drop policy if exists "admins manage branches" on store_branches;
create policy "admins manage branches"
  on store_branches for all using (is_admin()) with check (is_admin());

alter table products enable row level security;
drop policy if exists "products are publicly readable" on products;
create policy "products are publicly readable"
  on products for select using (true);
drop policy if exists "admins manage products" on products;
create policy "admins manage products"
  on products for all using (is_admin()) with check (is_admin());

alter table prices enable row level security;
drop policy if exists "prices are publicly readable" on prices;
create policy "prices are publicly readable"
  on prices for select using (true);
drop policy if exists "admins manage prices" on prices;
create policy "admins manage prices"
  on prices for all using (is_admin()) with check (is_admin());


-- =============================================================================
-- data_sources — NOT publicly readable (config can hold API keys/secrets).
-- Admin-only through the app; the ingestion job reads it via service_role.
-- =============================================================================
alter table data_sources enable row level security;
drop policy if exists "admins manage data sources" on data_sources;
create policy "admins manage data sources"
  on data_sources for all using (is_admin()) with check (is_admin());


-- =============================================================================
-- grocery_lists / grocery_list_items — private to their owner.
-- =============================================================================
alter table grocery_lists enable row level security;
drop policy if exists "owners manage their lists" on grocery_lists;
create policy "owners manage their lists"
  on grocery_lists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table grocery_list_items enable row level security;
-- An item is yours if its parent list is yours.
drop policy if exists "owners manage their list items" on grocery_list_items;
create policy "owners manage their list items"
  on grocery_list_items for all
  using (
    exists (
      select 1 from grocery_lists l
      where l.id = grocery_list_items.list_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from grocery_lists l
      where l.id = grocery_list_items.list_id and l.user_id = auth.uid()
    )
  );


-- =============================================================================
-- searches_log — a user can insert and read their OWN searches; admins read all.
-- (Server-side logging via service_role bypasses RLS and is unaffected.)
-- =============================================================================
alter table searches_log enable row level security;
drop policy if exists "users insert their own searches" on searches_log;
create policy "users insert their own searches"
  on searches_log for insert
  with check (user_id = auth.uid());
drop policy if exists "users read their own searches or admin reads all" on searches_log;
create policy "users read their own searches or admin reads all"
  on searches_log for select
  using (user_id = auth.uid() or is_admin());


-- =============================================================================
-- Signup trigger — auto-create a profile row when a new auth user is created.
-- Runs as SECURITY DEFINER so it is not blocked by the profiles RLS policies.
-- =============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
