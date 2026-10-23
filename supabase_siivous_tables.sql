-- Siivousjärjestelmä v2: automaattiset päiväkirjaukset
-- Korvaa vanhan siivous-skeeman kokonaan.
-- Aja Supabase SQL Editorissa. Idempotent.

-- ── Poistetaan v1-taulut (ei tuotantodataa) ───────────────────────────────────

drop table if exists siivous_signoff_items cascade;
drop table if exists siivous_signoffs         cascade;

-- ── Toimipisteet ───────────────────────────────────────────────────────────────

create table if not exists siivous_locations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  slug            text not null unique,
  sort_order      int  not null default 0,
  is_active       boolean not null default true,
  siivous_days    int[] not null default '{}',   -- JS weekdays: 0=su..6=la
  tarkistus_days  int[] not null default '{}',
  supervisor_id   uuid references auth.users(id) on delete set null,
  supervisor_name text,
  scheduled_by    text,  -- vain tiedoksi: "Jhunie Aquino, Mario Aquino"
  created_at      timestamptz not null default now()
);

-- ── Tehtävät (säilyy ennallaan) ───────────────────────────────────────────────

create table if not exists siivous_tasks (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references siivous_locations(id) on delete cascade,
  room          text not null,
  task_name     text not null,
  schedule_type text not null check (schedule_type in ('daily', 'weekly', 'monthly', 'deep_clean')),
  schedule_day  int  check (schedule_day between 0 and 6),
  constraint weekly_tasks_require_day check (schedule_type != 'weekly' or schedule_day is not null),
  signoff_type  text not null default 'siivous' check (signoff_type in ('siivous', 'tarkistus')),
  sort_order    int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Päiväkirjaukset (luodaan automaattisesti cronilla) ────────────────────────

create table if not exists siivous_day_logs (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid not null references siivous_locations(id) on delete restrict,
  log_date         date not null,
  log_type         text not null check (log_type in ('siivous', 'tarkistus')),
  entry_type       text not null default 'auto'
                     check (entry_type in ('auto', 'siivooja_signoff')),
  status           text not null default 'aikataulun_mukainen'
                     check (status in ('aikataulun_mukainen', 'poikkeuspäivä')),
  created_by_type  text not null default 'system'
                     check (created_by_type in ('system', 'siivooja')),
  created_by_name  text not null default 'Järjestelmä',
  notes            text,
  created_at       timestamptz not null default now(),
  unique (location_id, log_date, log_type)
);

-- ── Päiväkirjauksen tehtävärivit (snapshot) ───────────────────────────────────

create table if not exists siivous_day_log_items (
  id          uuid primary key default gen_random_uuid(),
  log_id      uuid not null references siivous_day_logs(id) on delete cascade,
  task_id     uuid references siivous_tasks(id) on delete set null,
  task_name   text not null,
  room        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Poikkeukset (valvoja jälkikäteen) ────────────────────────────────────────

create table if not exists siivous_exceptions (
  id                uuid primary key default gen_random_uuid(),
  log_id            uuid not null references siivous_day_logs(id) on delete cascade,
  exception_type    text not null
                      check (exception_type in ('ei_toteutunut', 'osittain_tekematta')),
  reason            text not null,
  corrective_action text,
  supervisor_id     uuid references auth.users(id) on delete set null,
  supervisor_name   text,
  created_at        timestamptz not null default now()
);

-- Tekemättä jääneet tehtävät poikkeukseen (osittain_tekematta)
create table if not exists siivous_exception_tasks (
  id           uuid primary key default gen_random_uuid(),
  exception_id uuid not null references siivous_exceptions(id) on delete cascade,
  task_id      uuid references siivous_tasks(id) on delete set null,
  task_name    text not null
);

-- ── Ennalta merkityt poikkeuspäivät (suljettu/arkipyhä) ──────────────────────

create table if not exists siivous_closed_days (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references siivous_locations(id) on delete cascade,
  closed_date     date not null,
  reason          text not null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  unique (location_id, closed_date)
);

-- ── Siisteystarkastukset (valvoja viikoittain) ────────────────────────────────

create table if not exists siivous_inspections (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid not null references siivous_locations(id) on delete restrict,
  inspection_date  date not null,
  inspector_id     uuid references auth.users(id) on delete set null,
  inspector_name   text,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table if not exists siivous_inspection_rooms (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references siivous_inspections(id) on delete cascade,
  room          text not null,
  status        text not null check (status in ('siisti', 'huomautettavaa')),
  notes         text,
  image_path    text,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ── Vikailmoitukset (irrotettu kuittauksesta) ─────────────────────────────────

create table if not exists siivous_faults (
  id                uuid primary key default gen_random_uuid(),
  day_log_id        uuid references siivous_day_logs(id) on delete set null,
  location_id       uuid not null references siivous_locations(id) on delete restrict,
  category          text not null,
  description       text not null,
  status            text not null default 'avoin'
                      check (status in ('avoin', 'työn alla', 'korjattu')),
  reported_by_id    uuid references auth.users(id) on delete set null,
  reported_by_name  text,
  reported_at       timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by_name  text,
  corrective_action text,
  created_at        timestamptz not null default now()
);

create table if not exists siivous_fault_images (
  id            uuid primary key default gen_random_uuid(),
  fault_id      uuid not null references siivous_faults(id) on delete cascade,
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

-- ── Profiilit: sijaintikohtainen pääsy ────────────────────────────────────────

alter table profiles add column if not exists location_access text[] not null default '{}';

-- ── Indeksit ──────────────────────────────────────────────────────────────────

create index if not exists idx_siivous_tasks_location    on siivous_tasks(location_id);
create index if not exists idx_siivous_day_logs_location on siivous_day_logs(location_id);
create index if not exists idx_siivous_day_logs_date     on siivous_day_logs(log_date);
create index if not exists idx_siivous_log_items_log     on siivous_day_log_items(log_id);
create index if not exists idx_siivous_exceptions_log    on siivous_exceptions(log_id);
create index if not exists idx_siivous_faults_location   on siivous_faults(location_id);
create index if not exists idx_siivous_inspections_loc   on siivous_inspections(location_id);
