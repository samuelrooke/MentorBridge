-- Waiting list (version 3): one table for all three segments, with the fields
-- each segment fills in, consent, and where the visitor came from.
-- The table keeps its old name (pilot_requests) so the API, scripts and earlier rows keep working.
-- Old columns (field, interns_per_year) stay for earlier sign-ups; new sign-ups don't fill them.

alter table public.pilot_requests
  -- Everyone
  add column name            text check (length(name) between 1 and 100),
  add column sector          text check (sector in (
    'ict', 'engineering', 'construction', 'logistics', 'healthcare', 'business', 'finance',
    'law', 'education', 'government', 'media', 'hospitality', 'other'
  )),
  add column availability    text[] check (availability <@ array['weekdays', 'evenings', 'weekends']),
  add column consent_at      timestamptz,
  -- Companies
  add column job_title       text check (length(job_title) between 1 and 100),
  add column company_size    text check (company_size in ('1-49', '50-249', '250-999', '1000+')),
  add column interest        text check (interest in ('internal', 'white_label', 'both')),
  -- Mentors
  add column age_range       text check (age_range in ('under-55', '55-59', '60-64', '65-69', '70+')),
  add column hours_per_month text check (hours_per_month in ('1-2', '3-5', '6-10', '10+')),
  -- Students
  add column skills_help     text check (skills_help in ('soft', 'hard', 'both')),
  -- Where the visitor came from (no IP address, no cookies)
  add column utm_source      text check (length(utm_source) <= 100),
  add column utm_medium      text check (length(utm_medium) <= 100),
  add column utm_campaign    text check (length(utm_campaign) <= 100),
  add column referrer        text check (length(referrer) <= 200),
  add column landing_path    text check (length(landing_path) <= 200);

-- Required fields per segment. NOT VALID: earlier sign-ups (before the waiting list) are not checked.
alter table public.pilot_requests drop constraint pilot_requests_fields_per_role;
alter table public.pilot_requests
  add constraint pilot_requests_waitlist_fields check (
    consent_at is not null and name is not null and (
      (role = 'company' and company is not null and sector is not null and job_title is not null)
      or (role = 'mentor' and age_range is not null and hours_per_month is not null and availability is not null)
      or (role = 'student' and sector is not null and skills_help is not null and availability is not null)
    )
  ) not valid;

-- The same email can sign up once per segment. Remove earlier duplicates first, keeping the oldest row.
delete from public.pilot_requests a
  using public.pilot_requests b
  where a.role = b.role
    and lower(a.email) = lower(b.email)
    and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));

create unique index pilot_requests_role_email_key on public.pilot_requests (role, lower(email));
