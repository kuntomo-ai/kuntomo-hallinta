-- Admin/hallitus/respa saa INSERT/UPDATE/DELETE mobilepay_transactions-tauluun.
-- Aiemmin (vaihe 1) lisättiin vain SELECT — CSV-tuonti epäonnistuu ilman INSERT-policya.

do $$
declare pol record;
begin
  for pol in
    select policyname, cmd from pg_policies
    where schemaname='public' and tablename='mobilepay_transactions' and cmd in ('INSERT','UPDATE','DELETE')
  loop
    execute format('drop policy if exists %I on public.mobilepay_transactions', pol.policyname);
  end loop;
end $$;

create policy "staff_insert_mobilepay" on public.mobilepay_transactions for insert
  to authenticated
  with check (public.has_role(array['admin','hallitus','manager','respa']));

create policy "staff_update_mobilepay" on public.mobilepay_transactions for update
  to authenticated
  using (public.has_role(array['admin','hallitus','manager','respa']));

create policy "staff_delete_mobilepay" on public.mobilepay_transactions for delete
  to authenticated
  using (public.has_role(array['admin','hallitus','manager','respa']));
