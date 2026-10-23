-- Siivous v2: Linnakangas, Etu-Lyötty ja Toppilansaari — päivittäiset siivoustehtävät
-- Aja supabase_siivous_tables.sql ja supabase_siivous_rls.sql ensin.
-- Idempotent: kukin lohko tarkistaa onko tehtävät jo olemassa.

-- ── Linnakangas ───────────────────────────────────────────────────────────────

do $$
declare
  loc_id     uuid;
  i          int := 0;
  task_count int;
begin
  select id into loc_id from siivous_locations where slug = 'linnakangas';
  if loc_id is null then
    raise notice 'Linnakangas-toimipistettä ei löydy. Aja ensin supabase_siivous_seed.sql.';
    return;
  end if;

  select count(*) into task_count from siivous_tasks where location_id = loc_id;
  if task_count > 0 then
    raise notice 'Linnakankaan tehtävät on jo lisätty (% kpl). Ohitetaan seed.', task_count;
    return;
  end if;

  -- Kuntosali
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Kuntosali', 'Lattia imuroitu ja nihkeäpyyhitty',                                   'daily', 'siivous', i + 1),
    (loc_id, 'Kuntosali', 'Laitteiden kahvat, istuimet ja penkit pyyhitty',                       'daily', 'siivous', i + 2),
    (loc_id, 'Kuntosali', 'Painot, tangot ja välineet paikoillaan',                               'daily', 'siivous', i + 3),
    (loc_id, 'Kuntosali', 'Puhdistuspisteissä suihketta ja paperia tarkistettu',                  'daily', 'siivous', i + 4),
    (loc_id, 'Kuntosali', 'Roska-astiat tyhjennetty',                                             'daily', 'siivous', i + 5),
    (loc_id, 'Kuntosali', 'Ovet ja kulunvalvonta tarkistettu',                                    'daily', 'siivous', i + 6);
  i := i + 10;

  -- Naisten pukuhuone
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Naisten pukuhuone', 'Lattia pesty, myös penkkien alta',             'daily', 'siivous', i + 1),
    (loc_id, 'Naisten pukuhuone', 'Penkit ja lokerikot pyyhitty',                 'daily', 'siivous', i + 2),
    (loc_id, 'Naisten pukuhuone', 'Peilit puhdistettu',                           'daily', 'siivous', i + 3),
    (loc_id, 'Naisten pukuhuone', 'Roskat tyhjennetty',                           'daily', 'siivous', i + 4);
  i := i + 10;

  -- Naisten WC ja suihku
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Naisten WC ja suihku', 'WC-istuin, allas ja hana puhdistettu',                          'daily', 'siivous', i + 1),
    (loc_id, 'Naisten WC ja suihku', 'Suihkut ja seinät pesty',                                       'daily', 'siivous', i + 2),
    (loc_id, 'Naisten WC ja suihku', 'Lattiakaivo puhdistettu, ei hiuksia',                            'daily', 'siivous', i + 3),
    (loc_id, 'Naisten WC ja suihku', 'Paperia, saippuaa ja käsipyyhkeitä täydennetty',                'daily', 'siivous', i + 4);
  i := i + 10;

  -- Miesten pukuhuone
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Miesten pukuhuone', 'Lattia pesty, myös penkkien alta',             'daily', 'siivous', i + 1),
    (loc_id, 'Miesten pukuhuone', 'Penkit ja lokerikot pyyhitty',                 'daily', 'siivous', i + 2),
    (loc_id, 'Miesten pukuhuone', 'Peilit puhdistettu',                           'daily', 'siivous', i + 3),
    (loc_id, 'Miesten pukuhuone', 'Roskat tyhjennetty',                           'daily', 'siivous', i + 4);
  i := i + 10;

  -- Miesten WC ja suihku
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Miesten WC ja suihku', 'WC-istuin, pisuaari, allas ja hana puhdistettu',                'daily', 'siivous', i + 1),
    (loc_id, 'Miesten WC ja suihku', 'Suihkut ja seinät pesty',                                       'daily', 'siivous', i + 2),
    (loc_id, 'Miesten WC ja suihku', 'Lattiakaivo puhdistettu, ei hiuksia',                            'daily', 'siivous', i + 3),
    (loc_id, 'Miesten WC ja suihku', 'Paperia, saippuaa ja käsipyyhkeitä täydennetty',                'daily', 'siivous', i + 4);
  i := i + 10;

  -- Yleisilme
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Yleisilme', 'Ei hajuhaittoja tarkistettu',                              'daily', 'siivous', i + 1),
    (loc_id, 'Yleisilme', 'Valaisimet toimivat tarkistettu',                          'daily', 'siivous', i + 2),
    (loc_id, 'Yleisilme', 'Siivouskomero lukittu ja järjestyksessä tarkistettu',      'daily', 'siivous', i + 3);

