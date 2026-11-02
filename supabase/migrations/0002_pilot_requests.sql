-- Pilot requests from the landing page (validation test).
-- Written only by the Node API with the service-role key. Row level security is on
-- with no policies, so the publishable key can neither read nor write this table.

create table public.pilot_requests (
  id                uuid primary key default gen_random_uuid(),
  email             text not null check (length(email) <= 254),
  company           text not null check (length(company) between 1 and 200),
  interns_per_year  text not null check (interns_per_year in ('1-2', '3-5', '6-10', '10+')),
  created_at        timestamptz not null default now()
);

alter table public.pilot_requests enable row level security;
