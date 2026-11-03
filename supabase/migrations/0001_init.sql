-- MentorBridge MVP schema.
-- Run in the Supabase SQL editor, or with `supabase db push` if you use the Supabase CLI.

-- ---------------------------------------------------------------------------
-- Roles and base profile
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('student', 'company', 'mentor', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

-- Create a profile whenever someone signs up. The role comes from the signup
-- metadata; "admin" can never be self-assigned and must be set in the dashboard.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when requested in ('student', 'company', 'mentor')
         then requested::public.user_role
         else 'student'::public.user_role end,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Intake: role-specific profiles
-- ---------------------------------------------------------------------------

create table public.student_profiles (
  id                uuid primary key references public.profiles (id) on delete cascade,
  field_of_study    text,
  internship_type   text,
  internship_start  date,
  interests         text,
  learning_goals    text,
  updated_at        timestamptz not null default now()
);

-- The company and role brief: what the company expects from its intern.
create table public.company_profiles (
  id                   uuid primary key references public.profiles (id) on delete cascade,
  organisation_name    text,
  internship_position  text,
  expectations         text,
  tools                text,
  first_tasks          text,
  updated_at           timestamptz not null default now()
);

create table public.mentor_profiles (
  id            uuid primary key references public.profiles (id) on delete cascade,
  background    text,
  expertise     text,
  availability  text,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Matching (manual, done by an admin)
-- ---------------------------------------------------------------------------

create type public.match_status as enum ('proposed', 'active', 'completed', 'cancelled');

create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  mentor_id   uuid not null references public.profiles (id) on delete cascade,
  company_id  uuid references public.profiles (id) on delete set null,
  status      public.match_status not null default 'proposed',
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index on public.matches (student_id);
create index on public.matches (mentor_id);
create index on public.matches (company_id);

-- Consent for sharing progress and results with the company (GDPR).
create table public.consents (
  match_id    uuid primary key references public.matches (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create function public.is_match_member(m_id uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches
    where id = m_id and auth.uid() in (student_id, mentor_id)
  );
$$;

-- A company may see a match only after the student has given (and not revoked) consent.
create function public.company_can_view(m_id uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    join public.consents c on c.match_id = m.id
    where m.id = m_id and m.company_id = auth.uid() and c.revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Preparation plan, sessions, messages, feedback
-- ---------------------------------------------------------------------------

create table public.plan_activities (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches (id) on delete cascade,
  title         text not null,
  description   text,
  due_date      date,
  completed_at  timestamptz,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id) on delete cascade,
  starts_at    timestamptz not null,
  duration_min int not null default 60,
  meeting_url  text,
  notes        text,
  created_by   uuid references public.profiles (id) default auth.uid(),
  created_at   timestamptz not null default now()
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) default auth.uid(),
  body        text not null check (length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);

create index on public.messages (match_id, created_at);

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) default auth.uid(),
  rating      int check (rating between 1 and 5),
  comments    text,
  created_at  timestamptz not null default now(),
  unique (match_id, author_id)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.student_profiles enable row level security;
alter table public.company_profiles enable row level security;
alter table public.mentor_profiles  enable row level security;
alter table public.matches          enable row level security;
alter table public.consents         enable row level security;
alter table public.plan_activities  enable row level security;
alter table public.sessions         enable row level security;
alter table public.messages         enable row level security;
alter table public.feedback         enable row level security;

-- profiles: users see themselves and the people they are matched with.
create policy "read own or matched profiles" on public.profiles for select using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from public.matches m
    where auth.uid() in (m.student_id, m.mentor_id, m.company_id)
      and profiles.id in (m.student_id, m.mentor_id, m.company_id)
  )
);
create policy "update own profile" on public.profiles for update using (id = auth.uid());
-- Only the name is editable by users, so nobody can change their own role.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Role-specific intake: owners read and write their own row; admins read all;
-- matched mentors can read their student's and the company's brief.
create policy "own student profile" on public.student_profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin or mentor reads student profile" on public.student_profiles for select using (
  public.is_admin() or exists (
    select 1 from public.matches m where m.student_id = student_profiles.id and m.mentor_id = auth.uid()
  )
);

create policy "own company profile" on public.company_profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin or matched reads company brief" on public.company_profiles for select using (
  public.is_admin() or exists (
    select 1 from public.matches m
    where m.company_id = company_profiles.id and auth.uid() in (m.student_id, m.mentor_id)
  )
);

create policy "own mentor profile" on public.mentor_profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin or matched reads mentor profile" on public.mentor_profiles for select using (
  public.is_admin() or exists (
    select 1 from public.matches m
    where m.mentor_id = mentor_profiles.id and auth.uid() in (m.student_id, m.company_id)
  )
);

-- matches: created and changed by admins (via the Node backend); members can read.
create policy "read matches" on public.matches for select using (
  public.is_admin() or public.is_match_member(id) or public.company_can_view(id)
);

-- consents: only the student grants or revokes.
create policy "student manages consent" on public.consents for all
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.student_id = auth.uid())
  );
create policy "admin reads consents" on public.consents for select using (public.is_admin());

-- Plan, sessions, messages: student and mentor of the match.
create policy "members manage activities" on public.plan_activities for all
  using (public.is_match_member(match_id)) with check (public.is_match_member(match_id));
create policy "company reads activities with consent" on public.plan_activities for select
  using (public.company_can_view(match_id) or public.is_admin());

create policy "members manage sessions" on public.sessions for all
  using (public.is_match_member(match_id)) with check (public.is_match_member(match_id));

create policy "members read messages" on public.messages for select
  using (public.is_match_member(match_id));
create policy "members send messages" on public.messages for insert
  with check (public.is_match_member(match_id) and sender_id = auth.uid());

-- Feedback: anyone involved in the match, including the company.
create policy "write own feedback" on public.feedback for insert with check (
  author_id = auth.uid()
  and (public.is_match_member(match_id) or exists (
    select 1 from public.matches m where m.id = match_id and m.company_id = auth.uid()
  ))
);
create policy "read own feedback" on public.feedback for select
  using (author_id = auth.uid() or public.is_admin());