end $$;

-- ── Etu-Lyötty ────────────────────────────────────────────────────────────────

do $$
declare
  loc_id     uuid;
  i          int := 0;
  task_count int;
begin
  select id into loc_id from siivous_locations where slug = 'etu-lyotty';
  if loc_id is null then
    raise notice 'Etu-Lyötty-toimipistettä ei löydy. Aja ensin supabase_siivous_seed.sql.';
    return;
  end if;

  select count(*) into task_count from siivous_tasks where location_id = loc_id;
  if task_count > 0 then
    raise notice 'Etu-Lyötyn tehtävät on jo lisätty (% kpl). Ohitetaan seed.', task_count;
    return;
  end if;

  -- Tuulikaappi, aula ja porrashuoneet
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Tuulikaappi, aula ja porrashuoneet', 'Lattiat puhtaat ja kuivat',                         'daily', 'siivous', i + 1),
    (loc_id, 'Tuulikaappi, aula ja porrashuoneet', 'Ovien kahvat ja lasit pyyhitty',                    'daily', 'siivous', i + 2),
    (loc_id, 'Tuulikaappi, aula ja porrashuoneet', 'Kenkätelineet siistit',                             'daily', 'siivous', i + 3),
    (loc_id, 'Tuulikaappi, aula ja porrashuoneet', 'Kaiteet pyyhitty, ei roskia',                       'daily', 'siivous', i + 4);
  i := i + 10;

  -- Myyntitiski
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Myyntitiski', 'Tiski ja pinnat pyyhitty',                           'daily', 'siivous', i + 1),
    (loc_id, 'Myyntitiski', 'Juomakaapin kahvat pyyhitty',                        'daily', 'siivous', i + 2),
    (loc_id, 'Myyntitiski', 'Tuotteet siististi, ei vanhentuneita tarkistettu',   'daily', 'siivous', i + 3);
  i := i + 10;

  -- Kuntosali, 1. krs
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Kuntosali, 1. krs', 'Lattia imuroitu ja nihkeäpyyhitty',                             'daily', 'siivous', i + 1),
    (loc_id, 'Kuntosali, 1. krs', 'Laitteiden kahvat, istuimet ja penkit pyyhitty',                'daily', 'siivous', i + 2),
    (loc_id, 'Kuntosali, 1. krs', 'Painot telineissä',                                             'daily', 'siivous', i + 3),
    (loc_id, 'Kuntosali, 1. krs', 'Puhdistuspisteessä suihketta ja paperia tarkistettu',           'daily', 'siivous', i + 4),
    (loc_id, 'Kuntosali, 1. krs', 'Roska-astiat tyhjennetty',                                      'daily', 'siivous', i + 5);
  i := i + 10;

  -- Kuntosalit, kellari
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Kuntosalit, kellari', 'Lattiat siivottu',                                             'daily', 'siivous', i + 1),
    (loc_id, 'Kuntosalit, kellari', 'Laitteiden kosketuspinnat pyyhitty',                           'daily', 'siivous', i + 2),
    (loc_id, 'Kuntosalit, kellari', 'Painot telineissä',                                            'daily', 'siivous', i + 3),
    (loc_id, 'Kuntosalit, kellari', 'Puhdistuspisteet täydennetty',                                 'daily', 'siivous', i + 4),
    (loc_id, 'Kuntosalit, kellari', 'Molemmat poistumistiet vapaina tarkistettu',                   'daily', 'siivous', i + 5);
  i := i + 10;

  -- Posetila
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Posetila', 'Lattia siivottu',                          'daily', 'siivous', i + 1),
    (loc_id, 'Posetila', 'Peilit puhdistettu',                       'daily', 'siivous', i + 2),
    (loc_id, 'Posetila', 'Pinnat pyyhitty',                          'daily', 'siivous', i + 3),
    (loc_id, 'Posetila', 'Ei ylimääräistä tavaraa',                  'daily', 'siivous', i + 4);
  i := i + 10;

  -- Pukuhuoneet N ja M
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Pukuhuoneet N ja M', 'Lattiat pesty, myös penkkien alta',                   'daily', 'siivous', i + 1),
    (loc_id, 'Pukuhuoneet N ja M', 'Penkit ja kaapit pyyhitty',                           'daily', 'siivous', i + 2),
    (loc_id, 'Pukuhuoneet N ja M', 'Peilit puhdistettu',                                  'daily', 'siivous', i + 3),
    (loc_id, 'Pukuhuoneet N ja M', 'Hiustenkuivaajat pyyhitty',                           'daily', 'siivous', i + 4),
    (loc_id, 'Pukuhuoneet N ja M', 'Roskat tyhjennetty, ei unohtuneita tavaroita',        'daily', 'siivous', i + 5);
  i := i + 10;

  -- Pesuhuoneet N ja M
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Pesuhuoneet N ja M', 'Lattiat ja seinät roiskealueelta pesty',              'daily', 'siivous', i + 1),
    (loc_id, 'Pesuhuoneet N ja M', 'Suihkut puhdistettu',                                'daily', 'siivous', i + 2),
    (loc_id, 'Pesuhuoneet N ja M', 'Lattiakaivot puhdistettu, ei hiuksia',               'daily', 'siivous', i + 3),
    (loc_id, 'Pesuhuoneet N ja M', 'Saippua-annostelijat täydennetty',                   'daily', 'siivous', i + 4);
  i := i + 10;

  -- Saunat N ja M
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Saunat N ja M', 'Lauteet ja lattia puhdistettu',                           'daily', 'siivous', i + 1),
    (loc_id, 'Saunat N ja M', 'Kiukaan päällä ei mitään tarkistettu',                    'daily', 'siivous', i + 2),
    (loc_id, 'Saunat N ja M', 'Lasiovi puhdistettu',                                     'daily', 'siivous', i + 3);
  i := i + 10;

  -- WC-tilat (pukuhuoneet, inva-WC)
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'WC-tilat (pukuhuoneet, inva-WC)', 'Istuimet ja pisuaarit puhdistettu',                        'daily', 'siivous', i + 1),
    (loc_id, 'WC-tilat (pukuhuoneet, inva-WC)', 'Altaat, hanat ja peilit puhdistettu',                      'daily', 'siivous', i + 2),
    (loc_id, 'WC-tilat (pukuhuoneet, inva-WC)', 'Lattia pesty',                                             'daily', 'siivous', i + 3),
    (loc_id, 'WC-tilat (pukuhuoneet, inva-WC)', 'Paperia, saippuaa ja käsipyyhkeitä täydennetty',           'daily', 'siivous', i + 4),
    (loc_id, 'WC-tilat (pukuhuoneet, inva-WC)', 'Roskat tyhjennetty',                                       'daily', 'siivous', i + 5);
  i := i + 10;

  -- Solarium
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Solarium', 'Akryylipinnat ja kahvat pyyhitty',                              'daily', 'siivous', i + 1),
    (loc_id, 'Solarium', 'Lattia siivottu',                                               'daily', 'siivous', i + 2),
    (loc_id, 'Solarium', 'Käyttöohjeet ja ikärajamerkintä näkyvillä tarkistettu',         'daily', 'siivous', i + 3),
    (loc_id, 'Solarium', 'Silmäsuojat saatavilla tarkistettu',                            'daily', 'siivous', i + 4);
  i := i + 10;

  -- Taukotila ja WC
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Taukotila ja WC', 'Pöydät, keittiötaso ja allas pyyhitty',   'daily', 'siivous', i + 1),
    (loc_id, 'Taukotila ja WC', 'Mikro puhdistettu',                       'daily', 'siivous', i + 2),
    (loc_id, 'Taukotila ja WC', 'Jääkaappi tarkistettu',                   'daily', 'siivous', i + 3),
    (loc_id, 'Taukotila ja WC', 'Lattia siivottu',                         'daily', 'siivous', i + 4),
    (loc_id, 'Taukotila ja WC', 'Roskat tyhjennetty',                      'daily', 'siivous', i + 5);
  i := i + 10;

  -- Siivoustila ja yleisilme
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Siivoustila ja yleisilme', 'Siivoustila lukittu ja järjestyksessä tarkistettu',    'daily', 'siivous', i + 1),
    (loc_id, 'Siivoustila ja yleisilme', 'Käyttöturvatiedotteet paikallaan tarkistettu',         'daily', 'siivous', i + 2),
    (loc_id, 'Siivoustila ja yleisilme', 'Valaisimet toimivat tarkistettu',                      'daily', 'siivous', i + 3);

