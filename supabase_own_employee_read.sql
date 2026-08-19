-- Salli käyttäjän lukea OMA employees-rivinsä (auth_user_id-linkin kautta).
-- AuthContext.jsx tarkistaa employees.status = 'inactive' → tarvitsee luku-oikeuden.
-- Ei laajenna näkyvyyttä muille — käyttäjä näkee vain oman rivinsä.
--
-- Aja Supabase Dashboard → SQL Editor → Run.

create policy "user reads own employees row"
  on public.employees for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Salli myös oma-profiilin luku (jos ei jo olemassa)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and cmd='SELECT'
      and policyname = 'user reads own profile'
  ) then
    create policy "user reads own profile"
      on public.profiles for select
      to authenticated
      using (id = auth.uid());
  end if;
end $$;
