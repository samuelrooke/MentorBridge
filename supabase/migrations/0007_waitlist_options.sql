-- Waiting list options, 11 November 2026.
-- Mentors are now people with free time next to their job (not retirees), so the age ranges cover
-- all working ages. Companies can also ask for a mentor for their interns ('external'), so the form
-- matches the three ways on the companies page: own staff, a mentor for the interns, white label.
-- No rows used age_range or interest when this was written, so the old values can go.

alter table public.pilot_requests drop constraint pilot_requests_age_range_check;
alter table public.pilot_requests
  add constraint pilot_requests_age_range_check check (age_range in ('under-30', '30-39', '40-49', '50-59', '60+'));

alter table public.pilot_requests drop constraint pilot_requests_interest_check;
alter table public.pilot_requests
  add constraint pilot_requests_interest_check check (interest in ('internal', 'external', 'white_label'));
