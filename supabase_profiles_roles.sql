-- Add multi-role support to profiles.
-- The singular `role` column (Postgres enum app_role) stays as the primary role
-- for backward compat. Cast to text since trim/string_to_array don't accept enums.

alter table profiles
  add column if not exists roles text[] not null default '{}';

-- Backfill existing comma-separated role strings into the new array.
-- Idempotent: only fills empty arrays so re-running is safe.
update profiles
   set roles = (
     select array_agg(trim(part))
       from unnest(string_to_array(role::text, ',')) as part
      where trim(part) <> ''
   )
 where role is not null
   and trim(role::text) <> ''
   and coalesce(array_length(roles, 1), 0) = 0;
