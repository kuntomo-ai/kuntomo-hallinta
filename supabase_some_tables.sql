-- SOME-analytiikkataulut: YouTube, Google Search Console
-- Google OAuth token storage (RLS enabled, no client policies = service role only)
-- Aja Supabase SQL Editorissa ennen kuin SOME-sivu hakee dataa.
-- Turvallinen ajaa uudelleen: käyttää IF NOT EXISTS kaikkialla.

-- ── YouTube ───────────────────────────────────────────────────────────────────

create table if not exists yt_channels (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null unique,
  title text,
  handle text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists yt_channel_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  snapshot_date date not null,
  subscribers bigint,
  total_views bigint,
  video_count int,
  watch_time_minutes bigint,
  created_at timestamptz not null default now(),
  unique(channel_id, snapshot_date)
);

-- Migration: add column to existing installations
alter table yt_channel_snapshots add column if not exists watch_time_minutes bigint;

create table if not exists yt_videos (
  id text primary key,
  channel_id uuid not null references yt_channels(id) on delete cascade,
  title text,
  published_at timestamptz,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists yt_video_metrics (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references yt_videos(id) on delete cascade,
  snapshot_date date not null,
  views bigint,
  likes int,
  comments int,
  created_at timestamptz not null default now(),
  unique(video_id, snapshot_date)
);

-- ── Google Search Console ─────────────────────────────────────────────────────

create table if not exists gsc_properties (
  id uuid primary key default gen_random_uuid(),
  site_url text not null unique,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists gsc_weekly_summary (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references gsc_properties(id) on delete cascade,
  week_start date not null,
  clicks bigint,
  impressions bigint,
  ctr numeric(6,4),
  position numeric(6,2),
  created_at timestamptz not null default now(),
  unique(property_id, week_start)
);

create table if not exists gsc_top_queries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references gsc_properties(id) on delete cascade,
  week_start date not null,
  query text,
  clicks bigint,
  impressions bigint,
  ctr numeric(6,4),
  position numeric(6,2),
  created_at timestamptz not null default now()
);

-- ── Google OAuth token storage ────────────────────────────────────────────────
-- RLS enabled, no policies → only service_role can access.
-- anon ja authenticated roolit revoke'd explicitly.

create table if not exists google_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text,
  created_at timestamptz not null default now()
);
alter table google_oauth_tokens enable row level security;
revoke all on google_oauth_tokens from anon, authenticated;

-- OAuth state for CSRF protection (poistetaan callback-kutsussa, TTL 15 min)
create table if not exists google_oauth_state (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table google_oauth_state enable row level security;
revoke all on google_oauth_state from anon, authenticated;

-- ── RLS: autentikoituneet käyttäjät voivat lukea analytiikkataulut ────────────

alter table yt_channels enable row level security;
alter table yt_channel_snapshots enable row level security;
alter table yt_videos enable row level security;
alter table yt_video_metrics enable row level security;
alter table gsc_properties enable row level security;
alter table gsc_weekly_summary enable row level security;
alter table gsc_top_queries enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='yt_channels' and policyname='auth_read_yt_channels') then
    create policy "auth_read_yt_channels" on yt_channels for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='yt_channel_snapshots' and policyname='auth_read_yt_snapshots') then
    create policy "auth_read_yt_snapshots" on yt_channel_snapshots for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='yt_videos' and policyname='auth_read_yt_videos') then
    create policy "auth_read_yt_videos" on yt_videos for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='yt_video_metrics' and policyname='auth_read_yt_video_metrics') then
    create policy "auth_read_yt_video_metrics" on yt_video_metrics for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='gsc_properties' and policyname='auth_read_gsc_properties') then
    create policy "auth_read_gsc_properties" on gsc_properties for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='gsc_weekly_summary' and policyname='auth_read_gsc_weekly_summary') then
    create policy "auth_read_gsc_weekly_summary" on gsc_weekly_summary for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='gsc_top_queries' and policyname='auth_read_gsc_top_queries') then
    create policy "auth_read_gsc_top_queries" on gsc_top_queries for select to authenticated using (true);
  end if;
end $$;
