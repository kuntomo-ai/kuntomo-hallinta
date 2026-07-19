-- MobilePay tilitysraportin tapahtumat.
-- Yksi rivi per CSV:n rivi. psp_reference on uniikki:
-- Toteutuneet maksut: MobilePayn PSP-viite (esim. 35137481607)
-- Palkkiot/tilitykset: MobilePayn oma viite (esim. 1250174-20260101, 1250174-2000510)
CREATE TABLE IF NOT EXISTS mobilepay_transactions (
  id                     SERIAL PRIMARY KEY,
  psp_reference          TEXT NOT NULL UNIQUE,
  transaction_time       TIMESTAMPTZ,
  booking_date           DATE,
  type                   TEXT,                       -- 'Toteutunut' | 'Palkkiot vähennetty' | 'Maksu suunniteltu'
  payment_solution       TEXT,                       -- 'Mukautettu summa' tms.
  amount                 NUMERIC,                    -- Summa
  balance                NUMERIC,                    -- Saldo (juokseva)
  fee                    NUMERIC,                    -- Palkkio (neg.)
  net_amount             NUMERIC,                    -- Nettosumma
  currency               TEXT DEFAULT 'EUR',
  category               TEXT,
  order_reference        TEXT,                       -- Tilaustunnus/Viite
  payment_number         TEXT,                       -- Maksunumero
  payout_account         TEXT,                       -- Maksutili IBAN
  scheduled_payout_date  DATE,                       -- Suunniteltu maksupäivä
  merchant_location      TEXT,                       -- Myyntipaikka (Kuntomo)
  msn                    TEXT,                       -- MobilePay-lyhytnumero
  country                TEXT,
  imported_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobilepay_booking_date ON mobilepay_transactions (booking_date);
CREATE INDEX IF NOT EXISTS idx_mobilepay_type         ON mobilepay_transactions (type);
CREATE INDEX IF NOT EXISTS idx_mobilepay_payout_date  ON mobilepay_transactions (scheduled_payout_date);
