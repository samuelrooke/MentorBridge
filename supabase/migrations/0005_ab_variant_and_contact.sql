-- A/B test: which hero headline a sign-up saw ('a' or 'b').
alter table public.pilot_requests
  add column variant text check (variant in ('a', 'b'));

-- Messages from the contact form on the landing page.
-- Written only by the Node API with the secret key. Row level security is on with
-- no policies, so the publishable key can neither read nor write this table.
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 100),
  email       text not null check (length(email) <= 254),
  message     text not null check (length(message) between 1 and 2000),
  created_at  timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
