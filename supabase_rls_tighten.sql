-- Vaihe 1: RLS-tiukennus. Estä (a) roolieskalaatio ja (b) sensitiivisen datan
-- lukeminen tavallisilta työntekijöiltä.
--
-- Tuotanto EI riko: client käyttää service_roleä joka ohittaa RLS:n.
-- Nämä policyt astuvat voimaan kun client refaktoroidaan käyttämään anon-avainta.
--
-- Aja Supabase Dashboard → SQL Editor → Run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper-funktio joka tarkastaa nykyisen käyttäjän roolit
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_role(check_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role::text = any (check_roles) or
        (roles is not null and roles::text[] && check_roles)
      )
  )
$$;

grant execute on function public.has_role(text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles: estä roolieskalaatio (vain admin voi muuttaa role/roles)
-- ─────────────────────────────────────────────────────────────────────────────
-- Poista mahdolliset olemassa olevat "update"-policyt (jotta uudet astuvat voimaan)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='profiles' and cmd='UPDATE'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- Käyttäjä saa päivittää oman profiilinsa MUTTA EI role/roles-kenttiä
create policy "user updates own profile except role"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from (select role from profiles where id = auth.uid())
    and roles is not distinct from (select roles from profiles where id = auth.uid())
  );

-- Admin voi päivittää kenen tahansa profiilin ml. roolit
create policy "admin updates any profile"
  on public.profiles for update
  to authenticated
  using (public.has_role(array['admin','hallitus','manager']));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Finanssitaulut: SELECT vain admin/hallitus
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'tulos_kuukausiraportti',
    'tase_snapshot',
    'kirjanpito_documents',
    'kassavirta'
  ];
  pol record;
  has_table boolean;
begin
  foreach t in array tables loop
    -- Varmista että taulu on olemassa (skippaa muuten)
    select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relname=t and c.relkind='r') into has_table;
    if not has_table then
      raise notice 'Skip: table public.% does not exist', t;
      continue;
    end if;
    -- Poista nykyiset SELECT-policyt
    for pol in
      select policyname from pg_policies
      where schemaname='public' and tablename=t and cmd='SELECT'
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    -- Uusi tiukka SELECT: admin/hallitus
    execute format('create policy "admin_hallitus_read_%s" on public.%I for select to authenticated using (public.has_role(array[''admin'',''hallitus'',''manager'']))', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. lahjakortit: SELECT admin/hallitus/terapia_valmennus/respa
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='lahjakortit' and cmd='SELECT'
  loop
    execute format('drop policy if exists %I on public.lahjakortit', pol.policyname);
  end loop;
end $$;

create policy "staff_read_lahjakortit"
  on public.lahjakortit for select
  to authenticated
  using (public.has_role(array['admin','hallitus','manager','terapia_valmennus','respa']));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. mobilepay_transactions: SELECT admin/hallitus/respa
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='mobilepay_transactions' and cmd='SELECT'
  loop
    execute format('drop policy if exists %I on public.mobilepay_transactions', pol.policyname);
  end loop;
end $$;

create policy "staff_read_mobilepay"
  on public.mobilepay_transactions for select
  to authenticated
  using (public.has_role(array['admin','hallitus','manager','respa']));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. employees: SELECT vain admin/hallitus/manager (henkilöstötiedot)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='employees' and cmd='SELECT'
  loop
    execute format('drop policy if exists %I on public.employees', pol.policyname);
  end loop;
end $$;

create policy "admin_read_employees"
  on public.employees for select
  to authenticated
  using (public.has_role(array['admin','hallitus','manager']));

-- Kaikki näkevät työntekijöiden nimet (tarvitaan monessa dropdownissa) —
-- luodaan view public.employees_public jos tarvitaan myöhemmin, mutta nyt
-- pelkkä nimien haku ei ole tarpeen client-puolelta koska Dropdown-listat
-- luetaan service_role-clientilla toistaiseksi.

-- Verifi (aja jälkeenpäin):
-- select * from pg_policies where schemaname='public' and tablename in
--   ('profiles','tulos_kuukausiraportti','tase_snapshot','lahjakortit','employees','mobilepay_transactions')
-- order by tablename, cmd;
