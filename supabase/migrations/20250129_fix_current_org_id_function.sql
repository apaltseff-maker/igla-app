-- Политика employees_rw использует current_org_id(). Ошибка "column p.user_id does not exist"
-- из-за того, что эта функция внутри обращается к profiles.user_id. Переопределяем по id.

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid() limit 1;
$$;

comment on function public.current_org_id() is 'org_id текущего пользователя (profiles.id = auth.uid())';

notify pgrst, 'reload schema';