end $$;

-- ── Toppilansaari ─────────────────────────────────────────────────────────────

do $$
declare
  loc_id     uuid;
  i          int := 0;
  task_count int;
begin
  select id into loc_id from siivous_locations where slug = 'toppilansaari';
  if loc_id is null then
    raise notice 'Toppilansaari-toimipistettä ei löydy. Aja ensin supabase_siivous_seed.sql.';
    return;
  end if;

  select count(*) into task_count from siivous_tasks where location_id = loc_id;
  if task_count > 0 then
    raise notice 'Toppilansaaren tehtävät on jo lisätty (% kpl). Ohitetaan seed.', task_count;
    return;
  end if;

  -- Aula ja odotustila
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Aula ja odotustila', 'Lattia siivottu',                                       'daily', 'siivous', i + 1),
    (loc_id, 'Aula ja odotustila', 'Tuolit ja pöydät pyyhitty',                             'daily', 'siivous', i + 2),
    (loc_id, 'Aula ja odotustila', 'Ovien kahvat ja ulko-oven lasi pyyhitty',               'daily', 'siivous', i + 3),
    (loc_id, 'Aula ja odotustila', 'Kenkätelineet siistit, roskat tyhjennetty',             'daily', 'siivous', i + 4);
  i := i + 10;

  -- Hoitohuoneet
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Hoitohuoneet', 'Lattiat siivottu, myös hoitopöydän alta',               'daily', 'siivous', i + 1),
    (loc_id, 'Hoitohuoneet', 'Hoitopöydät ja niskatuet puhdistettu',                  'daily', 'siivous', i + 2),
    (loc_id, 'Hoitohuoneet', 'Puhtaat tekstiilit vaihdettu',                          'daily', 'siivous', i + 3),
    (loc_id, 'Hoitohuoneet', 'Tasot ja hyllyt pyyhitty',                              'daily', 'siivous', i + 4),
    (loc_id, 'Hoitohuoneet', 'Roskat tyhjennetty',                                    'daily', 'siivous', i + 5);
  i := i + 10;

  -- Asiakas-WC
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Asiakas-WC', 'WC-istuin, allas, hana ja peili puhdistettu',                    'daily', 'siivous', i + 1),
    (loc_id, 'Asiakas-WC', 'Lattia ja lattiakaivo pesty',                                    'daily', 'siivous', i + 2),
    (loc_id, 'Asiakas-WC', 'Paperia, saippuaa ja käsipyyhkeitä täydennetty',                'daily', 'siivous', i + 3),
    (loc_id, 'Asiakas-WC', 'Roskat tyhjennetty',                                             'daily', 'siivous', i + 4);
  i := i + 10;

  -- Sosiaalitilat
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Sosiaalitilat', 'Pöydät, keittiötaso ja allas pyyhitty',                'daily', 'siivous', i + 1),
    (loc_id, 'Sosiaalitilat', 'Kahvinkeitin puhdistettu',                             'daily', 'siivous', i + 2),
    (loc_id, 'Sosiaalitilat', 'Jääkaappi tarkistettu',                               'daily', 'siivous', i + 3),
    (loc_id, 'Sosiaalitilat', 'Lattia siivottu',                                     'daily', 'siivous', i + 4),
    (loc_id, 'Sosiaalitilat', 'Roskat tyhjennetty',                                  'daily', 'siivous', i + 5),
    (loc_id, 'Sosiaalitilat', 'Käytetyt tekstiilit pyykissä tarkistettu',            'daily', 'siivous', i + 6);
  i := i + 10;

  -- Yleisilme
  insert into siivous_tasks (location_id, room, task_name, schedule_type, signoff_type, sort_order) values
    (loc_id, 'Yleisilme', 'Ei hajuhaittoja tarkistettu',                                  'daily', 'siivous', i + 1),
    (loc_id, 'Yleisilme', 'Valaisimet toimivat tarkistettu',                              'daily', 'siivous', i + 2),
    (loc_id, 'Yleisilme', 'Siivousvälineet kaapissa järjestyksessä tarkistettu',          'daily', 'siivous', i + 3);

end $$;
