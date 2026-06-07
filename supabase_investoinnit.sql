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
