-- V2: Tiukempi lukitus. Käyttää auth.role() -tarkistusta USING-lauseessa
-- (ei pelkkää TO-rooliomistautumista) jotta myös DOWNLOAD-flow blokkautuu.

-- 0. Varmista että RLS on päällä + FORCE (varmuudeksi)
alter table storage.objects enable row level security;
alter table storage.objects force row level security;

-- 1. Poista kaikki nykyiset policyt
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname='storage' and tablename='objects'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- 2. SELECT: vain autentikoiduille — käytä sekä TO-role että USING-clause -tarkistusta
create policy "auth_select_documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "auth_select_receipts"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "auth_select_kirjanpito"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'kirjanpito-docs' and auth.role() = 'authenticated');

-- 3. INSERT
create policy "auth_insert_documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "auth_insert_receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "auth_insert_kirjanpito"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'kirjanpito-docs' and auth.role() = 'authenticated');

-- 4. UPDATE / DELETE
create policy "auth_update_documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "auth_update_receipts"
  on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "auth_delete_documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "auth_delete_receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- 5. Varmuuden vuoksi: revoke anon-oikeudet suoraan taululta
revoke all on storage.objects from anon;
grant select, insert, update, delete on storage.objects to authenticated;
grant all on storage.objects to service_role;

-- Verifi (aja jälkeenpäin nähdäksesi):
-- select policyname, roles, cmd from pg_policies where schemaname='storage' and tablename='objects';
