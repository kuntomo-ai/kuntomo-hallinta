-- Investointilaskurin data: yksi jaettu rivi koko organisaatiolle
CREATE TABLE IF NOT EXISTS investoinnit_data (
  id          TEXT        PRIMARY KEY DEFAULT 'default',
  data        JSONB       NOT NULL    DEFAULT '[]',
  updated_at  TIMESTAMPTZ             DEFAULT NOW(),
  updated_by  UUID        REFERENCES profiles(id)
);

-- Seed tyhjä oletusrivi jotta SELECT palauttaa aina jotain
INSERT INTO investoinnit_data (id, data)
VALUES ('default', '[]')
ON CONFLICT (id) DO NOTHING;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE investoinnit_data ENABLE ROW LEVEL SECURITY;

-- Poista vanhat ennen luontia (idempotent)
DROP POLICY IF EXISTS "admin_read_investoinnit"   ON public.investoinnit_data;
DROP POLICY IF EXISTS "admin_insert_investoinnit" ON public.investoinnit_data;
DROP POLICY IF EXISTS "admin_update_investoinnit" ON public.investoinnit_data;

CREATE POLICY "admin_read_investoinnit" ON public.investoinnit_data
  FOR SELECT TO authenticated
  USING (public.has_role(array['admin','hallitus','manager']));

CREATE POLICY "admin_insert_investoinnit" ON public.investoinnit_data
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(array['admin','hallitus','manager']));

CREATE POLICY "admin_update_investoinnit" ON public.investoinnit_data
  FOR UPDATE TO authenticated
  USING (public.has_role(array['admin','hallitus','manager']));
