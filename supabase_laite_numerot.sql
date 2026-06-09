-- Numeroi laitteet sijaintikohtaisilla sarjoilla (4 merkkiä):
--   Etu-Lyötty  → 0001, 0002, 0003 ...
--   Kempele     → 1001, 1002, 1003 ...
--   Linnakangas → 2001, 2002, 2003 ...

WITH ordered AS (
  SELECT id,
    LPAD(
      (
        CASE sijainti
          WHEN 'Etu-Lyötty'  THEN 0
          WHEN 'Kempele'     THEN 1000
          WHEN 'linnakangas' THEN 2000
          ELSE 3000
        END
        +
        ROW_NUMBER() OVER (
          PARTITION BY sijainti
          ORDER BY name
        )
      )::TEXT,
      4, '0'
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
