-- H1-korjaus: Storage RLS -policyt
-- Korvaa supabase_storage_lockdown_v2.sql:n policyt roolipohjaisilla,
-- kansiokohtaisilla säännöillä.
--
-- Esiehdot ennen ajoa (tarkista Supabase Dashboardissa):
--   1. Bucket 'receipts' ja 'documents' ovat Private (Public = OFF)
--   2. has_role()-funktio on olemassa: SELECT proname FROM pg_proc WHERE proname='has_role'
--   3. kirjanpito-docs-bucket: tarkista sisältö ennen admin-only-lukitusta
--
-- Aja SQL Editor -ikkunassa tai migraatiotyökalulla.
-- Testaa ensin staging-ympäristössä.

-- Varmista että RLS on päällä (idempotent)
alter table storage.objects enable row level security;
alter table storage.objects force row level security;

-- Poista kaikki nykyiset storage.objects -policyt
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- ============================================================
-- RECEIPTS-BUCKET
-- ============================================================

-- INSERT: terapia-kansio — myyntihenkilöstö + admin
create policy "receipts_terapia_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    AND name LIKE 'terapia/%'
    AND public.has_role(ARRAY['admin', 'myynti', 'terapia_valmennus', 'sport', 'respa'])
  );

-- INSERT: lahjakortti-kansio — respa + terapia_valmennus + admin
create policy "receipts_lahjakortti_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    AND name LIKE 'lahjakortti/%'
    AND public.has_role(ARRAY['admin', 'terapia_valmennus', 'respa'])
  );

-- SELECT: suorat lataukset vain admin-rooleille
-- Henkilöstö lukee aina signed URL:n kautta (/api/storage/signed-url),
-- joka ohittaa RLS:n service_role-clientillä.
create policy "receipts_select_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    AND public.has_role(ARRAY['admin', 'hallitus', 'manager'])
  );

-- DELETE: vain admin
create policy "receipts_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    AND public.has_role(ARRAY['admin'])
  );

-- UPDATE: vain admin
create policy "receipts_update_admin"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    AND public.has_role(ARRAY['admin'])
  )
  with check (
    bucket_id = 'receipts'
    AND public.has_role(ARRAY['admin'])
  );

-- ============================================================
-- DOCUMENTS-BUCKET
-- ============================================================

-- INSERT: vain ylläpito (admin/hallitus/manager)
create policy "documents_insert_admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    AND public.has_role(ARRAY['admin', 'hallitus', 'manager'])
  );

-- SELECT: suorat lataukset vain admin-rooleille
-- Henkilöstö lukee aina signed URL:n kautta.
create policy "documents_select_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    AND public.has_role(ARRAY['admin', 'hallitus', 'manager'])
  );

-- DELETE: vain admin
create policy "documents_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    AND public.has_role(ARRAY['admin'])
  );

-- UPDATE: vain admin
create policy "documents_update_admin"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    AND public.has_role(ARRAY['admin'])
  )
  with check (
    bucket_id = 'documents'
    AND public.has_role(ARRAY['admin'])
  );

-- ============================================================
-- KIRJANPITO-DOCS-BUCKET
-- Ei asiakaskoodia — lukitaan admin-only.
-- Tarkista ensin Dashboard > Storage > kirjanpito-docs > Objects
-- ============================================================

create policy "kirjanpito_docs_admin_only"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'kirjanpito-docs'
    AND public.has_role(ARRAY['admin'])
  )
  with check (
    bucket_id = 'kirjanpito-docs'
    AND public.has_role(ARRAY['admin'])
  );

-- ============================================================
-- Verifi-kysely — aja jälkeen tarkistaaksesi:
--
-- select policyname, roles, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   order by cmd, policyname;
-- ============================================================
