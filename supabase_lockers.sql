CREATE TABLE IF NOT EXISTS lockers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location text NOT NULL,
  locker_number integer NOT NULL,
  two_keys text NOT NULL DEFAULT 'kyllä',
  lock_works text NOT NULL DEFAULT 'kyllä',
  has_keyring text NOT NULL DEFAULT 'kyllä',
  notes text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(location, locker_number)
);
