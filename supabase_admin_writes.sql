-- Admin-write-policyt Employees-sivun toimintoja varten.
-- has_role() -helper on jo lisätty vaihe 1:ssä.

-- ────────────────────────────────────────────────────────────
-- 1. employees: admin/hallitus/manager voi INSERT/UPDATE/DELETE
-- ────────────────────────────────────────────────────────────
do $$
declare pol record;
begin
  for pol in
    select policyname, cmd from pg_policies
    where schemaname='public' and tablename='employees' and cmd in ('INSERT','UPDATE','DELETE')
  loop
    execute format('drop policy if exists %I on public.employees', pol.policyname);
  end loop;
end $$;

create policy "admin_insert_employees" on public.employees for insert
  to authenticated
  with check (public.has_role(array['admin','hallitus','manager']));

create policy "admin_update_employees" on public.employees for update
  to authenticated
  using (public.has_role(array['admin','hallitus','manager']));

create policy "admin_delete_employees" on public.employees for delete
  to authenticated
  using (public.has_role(array['admin','hallitus','manager']));

-- ────────────────────────────────────────────────────────────
-- 2. profiles: admin voi INSERT (upsert new user profile)
-- ────────────────────────────────────────────────────────────
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='profiles' and cmd in ('INSERT','DELETE')
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "admin_insert_profiles" on public.profiles for insert
  to authenticated
  with check (public.has_role(array['admin','hallitus','manager']));

create policy "admin_delete_profiles" on public.profiles for delete
  to authenticated
  using (public.has_role(array['admin','hallitus','manager']));

-- ────────────────────────────────────────────────────────────
-- 3. Null-out foreign keys: admin voi UPDATE employee_id → null myyntitauluissa
--    (Employees.jsx tekee tämän kun poistaa työntekijän jotta FK ei estä poistoa)
-- ────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array['terapiamyynti','valmennusmyynti','jasenmyynti','work_logs','work_time_logs','drive_logs'];
  pol record;
  policy_name text;
  has_table boolean;
begin
  foreach t in array tables loop
    select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname=t and c.relkind='r') into has_table;
    if not has_table then
      raise notice 'Skip: table public.% does not exist', t;
      continue;
    end if;

    policy_name := format('admin_update_%s', t);
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(array[''admin'',''hallitus'',''manager'']))', policy_name, t);
  end loop;
end $$;

-- Verifi:
-- select tablename, cmd, policyname from pg_policies
-- where schemaname='public' and tablename in ('employees','profiles','terapiamyynti','valmennusmyynti','jasenmyynti','work_logs','work_time_logs','drive_logs')
-- order by tablename, cmd;
