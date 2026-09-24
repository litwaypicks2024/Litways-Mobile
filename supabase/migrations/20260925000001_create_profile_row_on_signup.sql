-- Signup relies on a trigger to create the public.users row (the client can't:
-- it has no session yet under email confirmation). This trigger was missing,
-- which left accounts without a profile so profile edits silently matched no row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.users (id, first_name, last_name, email, city, country, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    '',
    '',
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill accounts that signed up while no trigger existed.
insert into public.users (id, first_name, last_name, email, city, country, role)
select a.id,
       coalesce(nullif(a.raw_user_meta_data->>'first_name', ''), ''),
       nullif(a.raw_user_meta_data->>'last_name', ''),
       a.email, '', '', 'customer'
from auth.users a
left join public.users u on u.id = a.id
where u.id is null
on conflict (id) do nothing;
