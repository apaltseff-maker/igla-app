-- Migration: New users get role 'admin' by default; they can then add employees and assign roles

-- 1) Ensure profiles has role column
alter table public.profiles
  add column if not exists role text;

-- 2) Update trigger function: set role = 'admin' when creating profile on signup
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
  v_name := coalesce(new.raw_user_meta_data->>'org_name', 'Новое производство');

  insert into public.organizations(name)
  values (v_name)
  returning id into v_org_id;

  -- Create profile with org_id and role = 'admin' (first user in org is admin)
  insert into public.profiles(id, org_id, role)
  values (new.id, v_org_id, 'admin')
  on conflict (id) do update set
    org_id = excluded.org_id,
    role = coalesce(public.profiles.role, 'admin');

  return new;
end;
$$;

-- 3) Backfill: existing users without role get 'admin' (role column may be enum app_role)
update public.profiles
set role = 'admin'
where role is null;

-- 4) Notify PostgREST
notify pgrst, 'reload schema';
