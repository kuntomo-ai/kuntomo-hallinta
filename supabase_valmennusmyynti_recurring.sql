-- Sallii created_at:n asettamisen inserttiin (jatkuva valmennus -toiminto)
-- Aja Supabase SQL Editorissa

ALTER TABLE valmennusmyynti
  ALTER COLUMN created_at SET DEFAULT now();

-- Jos created_at on generated always -tyyppiä, vaihda:
-- ALTER TABLE valmennusmyynti ALTER COLUMN created_at DROP EXPRESSION;
-- ALTER TABLE valmennusmyynti ALTER COLUMN created_at SET DEFAULT now();
