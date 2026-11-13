-- One account per email address.
--
-- Supabase Auth already refuses a second login with the same email. This makes the
-- profiles table hold the same rule, case-insensitively, and keeps profiles.email in
-- step when someone changes their email, so the rule can't drift.

-- Bring profile emails in line with the login emails first (the copy is only made at sign-up).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create unique index profiles_email_unique on public.profiles (lower(email));

create function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
