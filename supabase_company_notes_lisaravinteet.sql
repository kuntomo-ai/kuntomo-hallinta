-- Lisää lisaravinteet-tekstikenttä company_notes-tauluun.
-- Näkyy Yritykset-sivulla samanlaisena kenttänä Muistiinpanot-kentän alla,
-- toistaiseksi vain Keki miehet -yritykselle (client-puolen ehto).
alter table public.company_notes
  add column if not exists lisaravinteet text;
