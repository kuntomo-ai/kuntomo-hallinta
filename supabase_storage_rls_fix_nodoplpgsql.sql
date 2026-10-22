alter table storage.objects enable row level security;
alter table storage.objects force row level security;

DROP POLICY IF EXISTS "auth_select_documents"    ON storage.objects;
DROP POLICY IF EXISTS "auth_select_receipts"     ON storage.objects;
DROP POLICY IF EXISTS "auth_select_kirjanpito"   ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_documents"    ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_receipts"     ON storage.objects;
DROP POLICY IF EXISTS "auth_insert_kirjanpito"   ON storage.objects;
DROP POLICY IF EXISTS "auth_update_documents"    ON storage.objects;
DROP POLICY IF EXISTS "auth_update_receipts"     ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_documents"    ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_receipts"     ON storage.objects;
DROP POLICY IF EXISTS "receipts_terapia_insert"  ON storage.objects;
DROP POLICY IF EXISTS "receipts_lahjakortti_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_select_admin"    ON storage.objects;
DROP POLICY IF EXISTS "receipts_delete_admin"    ON storage.objects;
DROP POLICY IF EXISTS "receipts_update_admin"    ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_admin"   ON storage.objects;
DROP POLICY IF EXISTS "documents_select_admin"   ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_admin"   ON storage.objects;
DROP POLICY IF EXISTS "documents_update_admin"   ON storage.objects;
DROP POLICY IF EXISTS "kirjanpito_docs_admin_only" ON storage.objects;

CREATE POLICY "receipts_terapia_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND name LIKE 'terapia/%'
    AND public.has_role(auth.uid(),
        ARRAY['admin', 'myynti', 'terapia_valmennus', 'sport', 'respa'])
  );

CREATE POLICY "receipts_lahjakortti_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND name LIKE 'lahjakortti/%'
    AND public.has_role(auth.uid(),
        ARRAY['admin', 'terapia_valmennus', 'respa'])
  );

CREATE POLICY "receipts_select_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.has_role(auth.uid(), ARRAY['admin', 'hallitus', 'manager'])
  );

CREATE POLICY "receipts_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  );

CREATE POLICY "receipts_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  );

CREATE POLICY "documents_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.has_role(auth.uid(), ARRAY['admin', 'hallitus', 'manager'])
  );

CREATE POLICY "documents_select_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_role(auth.uid(), ARRAY['admin', 'hallitus', 'manager'])
  );

CREATE POLICY "documents_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  );

CREATE POLICY "documents_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  );

CREATE POLICY "kirjanpito_docs_admin_only"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'kirjanpito-docs'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  )
  WITH CHECK (
    bucket_id = 'kirjanpito-docs'
    AND public.has_role(auth.uid(), ARRAY['admin'])
  );
