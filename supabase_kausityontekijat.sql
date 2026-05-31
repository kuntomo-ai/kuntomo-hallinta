-- Aja tämä Supabase SQL Editorissa (https://supabase.com/dashboard/project/ogboigmanmeepaoqepil/sql)

CREATE TABLE IF NOT EXISTS public.kausityontekijat (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etunimi         text NOT NULL,
  sukunimi        text NOT NULL,
  sahkoposti      text,
  tyoaika_alkaa   date,
  tyoaika_paattyy date,
  sali            text,
  sopimus         boolean DEFAULT false,
  verokortti      boolean DEFAULT false,
  kesatyoseteli   boolean DEFAULT false,
  paidan_koko     text,
  huomiot         text,
  liite1          text,
  liite2          text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.kausityontekijat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.kausityontekijat
  FOR ALL TO service_role USING (true) WITH CHECK (true);
