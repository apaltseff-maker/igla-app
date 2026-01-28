-- Migration: Auto-create organization on user signup
-- Creates organizations table, adds org_id to profiles, and sets up trigger

-- 1) Create organizations table if not exists
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2) Add org_id to profiles if not exists
alter table public.profiles
  add column if not exists org_id uuid references public.organizations(id);

-- 3) Create index on profiles.org_id
create index if not exists profiles_org_id_idx on public.profiles(org_id);

-- 4) Function to create org + profile on new user
create or replace function public.handle_new_user_create_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_name text;
begin
  -- Get org name from user metadata or use default
  v_name := coalesce(new.raw_user_meta_data->>'org_name', 'Новое производство');

  -- Create organization
  insert into public.organizations(name)
  values (v_name)
  returning id into v_org_id;

  -- Create or update profile with org_id
  insert into public.profiles(id, org_id)
  values (new.id, v_org_id)
  on conflict (id) do update set org_id = excluded.org_id;

  return new;
end;
$$;

-- 5) Drop existing trigger if exists
drop trigger if exists on_auth_user_created_create_org on auth.users;

-- 6) Create trigger on auth.users
create trigger on_auth_user_created_create_org
after insert on auth.users
for each row
execute function public.handle_new_user_create_org();

-- 7) Enable RLS on organizations
alter table public.organizations enable row level security;

-- 8) RLS policy: users can only see their own organization
drop policy if exists "org_select_own" on public.organizations;
create policy "org_select_own"
on public.organizations for select
using (
  id = (select org_id from public.profiles where id = auth.uid())
);

-- 9) RLS policy: users can update their own organization
drop policy if exists "org_update_own" on public.organizations;
create policy "org_update_own"
on public.organizations for update
using (
  id = (select org_id from public.profiles where id = auth.uid())
)
with check (
  id = (select org_id from public.profiles where id = auth.uid())
);

-- 10) Ensure profiles RLS is enabled
alter table public.profiles enable row level security;

-- 11) RLS policy: users can select their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

-- 12) RLS policy: users can update their own profile
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- 13) For existing users without org_id: create default org and assign
-- This handles users that were created before this migration
do $$
declare
  v_org_id uuid;
  v_user_record record;
begin
  for v_user_record in 
    select id from public.profiles 
    where org_id is null
  loop
    -- Create org for existing user
    insert into public.organizations(name)
    values ('Производство ' || substr(v_user_record.id::text, 1, 8))
    returning id into v_org_id;

    -- Assign org to profile
    update public.profiles
    set org_id = v_org_id
    where id = v_user_record.id;
  end loop;
end;
$$;

-- 14) Notify PostgREST to reload schema
notify pgrst, 'reload schema';
