-- Jäsenyydet viikkoseuranta
CREATE TABLE IF NOT EXISTS membership_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL UNIQUE,
  new_members integer NOT NULL DEFAULT 0,
  ended_members integer NOT NULL DEFAULT 0,
  total_members integer,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
