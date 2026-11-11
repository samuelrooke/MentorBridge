alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.sessions;

alter table public.sessions
  add column title text check (length(title) <= 120);

create table public.message_reads (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.message_reads enable row level security;

create policy "own read markers" on public.message_reads for all
  using (user_id = auth.uid() and public.is_match_member(match_id))
  with check (user_id = auth.uid() and public.is_match_member(match_id));