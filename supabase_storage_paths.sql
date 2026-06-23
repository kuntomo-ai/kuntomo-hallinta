-- Migrate stored Storage URLs to bare object paths.
-- Old code wrote full public URLs (which already returned HTTP 400 because the
-- buckets are private). The new code expects just the object key, e.g.
-- "terapia/1780409928197.jpg", and resolves a short-lived signed URL at view
-- time via /api/storage/signed-url.
--
-- Idempotent: only rewrites rows that still match the legacy URL prefix.
-- valmennusmyynti has no receipt_url column, so only terapiamyynti needs the rewrite.

update terapiamyynti
   set receipt_url = regexp_replace(
         receipt_url,
         '^https?://[^/]+/storage/v1/object/(?:public|sign|authenticated)/receipts/',
         ''
       )
 where receipt_url ~ '/storage/v1/object/(public|sign|authenticated)/receipts/';

update kirjanpito_documents
   set file_url = regexp_replace(
         file_url,
         '^https?://[^/]+/storage/v1/object/(?:public|sign|authenticated)/documents/',
         ''
       ),
       file_path = regexp_replace(
         coalesce(file_path, file_url),
         '^https?://[^/]+/storage/v1/object/(?:public|sign|authenticated)/documents/',
         ''
       )
 where file_url ~ '/storage/v1/object/(public|sign|authenticated)/documents/';
