create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user','artist','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null, category text not null, bio text, city text, price_per_event numeric(10,2),
  profile_image_url text, tags text[] default '{}', details jsonb not null default '{}'::jsonb,
  rating numeric(2,1) default 0, created_at timestamptz not null default now()
);
create table if not exists public.artist_media (
  id uuid primary key default gen_random_uuid(), artist_id uuid not null references public.artists(id) on delete cascade,
  media_url text not null, media_type text not null default 'image' check (media_type in ('image','video')), created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(), artist_id uuid not null references public.artists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, event_date date not null, event_time time,
  event_location text, status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  notes text, created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now(), unique (booking_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email, full_name) values (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name') on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.artist_media enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "artists_public_read" on public.artists for select using (true);
create policy "artists_owner_insert" on public.artists for insert with check (auth.uid() = user_id);
create policy "artists_owner_update" on public.artists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "artists_owner_delete" on public.artists for delete using (auth.uid() = user_id);
create policy "media_public_read" on public.artist_media for select using (true);
create policy "media_owner_insert" on public.artist_media for insert with check (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "media_owner_update" on public.artist_media for update using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "media_owner_delete" on public.artist_media for delete using (exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "bookings_participant_read" on public.bookings for select using (auth.uid() = user_id or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "bookings_user_insert" on public.bookings for insert with check (auth.uid() = user_id and status = 'pending' and event_date >= current_date and event_time is not null);
create policy "bookings_participant_update" on public.bookings for update using (auth.uid() = user_id or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid())) with check (auth.uid() = user_id or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid()));
create policy "reviews_public_read" on public.reviews for select using (true);
create policy "reviews_user_insert" on public.reviews for insert with check (auth.uid() = user_id);

create or replace function public.refresh_artist_rating() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.artists set rating = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where artist_id = coalesce(new.artist_id, old.artist_id)), 0) where id = coalesce(new.artist_id, old.artist_id); return coalesce(new, old); end; $$;
drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews for each row execute procedure public.refresh_artist_rating();

create index if not exists artists_category_idx on public.artists(category);
create index if not exists artists_city_idx on public.artists(city);
create index if not exists bookings_user_idx on public.bookings(user_id);
create index if not exists bookings_artist_idx on public.bookings(artist_id);

-- Profile roles cannot be changed by a signed-in user.
create or replace function public.protect_profile_role() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile roles cannot be changed directly';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute procedure public.protect_profile_role();

-- Every account is a regular user. Listing ownership is determined by artists.user_id.

-- Booking decisions are made through this checked function. A unique index prevents
-- two confirmed events for the same artist, date and time slot.
create unique index if not exists bookings_one_confirmed_slot on public.bookings(artist_id, event_date, event_time) where status = 'confirmed';
drop policy if exists "bookings_participant_update" on public.bookings;
revoke update on public.bookings from anon, authenticated;
create or replace function public.respond_to_booking(p_booking_id uuid, p_status text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare result public.bookings;
begin
  if p_status not in ('confirmed', 'cancelled') then
    raise exception 'Invalid booking decision';
  end if;
  update public.bookings b set status = p_status
  where b.id = p_booking_id and b.status = 'pending'
    and exists (select 1 from public.artists a where a.id = b.artist_id and a.user_id = auth.uid())
  returning b.* into result;
  if not found then raise exception 'Pending booking not found or access denied'; end if;
  return result;
end; $$;
revoke all on function public.respond_to_booking(uuid, text) from public;
grant execute on function public.respond_to_booking(uuid, text) to authenticated;

-- Public profile photos; each signed-in user may write only within their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artist-profiles', 'artist-profiles', true, 5000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "artist_profiles_public_read" on storage.objects for select using (bucket_id = 'artist-profiles');
create policy "artist_profiles_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'artist-profiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artist_profiles_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'artist-profiles' and (storage.foldername(name))[1] = auth.uid()::text);

-- Portfolio images and videos are public; only the artist can upload or remove theirs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artist-gallery', 'artist-gallery', true, 50000000, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 50000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
create policy "artist_gallery_public_read" on storage.objects for select using (bucket_id = 'artist-gallery');
create policy "artist_gallery_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'artist-gallery' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.artists a where a.id::text = (storage.foldername(name))[2] and a.user_id = auth.uid()));
create policy "artist_gallery_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'artist-gallery' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.artists a where a.id::text = (storage.foldername(name))[2] and a.user_id = auth.uid()));
