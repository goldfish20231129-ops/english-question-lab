-- 영어 문제 제작 연구소: 본인 계정 한 명을 위한 작업 공간과 이미지 저장소
-- Supabase Dashboard > SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;

drop policy if exists "Users can read their workspace" on public.user_workspaces;
create policy "Users can read their workspace"
on public.user_workspaces for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their workspace" on public.user_workspaces;
create policy "Users can create their workspace"
on public.user_workspaces for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their workspace" on public.user_workspaces;
create policy "Users can update their workspace"
on public.user_workspaces for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their workspace" on public.user_workspaces;
create policy "Users can delete their workspace"
on public.user_workspaces for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'english-media',
  'english-media',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'image/bmp', 'image/heic', 'image/heif', 'image/tiff']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their media" on storage.objects;
create policy "Users can read their media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'english-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload their media" on storage.objects;
create policy "Users can upload their media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'english-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their media" on storage.objects;
create policy "Users can update their media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'english-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'english-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their media" on storage.objects;
create policy "Users can delete their media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'english-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
