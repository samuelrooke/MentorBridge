-- Let students and mentors sign up on the landing page too.
-- Companies still need a company name and interns per year; students and
-- mentors give their field instead.

alter table public.pilot_requests
  add column role text not null default 'company' check (role in ('company', 'student', 'mentor')),
  add column field text check (length(field) <= 200),
  alter column company drop not null,
  alter column interns_per_year drop not null;

alter table public.pilot_requests
  add constraint pilot_requests_fields_per_role check (
    (role = 'company' and company is not null and interns_per_year is not null)
    or (role in ('student', 'mentor') and field is not null)
  );
