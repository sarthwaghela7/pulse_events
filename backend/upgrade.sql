-- Run after the original schema.sql on an existing project.
create or replace function public.protect_profile_role() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile roles cannot be changed directly';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute procedure public.protect_profile_role();

drop trigger if exists promote_artist_owner on public.artists;
drop function if exists public.promote_artist_owner();
alter table public.artists add column if not exists details jsonb not null default '{}'::jsonb;
do $$ begin
  if exists (select 1 from public.artists group by user_id having count(*) > 1) then
    raise exception 'Some accounts own multiple listings. Resolve those rows before applying the one-listing index.';
  end if;
end $$;
create unique index if not exists artists_one_listing_per_user on public.artists(user_id);

create unique index if not exists bookings_one_confirmed_slot on public.bookings(artist_id, event_date, event_time) where status = 'confirmed';
drop policy if exists "bookings_user_insert" on public.bookings;
create policy "bookings_user_insert" on public.bookings for insert with check (auth.uid() = user_id and status = 'pending' and event_date >= current_date and event_time is not null);
drop policy if exists "bookings_participant_update" on public.bookings;
revoke update on public.bookings from anon, authenticated;
create or replace function public.respond_to_booking(p_booking_id uuid, p_status text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare result public.bookings;
begin
  if p_status not in ('confirmed', 'cancelled') then raise exception 'Invalid booking decision'; end if;
  update public.bookings b set status = p_status
  where b.id = p_booking_id and b.status = 'pending'
    and exists (select 1 from public.artists a where a.id = b.artist_id and a.user_id = auth.uid())
  returning b.* into result;
  if not found then raise exception 'Pending booking not found or access denied'; end if;
  return result;
end; $$;
revoke all on function public.respond_to_booking(uuid, text) from public;
grant execute on function public.respond_to_booking(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artist-profiles', 'artist-profiles', true, 5000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "artist_profiles_public_read" on storage.objects;
drop policy if exists "artist_profiles_owner_insert" on storage.objects;
drop policy if exists "artist_profiles_owner_delete" on storage.objects;
create policy "artist_profiles_public_read" on storage.objects for select using (bucket_id = 'artist-profiles');
create policy "artist_profiles_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'artist-profiles' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "artist_profiles_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'artist-profiles' and (storage.foldername(name))[1] = auth.uid()::text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artist-gallery', 'artist-gallery', true, 50000000, array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 50000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
drop policy if exists "artist_gallery_public_read" on storage.objects;
drop policy if exists "artist_gallery_owner_insert" on storage.objects;
drop policy if exists "artist_gallery_owner_delete" on storage.objects;
create policy "artist_gallery_public_read" on storage.objects for select using (bucket_id = 'artist-gallery');
create policy "artist_gallery_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'artist-gallery' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.artists a where a.id::text = (storage.foldername(name))[2] and a.user_id = auth.uid()));
create policy "artist_gallery_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'artist-gallery' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.artists a where a.id::text = (storage.foldername(name))[2] and a.user_id = auth.uid()));
