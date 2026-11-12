-- Profile: Anzeigename und Rangliste-Opt-in, für eingeloggte Spieler lesbar
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  anzeigename text not null check (char_length(anzeigename) between 1 and 40),
  rangliste_optin boolean not null default false,
  einwilligung_am timestamptz,
  created_at timestamptz not null default now()
);

-- Kontaktdaten: nur der Spieler selbst und Admins
create table public.contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  telefon text
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.evenings (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  ort text not null default 'Siedlerkeller',
  boards int not null check (boards >= 1),
  status text not null default 'entwurf'
    check (status in ('entwurf','offen','geplant','gewertet','freundschaftlich','abgesagt')),
  anmeldeschluss timestamptz,
  zielzeit_min int not null default 120,
  created_at timestamptz not null default now()
);

create table public.attendance (
  evening_id uuid not null references public.evenings(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('zugesagt','abgesagt','nur_equipment','warteliste')),
  updated_at timestamptz not null default now(),
  primary key (evening_id, player_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  evening_id uuid not null references public.evenings(id) on delete cascade,
  group_name text not null,
  runde int not null,
  slot int not null,
  spieler_a uuid not null references public.profiles(id),
  spieler_b uuid not null references public.profiles(id),
  legs_a int,
  legs_b int,
  eingetragen_von uuid references public.profiles(id),
  bestaetigt_von uuid references public.profiles(id),
  check (spieler_a <> spieler_b),
  check ((legs_a is null and legs_b is null) or (legs_a, legs_b) in ((2,0),(2,1),(1,2),(0,2)))
);

-- Admin-Prüfung ohne Rekursion in den Policies
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Profil und Kontakt bei jeder neuen Anmeldung anlegen
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, anzeigename)
    values (new.id, coalesce(new.raw_user_meta_data->>'anzeigename', split_part(new.email, '@', 1)));
  insert into public.contacts (user_id, email) values (new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ergebnis eintragen: nur Beteiligte oder Admin. Eintrag setzt die Bestätigung zurück, Admin bestätigt direkt.
create or replace function public.set_match_result(p_match uuid, p_legs_a int, p_legs_b int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.matches;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'nicht angemeldet'; end if;
  if (p_legs_a, p_legs_b) not in ((2,0),(2,1),(1,2),(0,2)) then
    raise exception 'ungültiges Ergebnis: %:%', p_legs_a, p_legs_b;
  end if;
  select * into m from public.matches where id = p_match;
  if not found then raise exception 'Match nicht gefunden'; end if;
  if not (uid in (m.spieler_a, m.spieler_b) or public.is_admin()) then
    raise exception 'nicht beteiligt';
  end if;
  update public.matches
    set legs_a = p_legs_a,
        legs_b = p_legs_b,
        eingetragen_von = uid,
        bestaetigt_von = case when public.is_admin() then uid else null end
    where id = p_match;
end $$;

-- Ergebnis bestätigen: der Gegenspieler (oder Admin), nicht der Eintragende
create or replace function public.confirm_match_result(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.matches;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'nicht angemeldet'; end if;
  select * into m from public.matches where id = p_match;
  if not found then raise exception 'Match nicht gefunden'; end if;
  if m.legs_a is null then raise exception 'noch kein Ergebnis eingetragen'; end if;
  if m.eingetragen_von = uid then raise exception 'Eintragender kann nicht selbst bestätigen'; end if;
  if not (uid in (m.spieler_a, m.spieler_b) or public.is_admin()) then
    raise exception 'nicht beteiligt';
  end if;
  update public.matches set bestaetigt_von = uid where id = p_match;
end $$;

-- Row Level Security überall an
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.admins enable row level security;
alter table public.evenings enable row level security;
alter table public.attendance enable row level security;
alter table public.matches enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- contacts
create policy contacts_own on public.contacts for all to authenticated
  using ((select auth.uid()) = user_id or public.is_admin())
  with check ((select auth.uid()) = user_id or public.is_admin());

-- admins: nur für Admins lesbar, Schreiben nur direkt in der Datenbank
create policy admins_select on public.admins for select to authenticated using (public.is_admin());

-- evenings
create policy evenings_select on public.evenings for select to authenticated using (true);
create policy evenings_admin_all on public.evenings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- attendance: Spieler setzen nur die eigene Teilnahme, solange die Anmeldung offen ist
create policy attendance_select on public.attendance for select to authenticated using (true);
create policy attendance_own on public.attendance for all to authenticated
  using (player_id = (select auth.uid()))
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.evenings e
      where e.id = evening_id and e.status in ('offen','geplant')
        and e.anmeldeschluss > now()
    )
  );
create policy attendance_admin_all on public.attendance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- matches: lesbar für Eingeloggte, Ergebnisse nur über die Funktionen oben, Admin direkt
create policy matches_select on public.matches for select to authenticated using (true);
create policy matches_admin_all on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Rangliste: nur bestätigte Ergebnisse gewerteter Abende, rollierend 12 Monate, mind. 4 Abende, nur Opt-in
create view public.rangliste with (security_invoker = true) as
with gewertete as (
  select e.id from public.evenings e
  where e.status = 'gewertet'
    and e.datum > (current_date - interval '12 months')::date
    and e.datum <= current_date
),
legs as (
  select m.spieler_a as player, m.evening_id, m.legs_a as won, m.legs_a + m.legs_b as played
  from public.matches m join gewertete g on g.id = m.evening_id
  where m.legs_a is not null and m.bestaetigt_von is not null
  union all
  select m.spieler_b, m.evening_id, m.legs_b, m.legs_a + m.legs_b
  from public.matches m join gewertete g on g.id = m.evening_id
  where m.legs_a is not null and m.bestaetigt_von is not null
),
agg as (
  select player, sum(won) as won, sum(played) as played, count(distinct evening_id) as evenings
  from legs group by player
)
select p.id as player_id, p.anzeigename, a.won, a.played, a.evenings,
  round(a.won::numeric / nullif(a.played, 0), 4) as legquote
from public.profiles p join agg a on a.player = p.id
where p.rangliste_optin and a.evenings >= 4;

-- Grants: anon nichts, authenticated nur was die Policies erlauben
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;
grant select on public.profiles, public.evenings, public.attendance, public.matches, public.rangliste to authenticated;
grant select on public.contacts, public.admins to authenticated;
grant insert, update, delete on public.profiles, public.contacts, public.evenings, public.attendance, public.matches to authenticated;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_match_result(uuid, int, int) from public, anon;
revoke execute on function public.confirm_match_result(uuid) from public, anon;
grant execute on function public.set_match_result(uuid, int, int) to authenticated;
grant execute on function public.confirm_match_result(uuid) to authenticated;