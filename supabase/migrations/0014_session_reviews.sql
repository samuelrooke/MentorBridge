-- Session reviews (13 November 2026), and companies need consent to see profiles.

-- ---------------------------------------------------------------------------
-- Session reviews: after a session, the student and the mentor each review it.
-- Both people in the match and the MentorBridge team can read them; companies can't.
-- ---------------------------------------------------------------------------
create table public.session_reviews (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  match_id    uuid not null references public.matches (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  took_place  boolean not null default true,
  rating      int check (rating between 1 and 5),
  went_well   text check (length(went_well) <= 2000),
  to_improve  text check (length(to_improve) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (session_id, author_id),
  -- A session that took place gets a rating; one that didn't (a no-show) doesn't need one.
  check (took_place = false or rating is not null)
);
create index on public.session_reviews (match_id);
alter table public.session_reviews enable row level security;

create policy "match members and admins read reviews" on public.session_reviews for select
  using (public.is_match_member(match_id) or public.is_admin());

-- Only your own review, only for a session of your match that has started.
create policy "members write own review" on public.session_reviews for insert with check (
  author_id = auth.uid()
  and public.is_match_member(match_id)
  and exists (select 1 from public.sessions s where s.id = session_id and s.match_id = session_reviews.match_id and s.starts_at <= now())
);
create policy "members update own review" on public.session_reviews for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.is_match_member(match_id));
create policy "members delete own review" on public.session_reviews for delete
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Privacy fix: a company could read the profiles (name, introduction, photo) of the
-- student and mentor in its matches without the student's consent. Now a company
-- needs the same consent as for the match itself.
-- ---------------------------------------------------------------------------
drop policy "read own or matched profiles" on public.profiles;
create policy "read own or matched profiles" on public.profiles for select using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from public.matches m
    where profiles.id in (m.student_id, m.mentor_id, m.company_id)
      and (
        auth.uid() in (m.student_id, m.mentor_id)
        or (auth.uid() = m.company_id and public.company_can_view(m.id))
      )
  )
);
