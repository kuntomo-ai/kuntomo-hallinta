-- Siivous v2: toimipisteet ja Kempeleen lähtötehtävät
-- Aja supabase_siivous_tables.sql ja supabase_siivous_rls.sql ensin.
-- Idempotent: turvallinen ajaa uudelleen (upsert).

-- ── Toimipisteet ──────────────────────────────────────────────────────────────

insert into siivous_locations (name, slug, sort_order, siivous_days, tarkistus_days, supervisor_name, scheduled_by)
values
  ('Kempele',       'kempele',       1, '{1,2,3,4,5,6}', '{}',          null, 'Jhunie Aquino, Mario Aquino'),
  ('Linnakangas',   'linnakangas',   2, '{1,3,5}',        '{2,4,6,0}',  null, null),
  ('Etu-Lyötty',    'etu-lyotty',    3, '{1,3,5,6}',      '{2,4,0}',    null, null),
  ('Toppilansaari', 'toppilansaari', 4, '{1,3,5}',        '{1,2,3,4,5}',null, null)
on conflict (slug) do update set
  name            = excluded.name,
  sort_order      = excluded.sort_order,
  siivous_days    = excluded.siivous_days,
  tarkistus_days  = excluded.tarkistus_days,
  scheduled_by    = coalesce(siivous_locations.scheduled_by, excluded.scheduled_by);

-- ── Kempeleen tehtävät ────────────────────────────────────────────────────────

do $$
declare
  loc_id    uuid;
  i         int := 0;
  task_count int;
