-- RLS-säännöt siivous v2 -tauluille
-- Aja supabase_siivous_tables.sql ensin.
-- Idempotent: turvallinen ajaa uudelleen.

-- ── Apufunktiot ───────────────────────────────────────────────────────────────

create or replace function is_admin_or_manager()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role    in ('admin', 'manager')
        or 'admin'   = any(coalesce(roles, '{}'))
        or 'manager' = any(coalesce(roles, '{}'))
      )
  )
$$;

create or replace function is_valvoja_or_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role    in ('admin', 'manager', 'valvoja')
        or 'admin'   = any(coalesce(roles, '{}'))
        or 'manager' = any(coalesce(roles, '{}'))
        or 'valvoja' = any(coalesce(roles, '{}'))
      )
  )
$$;

-- ── Ota RLS käyttöön ──────────────────────────────────────────────────────────

alter table siivous_locations         enable row level security;
alter table siivous_tasks             enable row level security;
alter table siivous_day_logs          enable row level security;
alter table siivous_day_log_items     enable row level security;
alter table siivous_exceptions        enable row level security;
alter table siivous_exception_tasks   enable row level security;
alter table siivous_closed_days       enable row level security;
alter table siivous_inspections       enable row level security;
alter table siivous_inspection_rooms  enable row level security;
alter table siivous_faults            enable row level security;
alter table siivous_fault_images      enable row level security;

