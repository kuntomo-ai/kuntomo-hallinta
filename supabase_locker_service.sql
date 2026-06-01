ALTER TABLE lockers ADD COLUMN IF NOT EXISTS service_requested boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS locker_service_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  locker_id uuid REFERENCES lockers(id) ON DELETE CASCADE,
  kuvaus text NOT NULL,
  ilmoitettu_by text,
  ilmoitettu_at timestamptz DEFAULT now(),
  tehty boolean DEFAULT false,
  tehty_at timestamptz,
  tehty_by text
);
