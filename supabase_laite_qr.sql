-- Laiteluettelo: lisää laitenumero ja ohjevideo
ALTER TABLE laiteluettelo_items
  ADD COLUMN IF NOT EXISTS device_number  TEXT,
  ADD COLUMN IF NOT EXISTS ohjevideo_url  TEXT;

-- Huoltohistoria: lisää julkisen lomakkeen kentät
ALTER TABLE laite_huoltohistoria
  ADD COLUMN IF NOT EXISTS ilmoittaja_puhelin TEXT,
  ADD COLUMN IF NOT EXISTS ilmoittaja_email   TEXT,
  ADD COLUMN IF NOT EXISTS source             TEXT DEFAULT 'app';
