-- Evntra social layer. Safe to rerun after schema.sql or upgrade.sql.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists city text;
update public.profiles set display_name = coalesce(display_name, full_name),
  username = coalesce(username, 'user_' || substr(replace(id::text, '-', ''), 1, 12));
create unique index if not exists profiles_username_unique on public.profiles(lower(username));

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid references public.artists(id) on delete set null, caption text not null default '' check (char_length(caption) <= 2000),
  media_type text not null check (media_type in ('image','video')), created_at timestamptz not null default now(),
  like_count integer not null default 0 check (like_count >= 0), comment_count integer not null default 0 check (comment_count >= 0),
  share_count integer not null default 0 check (share_count >= 0)
);
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  url text not null, kind text not null check (kind in ('image','video')), position smallint not null default 0 check (position between 0 and 9),
  width integer, height integer, duration numeric, unique(post_id, position)
);
create table if not exists public.post_likes (
  post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id, user_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500), created_at timestamptz not null default now()
);
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade, following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(follower_id, following_id), check(follower_id <> following_id)
);
create table if not exists public.conversations (id uuid primary key default gen_random_uuid(), pair_key text not null unique, created_at timestamptz not null default now(), last_message_at timestamptz not null default now());
create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  last_read_at timestamptz, primary key(conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, type text not null default 'text' check(type in ('text','shared_post','shared_artist')),
  body text check(char_length(body) <= 4000), shared_post_id uuid references public.posts(id) on delete set null,
  shared_artist_id uuid references public.artists(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_author_created_idx on public.posts(author_id, created_at desc);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index if not exists post_comments_post_created_idx on public.post_comments(post_id, created_at);

create or replace function public.social_counter() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name = 'post_likes' then update posts set like_count=(select count(*) from post_likes where post_id=coalesce(new.post_id,old.post_id)) where id=coalesce(new.post_id,old.post_id);
  elsif tg_table_name = 'post_comments' then update posts set comment_count=(select count(*) from post_comments where post_id=coalesce(new.post_id,old.post_id)) where id=coalesce(new.post_id,old.post_id);
  else update posts set share_count=(select count(*) from post_shares where post_id=coalesce(new.post_id,old.post_id)) where id=coalesce(new.post_id,old.post_id); end if;
  return coalesce(new,old);
end $$;
drop trigger if exists post_likes_counter on public.post_likes; create trigger post_likes_counter after insert or delete on public.post_likes for each row execute function public.social_counter();
drop trigger if exists post_comments_counter on public.post_comments; create trigger post_comments_counter after insert or delete on public.post_comments for each row execute function public.social_counter();
drop trigger if exists post_shares_counter on public.post_shares; create trigger post_shares_counter after insert or delete on public.post_shares for each row execute function public.social_counter();
create or replace function public.validate_comment_parent() returns trigger language plpgsql as $$ begin
  if new.parent_id is not null and not exists(select 1 from post_comments p where p.id=new.parent_id and p.post_id=new.post_id and p.parent_id is null) then raise exception 'Replies may be one level deep and must belong to the same post'; end if; return new; end $$;
drop trigger if exists validate_comment_parent on public.post_comments; create trigger validate_comment_parent before insert or update on public.post_comments for each row execute function public.validate_comment_parent();

alter table public.posts enable row level security; alter table public.post_media enable row level security;
alter table public.post_likes enable row level security; alter table public.post_comments enable row level security;
alter table public.follows enable row level security; alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security; alter table public.messages enable row level security; alter table public.post_shares enable row level security;
drop policy if exists posts_read on public.posts; create policy posts_read on public.posts for select to authenticated using(true);
drop policy if exists posts_listed_insert on public.posts; create policy posts_listed_insert on public.posts for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from artists a where a.user_id=auth.uid() and a.id=artist_id));
drop policy if exists posts_owner_delete on public.posts; create policy posts_owner_delete on public.posts for delete to authenticated using(author_id=auth.uid());
drop policy if exists post_media_read on public.post_media; create policy post_media_read on public.post_media for select to authenticated using(true);
drop policy if exists post_media_owner on public.post_media; create policy post_media_owner on public.post_media for insert to authenticated with check(exists(select 1 from posts p where p.id=post_id and p.author_id=auth.uid()));
drop policy if exists post_media_owner_delete on public.post_media; create policy post_media_owner_delete on public.post_media for delete to authenticated using(exists(select 1 from posts p where p.id=post_id and p.author_id=auth.uid()));
drop policy if exists likes_read on public.post_likes; create policy likes_read on public.post_likes for select to authenticated using(true);
drop policy if exists likes_self_insert on public.post_likes; create policy likes_self_insert on public.post_likes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists likes_self_delete on public.post_likes; create policy likes_self_delete on public.post_likes for delete to authenticated using(user_id=auth.uid());
drop policy if exists comments_read on public.post_comments; create policy comments_read on public.post_comments for select to authenticated using(true);
drop policy if exists comments_self_insert on public.post_comments; create policy comments_self_insert on public.post_comments for insert to authenticated with check(user_id=auth.uid());
drop policy if exists comments_allowed_delete on public.post_comments; create policy comments_allowed_delete on public.post_comments for delete to authenticated using(user_id=auth.uid() or exists(select 1 from posts p where p.id=post_id and p.author_id=auth.uid()));
drop policy if exists follows_read on public.follows; create policy follows_read on public.follows for select to authenticated using(true);
drop policy if exists follows_self_insert on public.follows; create policy follows_self_insert on public.follows for insert to authenticated with check(follower_id=auth.uid());
drop policy if exists follows_self_delete on public.follows; create policy follows_self_delete on public.follows for delete to authenticated using(follower_id=auth.uid());
drop policy if exists participants_read on public.conversation_participants; create policy participants_read on public.conversation_participants for select to authenticated using(user_id=auth.uid());
drop policy if exists conversations_participant_read on public.conversations; create policy conversations_participant_read on public.conversations for select to authenticated using(exists(select 1 from conversation_participants cp where cp.conversation_id=id and cp.user_id=auth.uid()));
drop policy if exists messages_participant_read on public.messages; create policy messages_participant_read on public.messages for select to authenticated using(exists(select 1 from conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.user_id=auth.uid()));
drop policy if exists messages_participant_insert on public.messages; create policy messages_participant_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.user_id=auth.uid()));
drop policy if exists shares_participant_read on public.post_shares; create policy shares_participant_read on public.post_shares for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists shares_sender_insert on public.post_shares; create policy shares_sender_insert on public.post_shares for insert to authenticated with check(sender_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('post-media','post-media',true,100000000,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']) on conflict(id) do update set public=true,file_size_limit=100000000;
drop policy if exists post_media_storage_read on storage.objects; create policy post_media_storage_read on storage.objects for select using(bucket_id='post-media');
drop policy if exists post_media_storage_write on storage.objects; create policy post_media_storage_write on storage.objects for insert to authenticated with check(bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from artists where user_id=auth.uid()));
drop policy if exists post_media_storage_delete on storage.objects; create policy post_media_storage_delete on storage.objects for delete to authenticated using(bucket_id='post-media' and (storage.foldername(name))[1]=auth.uid()::text);
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
