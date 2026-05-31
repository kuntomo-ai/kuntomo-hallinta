-- Add admin_only column to sport_hockey_pipeline
-- Run this in Supabase SQL Editor
ALTER TABLE sport_hockey_pipeline
ADD COLUMN IF NOT EXISTS admin_only boolean NOT NULL DEFAULT false;
