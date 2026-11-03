-- Optional follow-up questions that students answer right after signing up.
-- All columns are nullable: students can skip the questions.

alter table public.pilot_requests
  add column has_placement text check (has_placement in ('yes', 'no')),
  add column applications_sent text check (applications_sent in ('0', '1-10', '11-30', '30+')),
  add column help_wanted text[] check (help_wanted <@ array['cv', 'interviews', 'insight', 'introductions']),
  add column needed_by text check (needed_by in ('0-3', '3-6', 'later')),
  add column answered_at timestamptz;