begin
  select id into loc_id from siivous_locations where slug = 'kempele';

  -- Suojaus: älä korvaa jo olemassa olevia tehtäviä (historia rikkoutuisi)
  select count(*) into task_count from siivous_tasks where location_id = loc_id;
  if task_count > 0 then
    raise notice 'Kempeleen tehtävät on jo lisätty (% kpl). Ohitetaan seed.', task_count;
    return;
  end if;

  -- ── PÄIVITTÄISET TEHTÄVÄT ──────────────────────────────────────────────────

  -- Tuulikaappi, aula, odotustila, käytävät, portaat
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Tuulikaappi, aula ja käytävät', 'Roskat tyhjennetty',                                                       'daily', 'siivous', i + 1),
    (loc_id, 'Tuulikaappi, aula ja käytävät', 'Lattioiden imurointi ja nihkeäpyyhintä',                                    'daily', 'siivous', i + 2),
    (loc_id, 'Tuulikaappi, aula ja käytävät', 'Ovien kahvat, kaiteet, kulunvalvontalaitteet ja asiakaspinnat pyyhitty',    'daily', 'siivous', i + 3),
    (loc_id, 'Tuulikaappi, aula ja käytävät', 'Lasiovien sormenjäljet pyyhitty',                                           'daily', 'siivous', i + 4),
    (loc_id, 'Tuulikaappi, aula ja käytävät', 'Kenkätelineet siistit',                                                     'daily', 'siivous', i + 5);
  i := i + 10;

  -- Vastaanotto ja myyntitiski
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Vastaanotto ja myyntitiski', 'Pinnat ja tiski pyyhitty (vihreä liina)',   'daily', 'siivous', i + 1),
    (loc_id, 'Vastaanotto ja myyntitiski', 'Kylmäkaapin kahvat pyyhitty',               'daily', 'siivous', i + 2),
    (loc_id, 'Vastaanotto ja myyntitiski', 'Roskat tyhjennetty',                        'daily', 'siivous', i + 3);
  i := i + 10;

  -- Kuntosali
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Kuntosali', 'Roskat ja unohtuneet tavarat poistettu',                                          'daily', 'siivous', i + 1),
    (loc_id, 'Kuntosali', 'Kumimaton imurointi ja nihkeäpyyhintä kulkureiteiltä ja vapaapainoalueelta',      'daily', 'siivous', i + 2),
    (loc_id, 'Kuntosali', 'Laitteiden kosketuspinnat pyyhitty',                                              'daily', 'siivous', i + 3),
    (loc_id, 'Kuntosali', 'Asiakkaiden puhdistuspisteiden täyttö tarkistettu',                               'daily', 'siivous', i + 4);
  i := i + 10;

  -- Venyttelytila ja leikkihuone (2. krs)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Venyttelytila ja leikkihuone (2. krs)', 'Lattiat siivottu',                'daily', 'siivous', i + 1),
    (loc_id, 'Venyttelytila ja leikkihuone (2. krs)', 'Jumppamatot ja lelut pyyhitty',   'daily', 'siivous', i + 2),
    (loc_id, 'Venyttelytila ja leikkihuone (2. krs)', 'Roskat tyhjennetty',              'daily', 'siivous', i + 3);
  i := i + 10;

  -- Pukuhuoneet
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Pukuhuoneet', 'Lattiat pesty, myös penkkien alta',                                        'daily', 'siivous', i + 1),
    (loc_id, 'Pukuhuoneet', 'Penkit, kaappien ovet ja lukot pyyhitty',                                  'daily', 'siivous', i + 2),
    (loc_id, 'Pukuhuoneet', 'Peilit puhdistettu',                                                       'daily', 'siivous', i + 3),
    (loc_id, 'Pukuhuoneet', 'Hiustenkuivaajat pyyhitty',                                                'daily', 'siivous', i + 4),
    (loc_id, 'Pukuhuoneet', 'Roskat tyhjennetty',                                                       'daily', 'siivous', i + 5),
    (loc_id, 'Pukuhuoneet', 'Kaapit tarkistettu (unohtuneet tavarat ja haittaeläimet)',                 'daily', 'siivous', i + 6);
  i := i + 10;

  -- Pesuhuoneet
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Pesuhuoneet', 'Lattiat, seinät roiskealueelta ja suihkut pesty',  'daily', 'siivous', i + 1),
    (loc_id, 'Pesuhuoneet', 'Lattiakaivojen ritilät puhdistettu',               'daily', 'siivous', i + 2),
    (loc_id, 'Pesuhuoneet', 'Vesi lattiakaivoon laskettu',                      'daily', 'siivous', i + 3),
    (loc_id, 'Pesuhuoneet', 'Saippua-annostelijat täydennetty',                 'daily', 'siivous', i + 4);
  i := i + 10;

  -- Saunat
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Saunat', 'Lauteiden pinnat ja lattia huuhdeltu ja pyyhitty',                   'daily', 'siivous', i + 1),
    (loc_id, 'Saunat', 'Kiukaan päällä ei ole mitään (tarkistettu)',                         'daily', 'siivous', i + 2),
    (loc_id, 'Saunat', 'Lasiovi puhdistettu',                                                'daily', 'siivous', i + 3),
    (loc_id, 'Saunat', 'Ovi raolleen kuivumaan (jos sauna pois päältä)',                     'daily', 'siivous', i + 4);
  i := i + 10;

  -- WC-tilat
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'WC-tilat', 'WC-istuimet ja pisuaarit puhdistettu (punainen liina)',         'daily', 'siivous', i + 1),
    (loc_id, 'WC-tilat', 'Altaat, hanat, tasot ja peilit puhdistettu (keltainen liina)',  'daily', 'siivous', i + 2),
    (loc_id, 'WC-tilat', 'Lattiat pesty',                                                  'daily', 'siivous', i + 3),
    (loc_id, 'WC-tilat', 'Paperit, saippuat ja käsipyyhkeet täydennetty',                 'daily', 'siivous', i + 4),
    (loc_id, 'WC-tilat', 'Roskat tyhjennetty',                                             'daily', 'siivous', i + 5);
  i := i + 10;

  -- Henkilökunnan taukotila ja WC
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Henkilökunnan taukotila ja WC', 'Pöydät, keittiötaso ja allas pyyhitty',  'daily', 'siivous', i + 1),
    (loc_id, 'Henkilökunnan taukotila ja WC', 'Lattia siivottu',                         'daily', 'siivous', i + 2),
    (loc_id, 'Henkilökunnan taukotila ja WC', 'Roskat tyhjennetty',                      'daily', 'siivous', i + 3);
  i := i + 10;

  -- Jätteet
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Jätteet', 'Kaikki roska-astiat tyhjennetty ja viety lajiteltuina jätekatokseen', 'daily', 'siivous', i + 1);
  i := i + 10;

  -- ── VIIKOITTAISET TEHTÄVÄT ─────────────────────────────────────────────────
  -- schedule_day: 1=ma, 2=ti, 3=ke, 4=to, 5=pe, 6=la (JS-weekday)

  -- Maanantai (1)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, schedule_day, signoff_type, sort_order) values
    (loc_id, 'Saunat',      'Lauteet, paneelit ja lattiat pesty emäksisellä saunanpesuaineella ja harjalla',               'weekly', 1, 'siivous', i + 1),
    (loc_id, 'Viemärit',    'Lattiakaivot avattu ja hajulukot puhdistettu',                                                'weekly', 1, 'siivous', i + 2),
    (loc_id, 'Vesipisteet', 'Vähän käytettyjen vesipisteiden juoksutus 1–2 min (hoitohuoneiden altaat, LE-WC, taukotila)', 'weekly', 1, 'siivous', i + 3);
  i := i + 10;

  -- Keskiviikko (3)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, schedule_day, signoff_type, sort_order) values
    (loc_id, 'Kuntosali', 'Kumimaton koneellinen pesu tai perusteellinen nihkeäpyyhintä koko salin alueelta',  'weekly', 3, 'siivous', i + 1),
    (loc_id, 'Kuntosali', 'Laitteiden rungot, telineet, painopidikkeet ja levypainot pyyhitty',                'weekly', 3, 'siivous', i + 2);
  i := i + 10;

  -- Torstai (4)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, schedule_day, signoff_type, sort_order) values
    (loc_id, 'Yleistilat', 'Peilit kokonaan, ovet ja karmit, valokatkaisijat, pistorasioiden kannet pyyhitty',  'weekly', 4, 'siivous', i + 1),
    (loc_id, 'Yleistilat', 'Mikron sisäpinnat pyyhitty (taukotila)',                                             'weekly', 4, 'siivous', i + 2);
  i := i + 10;

  -- Perjantai (5)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, schedule_day, signoff_type, sort_order) values
    (loc_id, 'Pesuhuoneet',  'Laattasaumat ja seinät kokonaan pesty',  'weekly', 5, 'siivous', i + 1),
    (loc_id, 'Hoitohuoneet', 'Lattiat siivottu',                       'weekly', 5, 'siivous', i + 2);
  i := i + 10;

  -- Lauantai (6)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, schedule_day, signoff_type, sort_order) values
    (loc_id, 'Venyttelytila ja leikkihuone (2. krs)', 'Lelut pesty', 'weekly', 6, 'siivous', i + 1);
  i := i + 10;

  -- ── KUUKAUSITTAISET TEHTÄVÄT ───────────────────────────────────────────────

  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Ilmastointi',        'Tulo- ja poistoilmaventtiilien pinnat pyyhitty (asentoa ei muuteta)',             'monthly', 'siivous', i + 1),
    (loc_id, 'Korkeat pinnat',     'Korkeat vaakapinnat, ikkunalaudat, ovien yläkarmit, kaapit päältä pyyhitty',     'monthly', 'siivous', i + 2),
    (loc_id, 'Laitteiden aluset',  'Laitteiden alustojen ja siirrettävien laitteiden alta imuroitu',                 'monthly', 'siivous', i + 3),
    (loc_id, 'Pukukaapit',         'Tyhjien pukukaappien sisäpinnat pyyhitty',                                       'monthly', 'siivous', i + 4),
    (loc_id, 'Roska-astiat',       'Roska-astioiden pesu',                                                           'monthly', 'siivous', i + 5),
    (loc_id, 'Kylmälaitteet',      'Jääkaapin ja kylmäkaapin pesu',                                                  'monthly', 'siivous', i + 6);
  i := i + 10;

  -- ── PERUSPUHDISTUS (heinäkuu ja tammikuu) ─────────────────────────────────

  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Peruspuhdistus', 'Saunojen perusteellinen pesu ja kuivatus, lauteiden tarkistus (halkeamat, home)',  'deep_clean', 'siivous', i + 1),
    (loc_id, 'Peruspuhdistus', 'Pesuhuoneiden saumat, kalkinpoisto suihkuista ja hanoista',                        'deep_clean', 'siivous', i + 2),
    (loc_id, 'Peruspuhdistus', 'Kumimaton pesu koko alueelta ja kaikkien laitteiden siirto',                       'deep_clean', 'siivous', i + 3),
    (loc_id, 'Peruspuhdistus', 'Lattioiden PU- ja akryylipintojen perusteellinen puhdistus',                       'deep_clean', 'siivous', i + 4),
    (loc_id, 'Peruspuhdistus', 'Ikkunat sisäpuolelta, valaisimet ulottuvilta osin',                                 'deep_clean', 'siivous', i + 5),
    (loc_id, 'Peruspuhdistus', 'Kuntosalin ja pukuhuoneiden seinäpinnat puhdistettu',                              'deep_clean', 'siivous', i + 6);

end $$;
