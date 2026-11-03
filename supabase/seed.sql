-- Sample data for the LOCAL Supabase stack only (npm run db:reset).
-- Never run this against the real project. All addresses use example.com.

insert into public.pilot_requests (role, email, field, has_placement, applications_sent, help_wanted, needed_by, answered_at)
values
  ('student', 'student.one@example.com', 'ICT', 'no', '11-30', array['cv', 'interviews'], '0-3', now()),
  ('student', 'student.two@example.com', 'Finance', null, null, null, null, null);

insert into public.pilot_requests (role, email, field)
values ('mentor', 'mentor.one@example.com', 'Backend development');

insert into public.pilot_requests (role, email, company, interns_per_year)
values ('company', 'hr@example.com', 'Example Organization', '3-5');
