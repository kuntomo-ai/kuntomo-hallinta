-- Lisää tehtäville valinnainen linkki (esim. laitteen vikailmoitukseen)
-- Aja Supabase SQL Editorissa ENNEN uuden koodin käyttöä.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link text;
