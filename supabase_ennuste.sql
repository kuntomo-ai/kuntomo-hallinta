-- Ennustesuunnitelma: T2 + T4 parametrit (yksi rivi per ennustejakso)
CREATE TABLE IF NOT EXISTS ennuste_params (
  id             SERIAL PRIMARY KEY,
  period         TEXT NOT NULL UNIQUE,  -- 'e1' | 'e2' | 'e3'
  -- T2 Tulossuunnitelma
  liikevaihto            NUMERIC,
  muut_tuotot            NUMERIC,
  materiaalit_palvelut   NUMERIC,
  henkilostokulut        NUMERIC,
  muut_kulut             NUMERIC,
  varasto_muutos         NUMERIC DEFAULT 0,
  poistot                NUMERIC,
  rahoitustuotot         NUMERIC DEFAULT 0,
  korkokulut             NUMERIC DEFAULT 0,
  verot                  NUMERIC DEFAULT 0,
  satunnaiset_erat       NUMERIC DEFAULT 0,
  -- T4 Rahoitussuunnitelma
  investoinnit           NUMERIC DEFAULT 0,
  uudet_lainat           NUMERIC DEFAULT 0,
  lainojen_lyhennys      NUMERIC DEFAULT 0,
  osingonjako            NUMERIC DEFAULT 0,
  omistajien_sijoitus    NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- T7 Lainat
CREATE TABLE IF NOT EXISTS ennuste_lainat (
  id            SERIAL PRIMARY KEY,
  luotonantaja  TEXT NOT NULL DEFAULT '',
  lainamaara    NUMERIC DEFAULT 0,
  laina_aika_v  NUMERIC DEFAULT 5,
  korko_pct     NUMERIC DEFAULT 0,
  is_new        BOOLEAN DEFAULT false,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
