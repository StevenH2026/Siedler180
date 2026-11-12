-- Spielername (Alias) ist frei wählbar, Standard ist leer; ohne Alias keine Rangliste
alter table public.profiles alter column anzeigename drop not null;
alter table public.profiles drop constraint if exists profiles_anzeigename_check;
alter table public.profiles add constraint profiles_anzeigename_check check (
  anzeigename is null
  or (char_length(anzeigename) between 2 and 20 and anzeigename ~ '^[[:alnum:]_ .-]+$')
);

-- Eindeutig, unabhängig von Groß- und Kleinschreibung
create unique index if not exists profiles_anzeigename_key
  on public.profiles (lower(anzeigename)) where anzeigename is not null;

-- Profil ohne E-Mail-Präfix als Alias anlegen: die E-Mail soll nicht öffentlich werden
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.contacts (user_id, email) values (new.id, new.email);
  return new;
end $$;

-- Rangliste: nur Spieler mit Alias und Opt-in
create or replace view public.rangliste with (security_invoker = true) as
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
where p.rangliste_optin and p.anzeigename is not null and a.evenings >= 4;