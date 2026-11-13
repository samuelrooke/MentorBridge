-- Messaging overhaul (13 November 2026): pictures, replies, edits, reactions, deleted
-- messages, "seen", and reports.

-- ---------------------------------------------------------------------------
-- Messages: a picture, and deleted messages
-- ---------------------------------------------------------------------------
-- A message has text, a picture, or both. Deleted messages keep their row (so the
-- conversation shows "Message deleted") but lose their text and picture.
-- Deleting goes through the API (POST /api/messages/:id/unsend, DELETE /api/admin/messages/:id),
-- which also removes the picture file; there is no update policy for users.
alter table public.messages
  add column attachment_path text check (length(attachment_path) <= 300),
  add column attachment_type text check (attachment_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null,
  -- Reply to an earlier message in the same conversation (shown as a quote).
  add column reply_to_id uuid references public.messages (id) on delete set null,
  -- Set when the sender edits the text (through the API, within the same hour as deleting).
  add column edited_at timestamptz;

alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check (
  length(body) <= 5000
  and (length(body) >= 1 or attachment_path is not null or deleted_at is not null)
);
alter table public.messages alter column body set default '';

-- Live updates for deleted messages need the old row's match_id in the change event.
alter table public.messages replica identity full;

-- A reply must point at a message in the same conversation.
create function public.check_reply()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages where id = new.reply_to_id and match_id = new.match_id
  ) then
    raise exception 'You can only reply to a message in the same conversation.';
  end if;
  return new;
end;
$$;
create trigger check_reply_before_insert
  before insert on public.messages
  for each row execute function public.check_reply();

-- ---------------------------------------------------------------------------
-- Reactions: one row per person, message and emoji
-- ---------------------------------------------------------------------------
create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '❤️', '😂', '😮', '🙏', '🎉')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index on public.message_reactions (match_id);
alter table public.message_reactions enable row level security;

create policy "members and admins see reactions" on public.message_reactions for select
  using (public.is_match_member(match_id) or public.is_admin());
create policy "members and admins add own reactions" on public.message_reactions for insert with check (
  user_id = auth.uid()
  and (public.is_match_member(match_id) or public.is_admin())
  and exists (select 1 from public.messages m where m.id = message_id and m.match_id = message_reactions.match_id and m.deleted_at is null)
);
create policy "people remove own reactions" on public.message_reactions for delete
  using (user_id = auth.uid());
alter publication supabase_realtime add table public.message_reactions;

-- ---------------------------------------------------------------------------
-- "Seen": both people in a match can see each other's read marker
-- ---------------------------------------------------------------------------
create policy "members see read markers in their match" on public.message_reads for select
  using (public.is_match_member(match_id));
alter publication supabase_realtime add table public.message_reads;

-- ---------------------------------------------------------------------------
-- Pictures in messages: private bucket, one folder per match
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-attachments', 'message-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Path: <match_id>/<file>. Only the student and mentor of that match, and admins.
create function public.can_use_match_folder(object_name text)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.matches m
    where m.id::text = (storage.foldername(object_name))[1]
      and auth.uid() in (m.student_id, m.mentor_id)
  );
$$;

create policy "match members read message pictures" on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments' and public.can_use_match_folder(name));
create policy "match members upload message pictures" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments' and public.can_use_match_folder(name));

-- ---------------------------------------------------------------------------
-- Reports of misbehaviour
-- ---------------------------------------------------------------------------
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  reported_user_id uuid references public.profiles (id) on delete set null,
  match_id         uuid references public.matches (id) on delete set null,
  message_id       uuid references public.messages (id) on delete set null,
  -- Copy of the reported message at the time of the report, filled in by the trigger below,
  -- so it stays readable for the team even if the message is deleted later.
  message_snapshot text,
  message_had_picture boolean not null default false,
  reason           text not null check (reason in ('harassment', 'inappropriate', 'spam', 'safety', 'other')),
  details          text check (length(details) <= 2000),
  status           text not null default 'open' check (status in ('open', 'resolved')),
  admin_note       text check (length(admin_note) <= 2000),
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Fills in the reported person and the message copy from the database, so a report
-- can't claim someone wrote something they didn't.
create function public.fill_report()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  reported public.messages;
begin
  if new.message_id is not null then
    select * into reported from public.messages where id = new.message_id;
    if reported.id is null or reported.match_id is distinct from new.match_id then
      raise exception 'The reported message is not in this conversation.';
    end if;
    new.reported_user_id := reported.sender_id;
    new.message_snapshot := reported.body;
    new.message_had_picture := reported.attachment_path is not null;
  end if;
  new.status := 'open';
  new.admin_note := null;
  new.resolved_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

create trigger fill_report_before_insert
  before insert on public.reports
  for each row execute function public.fill_report();

-- People report within their own match: the other person, or a message in that conversation.
create policy "members report in their match" on public.reports for insert with check (
  reporter_id = auth.uid()
  and match_id is not null
  and public.is_match_member(match_id)
  and (reported_user_id is null or exists (
    select 1 from public.matches m
    where m.id = match_id and reported_user_id in (m.student_id, m.mentor_id) and reported_user_id <> auth.uid()
  ))
);
create policy "reporters see their own reports" on public.reports for select using (reporter_id = auth.uid());
create policy "admins manage reports" on public.reports for all using (public.is_admin()) with check (public.is_admin());
