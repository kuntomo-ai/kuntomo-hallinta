-- Numeroi laitteet sijaintikohtaisilla sarjoilla:
--   Etu-Lyötty  → 001, 002, 003 ...
--   Kempele     → 101, 102, 103 ...
--   Linnakangas → 201, 202, 203 ...

WITH ordered AS (
  SELECT id,
    LPAD(
      (
        CASE sijainti
          WHEN 'Etu-Lyötty'  THEN 0
          WHEN 'Kempele'     THEN 100
          WHEN 'linnakangas' THEN 200
          ELSE 300
        END
        +
        ROW_NUMBER() OVER (
          PARTITION BY sijainti
          ORDER BY name
        )
      )::TEXT,
      3, '0'
    ) AS uusi_numero
  FROM laiteluettelo_items
)
UPDATE laiteluettelo_items l
SET device_number = o.uusi_numero
FROM ordered o
WHERE l.id = o.id;

-- Tarkistus: listaa laitteet numeroittain
SELECT device_number, sijainti, name
FROM laiteluettelo_items
ORDER BY device_number;
