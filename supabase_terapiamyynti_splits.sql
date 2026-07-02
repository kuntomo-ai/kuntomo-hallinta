-- Add splits column to terapiamyynti to store per-payment-method amounts
-- when a sale uses multiple payment methods (e.g. Maksupääte 30€ + Hyvinvointietu 20€).
-- Enables correct Tilitettävä-summa calculation where the discount is applied
-- only to the hyvinvointietu/lahjakortti portion, not the whole sale.

alter table terapiamyynti add column if not exists splits jsonb;
