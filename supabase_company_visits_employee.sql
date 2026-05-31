-- Lisää hierojan nimi yrityksen käynteihin
ALTER TABLE company_visits ADD COLUMN IF NOT EXISTS employee_name text;
