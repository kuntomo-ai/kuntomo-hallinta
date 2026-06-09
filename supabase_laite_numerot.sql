-- Numeroi kaikki laitteet 001 alkaen
-- Järjestys: Etu-Lyötty → Kempele → Linnakangas, sijainnin sisällä aakkosissa

WITH ordered AS (
  SELECT id,
    LPAD(
      ROW_NUMBER() OVER (
        ORDER BY
          CASE sijainti
            WHEN 'Etu-Lyötty'  THEN 1
            WHEN 'Kempele'     THEN 2
            WHEN 'linnakangas' THEN 3
            ELSE 4
          END,
          name
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
