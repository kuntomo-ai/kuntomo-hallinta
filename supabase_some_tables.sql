-- SOME-analytiikkataulut: YouTube, Google Search Console, LinkedIn
-- Aja Supabase SQL Editorissa ennen kuin SOME-sivu hakee dataa.

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
  created_at timestamptz not null default now(),
  unique(channel_id, snapshot_date)
);

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

-- ── LinkedIn ──────────────────────────────────────────────────────────────────

create table if not exists li_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null unique,
  name text,
  vanity_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists li_page_snapshots (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references li_pages(id) on delete cascade,
  snapshot_date date not null,
  followers bigint,
  impressions bigint,
  reactions int,
  comments int,
  shares int,
  created_at timestamptz not null default now(),
  unique(page_id, snapshot_date)
);

create table if not exists li_posts (
  id text primary key,
  page_id uuid not null references li_pages(id) on delete cascade,
  published_at timestamptz,
  text_content text,
  post_url text,
  media_type text,
  created_at timestamptz not null default now()
);

create table if not exists li_post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references li_posts(id) on delete cascade,
  snapshot_date date not null,
  impressions bigint,
  clicks int,
  reactions int,
  comments int,
  shares int,
  created_at timestamptz not null default now(),
  unique(post_id, snapshot_date)
);

-- ── RLS: autentikoituneet käyttäjät voivat lukea kaiken ──────────────────────

alter table yt_channels enable row level security;
alter table yt_channel_snapshots enable row level security;
alter table yt_videos enable row level security;
alter table yt_video_metrics enable row level security;
alter table gsc_properties enable row level security;
alter table gsc_weekly_summary enable row level security;
alter table gsc_top_queries enable row level security;
alter table li_pages enable row level security;
alter table li_page_snapshots enable row level security;
alter table li_posts enable row level security;
alter table li_post_metrics enable row level security;

create policy "auth_read_yt_channels"         on yt_channels         for select to authenticated using (true);
create policy "auth_read_yt_snapshots"        on yt_channel_snapshots for select to authenticated using (true);
create policy "auth_read_yt_videos"           on yt_videos           for select to authenticated using (true);
create policy "auth_read_yt_video_metrics"    on yt_video_metrics    for select to authenticated using (true);
create policy "auth_read_gsc_properties"      on gsc_properties      for select to authenticated using (true);
create policy "auth_read_gsc_weekly_summary"  on gsc_weekly_summary  for select to authenticated using (true);
create policy "auth_read_gsc_top_queries"     on gsc_top_queries     for select to authenticated using (true);
create policy "auth_read_li_pages"            on li_pages            for select to authenticated using (true);
create policy "auth_read_li_page_snapshots"   on li_page_snapshots   for select to authenticated using (true);
create policy "auth_read_li_posts"            on li_posts            for select to authenticated using (true);
create policy "auth_read_li_post_metrics"     on li_post_metrics     for select to authenticated using (true);
