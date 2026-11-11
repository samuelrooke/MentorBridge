alter table public.profiles
  add column if not exists bio text check (length(bio) <= 500),
  add column if not exists avatar_path text check (length(avatar_path) <= 200);

grant update (full_name, bio, avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "read own or matched avatars" on storage.objects for select to authenticated using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1 from public.matches m
      where (storage.foldername(name))[1] in (m.student_id::text, m.mentor_id::text, m.company_id::text)
        and (public.is_match_member(m.id) or public.company_can_view(m.id))
    )
  )
);

create policy "upload own avatar" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "update own avatar" on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "delete own avatar" on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);