do $$ begin

  -- ── siivous_locations ──────────────────────────────────────────────────────
  -- Kirjautuneet lukevat; admin/manager päivittää aikataulua ja valvojaa

  if not exists (select 1 from pg_policies where tablename='siivous_locations' and policyname='auth_read_siivous_locations') then
    create policy "auth_read_siivous_locations"
      on siivous_locations for select to authenticated using (true);
  end if;

  drop policy if exists "admin_update_siivous_locations" on siivous_locations;
  create policy "admin_update_siivous_locations"
    on siivous_locations for update to authenticated
    using (is_admin_or_manager()) with check (is_admin_or_manager());

  -- ── siivous_tasks ─────────────────────────────────────────────────────────
  -- Kirjautuneet lukevat; admin/manager kirjoittaa

  if not exists (select 1 from pg_policies where tablename='siivous_tasks' and policyname='auth_read_siivous_tasks') then
    create policy "auth_read_siivous_tasks"
      on siivous_tasks for select to authenticated using (true);
  end if;

  drop policy if exists "admin_insert_siivous_tasks" on siivous_tasks;
  create policy "admin_insert_siivous_tasks"
    on siivous_tasks for insert to authenticated
    with check (is_admin_or_manager());

  drop policy if exists "admin_update_siivous_tasks" on siivous_tasks;
  create policy "admin_update_siivous_tasks"
    on siivous_tasks for update to authenticated
    using (is_admin_or_manager()) with check (is_admin_or_manager());

  -- ── siivous_day_logs ──────────────────────────────────────────────────────
  -- Kirjautuneet lukevat; ei frontend-INSERT (cron luo service_rolella)

  if not exists (select 1 from pg_policies where tablename='siivous_day_logs' and policyname='auth_read_siivous_day_logs') then
    create policy "auth_read_siivous_day_logs"
      on siivous_day_logs for select to authenticated using (true);
  end if;

  -- ── siivous_day_log_items ─────────────────────────────────────────────────
  -- Kirjautuneet lukevat; ei frontend-INSERT (cron luo service_rolella)

  if not exists (select 1 from pg_policies where tablename='siivous_day_log_items' and policyname='auth_read_siivous_day_log_items') then
    create policy "auth_read_siivous_day_log_items"
      on siivous_day_log_items for select to authenticated using (true);
  end if;

  -- ── siivous_exceptions ────────────────────────────────────────────────────
  -- Kirjautuneet lukevat; valvoja/admin lisää

  if not exists (select 1 from pg_policies where tablename='siivous_exceptions' and policyname='auth_read_siivous_exceptions') then
    create policy "auth_read_siivous_exceptions"
      on siivous_exceptions for select to authenticated using (true);
  end if;

  drop policy if exists "valvoja_insert_siivous_exceptions" on siivous_exceptions;
  create policy "valvoja_insert_siivous_exceptions"
    on siivous_exceptions for insert to authenticated
    with check (is_valvoja_or_admin());

  -- ── siivous_exception_tasks ───────────────────────────────────────────────

  if not exists (select 1 from pg_policies where tablename='siivous_exception_tasks' and policyname='auth_read_siivous_exception_tasks') then
    create policy "auth_read_siivous_exception_tasks"
      on siivous_exception_tasks for select to authenticated using (true);
  end if;

  drop policy if exists "valvoja_insert_siivous_exception_tasks" on siivous_exception_tasks;
  create policy "valvoja_insert_siivous_exception_tasks"
    on siivous_exception_tasks for insert to authenticated
    with check (is_valvoja_or_admin());

  -- ── siivous_closed_days ───────────────────────────────────────────────────
  -- Kirjautuneet lukevat; admin/manager lisää/poistaa

  if not exists (select 1 from pg_policies where tablename='siivous_closed_days' and policyname='auth_read_siivous_closed_days') then
    create policy "auth_read_siivous_closed_days"
      on siivous_closed_days for select to authenticated using (true);
  end if;

  drop policy if exists "admin_insert_siivous_closed_days" on siivous_closed_days;
  create policy "admin_insert_siivous_closed_days"
    on siivous_closed_days for insert to authenticated
    with check (is_admin_or_manager());

  drop policy if exists "admin_delete_siivous_closed_days" on siivous_closed_days;
  create policy "admin_delete_siivous_closed_days"
    on siivous_closed_days for delete to authenticated
    using (is_admin_or_manager());

  -- ── siivous_inspections ───────────────────────────────────────────────────
  -- Kirjautuneet lukevat; valvoja/admin lisää

  if not exists (select 1 from pg_policies where tablename='siivous_inspections' and policyname='auth_read_siivous_inspections') then
    create policy "auth_read_siivous_inspections"
      on siivous_inspections for select to authenticated using (true);
  end if;

  drop policy if exists "valvoja_insert_siivous_inspections" on siivous_inspections;
  create policy "valvoja_insert_siivous_inspections"
    on siivous_inspections for insert to authenticated
    with check (is_valvoja_or_admin());

  -- ── siivous_inspection_rooms ──────────────────────────────────────────────

  if not exists (select 1 from pg_policies where tablename='siivous_inspection_rooms' and policyname='auth_read_siivous_inspection_rooms') then
    create policy "auth_read_siivous_inspection_rooms"
      on siivous_inspection_rooms for select to authenticated using (true);
  end if;

  drop policy if exists "valvoja_insert_siivous_inspection_rooms" on siivous_inspection_rooms;
  create policy "valvoja_insert_siivous_inspection_rooms"
    on siivous_inspection_rooms for insert to authenticated
    with check (is_valvoja_or_admin());

  drop policy if exists "valvoja_update_siivous_inspection_rooms" on siivous_inspection_rooms;
  create policy "valvoja_update_siivous_inspection_rooms"
    on siivous_inspection_rooms for update to authenticated
    using (is_valvoja_or_admin()) with check (is_valvoja_or_admin());

  -- ── siivous_faults ────────────────────────────────────────────────────────
  -- Kirjautuneet lukevat, lisäävät, päivittävät statusta

  if not exists (select 1 from pg_policies where tablename='siivous_faults' and policyname='auth_read_siivous_faults') then
    create policy "auth_read_siivous_faults"
      on siivous_faults for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='siivous_faults' and policyname='auth_insert_siivous_faults') then
    create policy "auth_insert_siivous_faults"
      on siivous_faults for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='siivous_faults' and policyname='auth_update_siivous_faults') then
    create policy "auth_update_siivous_faults"
      on siivous_faults for update to authenticated using (true) with check (true);
  end if;

  -- ── siivous_fault_images ──────────────────────────────────────────────────

  if not exists (select 1 from pg_policies where tablename='siivous_fault_images' and policyname='auth_read_siivous_fault_images') then
    create policy "auth_read_siivous_fault_images"
      on siivous_fault_images for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='siivous_fault_images' and policyname='auth_insert_siivous_fault_images') then
    create policy "auth_insert_siivous_fault_images"
      on siivous_fault_images for insert to authenticated with check (true);
  end if;

end $$;

-- ── Storage bucket vikakuville ja tarkastuskuville ────────────────────────────

insert into storage.buckets (id, name, public)
values ('siivous-kuvat', 'siivous-kuvat', false)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='siivous_kuvat_insert') then
    create policy "siivous_kuvat_insert"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'siivous-kuvat');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='siivous_kuvat_select') then
    create policy "siivous_kuvat_select"
      on storage.objects for select to authenticated
      using (bucket_id = 'siivous-kuvat');
  end if;
end $$;
