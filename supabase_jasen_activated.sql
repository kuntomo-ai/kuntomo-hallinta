-- Lisää activated-boolean jäsenmyyntiin. Admin voi merkitä jäsenyyden
-- aktivoiduksi (esim. kun rannekekortti annettu asiakkaalle).

alter table public.jasenmyynti
  add column if not exists activated boolean not null default false,
  add column if not exists activated_at timestamptz,
  add column if not exists activated_by text;

-- RLS: UPDATE oikeus admin/hallitus/manager (perus-työntekijä ei saa muuttaa)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname='public' and tablename='jasenmyynti' and cmd='UPDATE'
  loop
    execute format('drop policy if exists %I on public.jasenmyynti', pol.policyname);
  end loop;
end $$;

create policy "admin_update_jasenmyynti"
  on public.jasenmyynti for update
  to authenticated
  using (public.has_role(array['admin','hallitus','manager']));
