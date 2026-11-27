-- =====================================================================
-- Family tree – database schema for Supabase.
-- Run it once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Running it again is safe (it only creates what is missing and
-- replaces functions and policies).
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------- tables ----------------------------------------------------

-- One row per person / per relationship. `data` holds the same JSON the app uses.
create table if not exists public.people (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

create table if not exists public.unions (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

-- One row per signed-in Google account.
--   role: pending = names only, member = sees everything and suggests changes, admin = approves.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'pending' check (role in ('pending', 'member', 'admin')),
  person_id text unique references public.people (id) on delete set null,
  claim jsonb,                  -- what they typed when registering (names + parents)
  attempts int not null default 0,
  registered_at timestamptz,
  created_at timestamptz not null default now()
);

-- Changes suggested by family members, waiting for an admin.
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  summary text,
  change jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users on delete set null,
  decided_at timestamptz
);

-- Web-research findings and the admin's decisions about them.
create table if not exists public.findings (
  id text primary key,
  data jsonb not null
);

create table if not exists public.finding_decisions (
  finding_id text primary key,
  record jsonb not null,
  decided_by uuid default auth.uid() references auth.users on delete set null,
  decided_at timestamptz not null default now()
);

-- ---------- who am I --------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where user_id = auth.uid()), false)
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('member', 'admin') from public.profiles where user_id = auth.uid()), false)
$$;

-- ---------- table access for signed-in users --------------------------
-- (Newer Supabase projects don't expose new tables automatically.)
-- What each user may actually see or change is decided by the RLS policies below.

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.people, public.unions, public.suggestions,
  public.findings, public.finding_decisions to authenticated;
grant select, update on public.profiles to authenticated;
revoke all on public.people, public.unions, public.profiles, public.suggestions,
  public.findings, public.finding_decisions from anon;

-- ---------- row level security ----------------------------------------

alter table public.people enable row level security;
alter table public.unions enable row level security;
alter table public.profiles enable row level security;
alter table public.suggestions enable row level security;
alter table public.findings enable row level security;
alter table public.finding_decisions enable row level security;

drop policy if exists "members read people" on public.people;
drop policy if exists "admins write people" on public.people;
create policy "members read people" on public.people for select to authenticated using (public.is_member());
create policy "admins write people" on public.people for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read unions" on public.unions;
drop policy if exists "admins write unions" on public.unions;
create policy "members read unions" on public.unions for select to authenticated using (public.is_member());
create policy "admins write unions" on public.unions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read own profile or admin" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;
create policy "read own profile or admin" on public.profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins update profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members suggest" on public.suggestions;
drop policy if exists "read own suggestions or admin" on public.suggestions;
drop policy if exists "admins decide suggestions" on public.suggestions;
drop policy if exists "admins delete suggestions" on public.suggestions;
create policy "members suggest" on public.suggestions for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "read own suggestions or admin" on public.suggestions for select to authenticated using (created_by = auth.uid() or public.is_admin());
create policy "admins decide suggestions" on public.suggestions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete suggestions" on public.suggestions for delete to authenticated using (public.is_admin());

drop policy if exists "admins findings" on public.findings;
create policy "admins findings" on public.findings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins finding decisions" on public.finding_decisions;
create policy "admins finding decisions" on public.finding_decisions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- There must always be at least one admin.
create or replace function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and new.role <> 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and user_id <> old.user_id) then
    raise exception 'At least one admin is required';
  end if;
  return new;
end $$;

drop trigger if exists keep_one_admin on public.profiles;
create trigger keep_one_admin before update on public.profiles for each row execute function public.keep_one_admin();

-- ---------- a profile for every new Google sign-in --------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- name matching ---------------------------------------------

