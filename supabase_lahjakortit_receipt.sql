-- Add receipt_url to lahjakortit so cards sold via Maksupääte can carry a
-- private Storage object path (consumed by /api/storage/signed-url).
alter table lahjakortit
  add column if not exists receipt_url text;
