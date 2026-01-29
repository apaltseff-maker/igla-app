-- Убираем любые ссылки на profiles.user_id: в profiles колонка называется id.
-- Пересоздаём политики для profiles и employees, чтобы чтение профиля при загрузке Excel не падало.

-- 1) Политики на profiles — только id = auth.uid()
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2) Политика на employees — подзапрос к profiles по id, не по user_id
drop policy if exists "employees_org_isolation" on public.employees;

create policy "employees_org_isolation"
  on public.employees
  for all
  using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  )
  with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

notify pgrst, 'reload schema';
