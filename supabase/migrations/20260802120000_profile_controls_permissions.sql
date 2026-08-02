begin;

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public';

alter table public.profiles
  drop constraint if exists profiles_profile_visibility_check;

alter table public.profiles
  add constraint profiles_profile_visibility_check
  check (profile_visibility in ('public', 'private'));

grant update (profile_visibility)
on public.profiles
to authenticated;

grant insert (
  uid,
  display_name,
  photo_url,
  bio,
  location,
  pronouns,
  website,
  favorite_genres
)
on public.profiles
to authenticated;

commit;
