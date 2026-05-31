-- marketing_newsletters: overrides for pre-written monthly newsletters
create table if not exists marketing_newsletters (
  id           uuid primary key default gen_random_uuid(),
  alue         text not null,           -- 'kuntosali' | 'hieronta' | 'valmennus'
  month_idx    int  not null,           -- 0–11 (January = 0)
  otsikko      text,
  ingressi     text,
  sisalto      text,
  tarjous      text,
  cta          text,
  updated_at   timestamptz default now(),
  constraint marketing_newsletters_alue_month_idx_key unique (alue, month_idx)
);

-- RLS
alter table marketing_newsletters enable row level security;

-- service_role bypasses RLS automatically; authenticated users can read
create policy "Authenticated can read newsletters"
  on marketing_newsletters for select
  using (auth.role() = 'authenticated');

create policy "Service role full access newsletters"
  on marketing_newsletters for all
  using (auth.role() = 'service_role');
