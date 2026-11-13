alter table public.student_profiles
  add column if not exists internship_start_preference text
  check (internship_start_preference in ('spring', 'summer', 'autumn', 'specific_date'));