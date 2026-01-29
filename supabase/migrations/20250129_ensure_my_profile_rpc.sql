-- RPC: ensure current user has profile with org_id (create org + profile if missing)
-- Call from app when profileError or missing org_id so user can access справочники / создать крой

create or replace function public.ensure_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_profile record;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select id, org_id, role into v_profile
  from public.profiles
  where id = v_uid;

  if v_profile.id is not null and v_profile.org_id is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- No profile row or org_id is null: create org and profile (не трогаем role — может быть enum)
  if v_profile.org_id is null or v_profile.id is null then
    insert into public.organizations(name)
    values ('Новое производство')
    returning id into v_org_id;

    insert into public.profiles(id, org_id)
    values (v_uid, v_org_id)
    on conflict (id) do update set org_id = excluded.org_id;
  end if;

  return jsonb_build_object('ok', true);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;
notify pgrst, 'reload schema';