-- lower case, no accents (é → e), no quotes/geresh, only letters and digits
create or replace function public.norm_name(t text) returns text
language sql stable set search_path = public, extensions as $$
  select btrim(regexp_replace(
    regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[''"`׳״’‘]', '', 'g'),
    '[^a-z0-9א-ת]+', ' ', 'g'))
$$;

-- true when `input` equals one of the candidates, or is one of its words
-- ("Shlomi" matches "שלמה (שלומי)" via the Hebrew field, "Denise" matches "Denise Grannie")
create or replace function public.name_match(input text, variadic candidates text[]) returns boolean
language sql stable set search_path = public, extensions as $$
  select length(public.norm_name(input)) >= 2 and exists (
    select 1 from unnest(candidates) as c(v)
    where length(public.norm_name(c.v)) >= 2 and (
      public.norm_name(c.v) = public.norm_name(input)
      or ' ' || public.norm_name(c.v) || ' ' like '% ' || public.norm_name(input) || ' %'
      or ' ' || public.norm_name(input) || ' ' like '% ' || public.norm_name(c.v) || ' %'
    )
  )
$$;

-- put the Google profile picture on the person, unless they already have a photo
create or replace function public.fill_photo(pid text, url text) returns void
language sql security definer set search_path = public as $$
  update public.people
     set data = jsonb_set(data, '{photo}', to_jsonb(url)), updated_at = now()
   where id = pid and url is not null and url <> '' and coalesce(data ->> 'photo', '') = ''
$$;

-- ---------- registration ----------------------------------------------

-- Called once after the first Google sign-in with the names the person typed.
-- Links the account automatically when exactly one person in the tree matches:
-- first + last name (Hebrew or English) and every parent recorded in the tree.
-- Limited to 3 attempts, so the form can't be used to probe who is in the tree.
create or replace function public.register_profile(
  first_he text, last_he text, first_en text, last_en text, father text, mother text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.profiles;
  cand text[];
begin
  select * into me from public.profiles where user_id = auth.uid();
  if not found then raise exception 'not signed in'; end if;
  if me.person_id is not null then
    return jsonb_build_object('status', 'linked', 'person_id', me.person_id);
  end if;
  if me.attempts >= 3 then
    return jsonb_build_object('status', 'pending', 'attempts_left', 0);
  end if;

  update public.profiles
     set claim = jsonb_build_object('firstNameHe', first_he, 'lastNameHe', last_he,
                                    'firstName', first_en, 'lastName', last_en,
                                    'father', father, 'mother', mother),
         registered_at = now(),
         attempts = attempts + 1
   where user_id = me.user_id;

  select array_agg(p.id) into cand
    from public.people p
   where (public.name_match(first_he, p.data ->> 'firstNameHe', p.data ->> 'firstName')
          or public.name_match(first_en, p.data ->> 'firstName', p.data ->> 'firstNameHe'))
     and (public.name_match(last_he, p.data ->> 'lastNameHe', p.data ->> 'marriedNameHe', p.data ->> 'lastName', p.data ->> 'marriedName')
          or public.name_match(last_en, p.data ->> 'lastName', p.data ->> 'marriedName', p.data ->> 'lastNameHe', p.data ->> 'marriedNameHe'))
     and not exists (select 1 from public.profiles o where o.person_id = p.id)
     -- has parents in the tree…
     and exists (select 1 from public.unions u where u.data -> 'children' ? p.id)
     -- …and every one of them matches the father or the mother typed in
     and not exists (
       select 1
         from public.unions u
         cross join lateral jsonb_array_elements_text(u.data -> 'partners') as par(id)
         join public.people pp on pp.id = par.id
        where u.data -> 'children' ? p.id
          and not (public.name_match(father, pp.data ->> 'firstName', pp.data ->> 'firstNameHe')
                   or public.name_match(mother, pp.data ->> 'firstName', pp.data ->> 'firstNameHe'))
     );

  if coalesce(array_length(cand, 1), 0) = 1 then
    update public.profiles
       set person_id = cand[1],
           role = case when role = 'admin' then role else 'member' end
     where user_id = me.user_id;
    perform public.fill_photo(cand[1], me.avatar_url);
    return jsonb_build_object('status', 'linked', 'person_id', cand[1]);
  end if;
  return jsonb_build_object('status', 'pending', 'attempts_left', 2 - me.attempts);
end $$;

-- Admin: link an account to a person (or unlink with null). Approves a pending account.
create or replace function public.admin_link(target uuid, pid text) returns void
language plpgsql security definer set search_path = public as $$
declare
  url text;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.profiles
     set person_id = pid,
         role = case when pid is not null and role = 'pending' then 'member' else role end
   where user_id = target
  returning avatar_url into url;
  if pid is not null then perform public.fill_photo(pid, url); end if;
end $$;

-- What a pending (not yet approved) account may see: names and family links only.
create or replace function public.tree_names() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.profiles where user_id = auth.uid()) then
    jsonb_build_object(
      'people', coalesce((
        select jsonb_object_agg(id, jsonb_strip_nulls(jsonb_build_object(
          'id', id,
          'firstName', coalesce(data ->> 'firstName', ''),
          'lastName', coalesce(data ->> 'lastName', ''),
          'firstNameHe', data ->> 'firstNameHe',
          'lastNameHe', data ->> 'lastNameHe',
          'middleName', data ->> 'middleName',
          'middleNameHe', data ->> 'middleNameHe',
          'marriedName', data ->> 'marriedName',
          'marriedNameHe', data ->> 'marriedNameHe',
          'sex', coalesce(data ->> 'sex', 'U'),
          'deceased', false)))
        from public.people), '{}'::jsonb),
      'unions', coalesce((
        select jsonb_object_agg(id, jsonb_strip_nulls(jsonb_build_object(
          'id', id,
          'partners', data -> 'partners',
          'children', data -> 'children',
          'kind', data -> 'kind',
          'divorced', data -> 'divorced')))
        from public.unions), '{}'::jsonb))
  end
$$;

-- What a guest (not signed in) and a not-yet-approved account see:
-- everyone's names and family links; full details only of people who have died.
-- `home` is the person the guests' tree is drawn around (the first admin's own card).
create or replace function public.guest_tree() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'home', (select person_id from public.profiles
              where role = 'admin' and person_id is not null order by created_at limit 1),
    'people', coalesce((
      select jsonb_object_agg(id,
        case when coalesce((data ->> 'deceased')::boolean, false)
          then data || jsonb_build_object('id', id)
          else jsonb_strip_nulls(jsonb_build_object(
            'id', id,
            'firstName', coalesce(data ->> 'firstName', ''),
            'lastName', coalesce(data ->> 'lastName', ''),
            'firstNameHe', data ->> 'firstNameHe',
            'lastNameHe', data ->> 'lastNameHe',
            'middleName', data ->> 'middleName',
            'middleNameHe', data ->> 'middleNameHe',
            'marriedName', data ->> 'marriedName',
            'marriedNameHe', data ->> 'marriedNameHe',
            'sex', coalesce(data ->> 'sex', 'U'),
            'deceased', false))
        end)
      from public.people), '{}'::jsonb),
    'unions', coalesce((
      select jsonb_object_agg(id, jsonb_strip_nulls(jsonb_build_object(
        'id', id,
        'partners', data -> 'partners',
        'children', data -> 'children',
        'kind', data -> 'kind',
        'divorced', data -> 'divorced')))
      from public.unions), '{}'::jsonb))
$$;

grant usage on schema public to anon;
revoke execute on function public.guest_tree() from public;
grant execute on function public.guest_tree() to anon, authenticated;

revoke execute on function public.register_profile(text, text, text, text, text, text) from public, anon;
revoke execute on function public.admin_link(uuid, text) from public, anon;
revoke execute on function public.tree_names() from public, anon;
revoke execute on function public.fill_photo(text, text) from public, anon, authenticated;
grant execute on function public.register_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_link(uuid, text) to authenticated;
grant execute on function public.tree_names() to authenticated;

-- ---------- photos ----------------------------------------------------
-- Public bucket with random file names: only people who can see a person's
-- details ever learn the photo's address.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "members upload photos" on storage.objects;
drop policy if exists "admins delete photos" on storage.objects;
create policy "members upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());
create policy "admins delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());
-- deleting a file also needs permission to see its row (storage.remove reads it back)
drop policy if exists "admins list photos" on storage.objects;
create policy "admins list photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- =====================================================================
-- After you sign in to the site with Google for the first time, make
-- yourself the first admin. Replace the address with your Gmail address
-- and run only this line:
--
--   update public.profiles set role = 'admin' where email = 'YOUR-ADDRESS@gmail.com';
-- =====================================================================
