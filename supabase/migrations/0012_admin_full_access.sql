-- Admins can use every platform feature for every match.
--
-- Decision (13 November 2026): the MentorBridge team can read all conversations and post
-- in them as the team. Admin messages are always stored under the admin's own account
-- (sender_id = auth.uid()), never under the student's or mentor's name.
-- The privacy statement has to say that the team can read platform messages.
--
-- Only adds policies. What students, mentors and companies can see does not change.

-- Sessions: plan, edit and delete sessions in any match.
create policy "admin manages sessions" on public.sessions for all
  using (public.is_admin()) with check (public.is_admin());

-- Learning plan steps: same.
create policy "admin manages activities" on public.plan_activities for all
  using (public.is_admin()) with check (public.is_admin());

-- Messages: read every conversation, post as yourself (shown as "MentorBridge team").
create policy "admin reads messages" on public.messages for select
  using (public.is_admin());
create policy "admin posts as team" on public.messages for insert
  with check (public.is_admin() and sender_id = auth.uid());

-- Read markers: admins keep their own, and can see everyone's (for unread counts when
-- viewing the platform as a student or mentor). They can't change anyone else's.
create policy "admin reads read markers" on public.message_reads for select
  using (public.is_admin());
create policy "admin keeps own read markers" on public.message_reads for all
  using (public.is_admin() and user_id = auth.uid())
  with check (public.is_admin() and user_id = auth.uid());

-- Feedback: admins can read all of it (they could already read their own).
create policy "admin reads feedback" on public.feedback for select
  using (public.is_admin());
