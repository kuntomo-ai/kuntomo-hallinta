-- Lisää laitteille huoltopyyntö-lippu (koodi käyttää tätä 🔴-merkkiin ja laskureihin)
-- Aja Supabase SQL Editorissa.

ALTER TABLE laiteluettelo_items
  ADD COLUMN IF NOT EXISTS service_requested boolean DEFAULT false;

-- Taannehtiva täyttö: merkitse huoltoa vaativiksi laitteet, joilla on
-- avoin (tehty = false) huoltohistoriamerkintä.
UPDATE laiteluettelo_items li
SET service_requested = true
WHERE EXISTS (
  SELECT 1 FROM laite_huoltohistoria h
  WHERE h.laite_id = li.id AND h.tehty = false
);

-- Tarkistus: montako laitetta odottaa huoltoa
SELECT COUNT(*) AS huoltoa_odottaa
FROM laiteluettelo_items
WHERE service_requested = true;
