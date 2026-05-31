-- Add visit_date (myyntipäivä) to jasenmyynti
ALTER TABLE jasenmyynti
ADD COLUMN IF NOT EXISTS visit_date date;
