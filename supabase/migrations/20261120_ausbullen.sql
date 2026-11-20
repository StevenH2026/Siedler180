-- Ausbullen bei Restgleichstand (Entscheidung 20.11.2026).
-- Bleibt in einer Gruppe nach Legs und direktem Vergleich ein Gleichstand (z. B. drei Spieler im Kreis),
-- bullen die Betroffenen aus. Der Admin trägt die Reihenfolge ein; sie gilt nur innerhalb dieser Gruppe
-- (Vorrundengruppe oder Finalgruppe) und nur unter den Gleichstehenden.
create table if not exists public.ausbullen (
  evening_id uuid not null references public.evenings(id) on delete cascade,
  group_name text not null,
  player_id uuid not null references public.profiles(id) on delete cascade,
  rang smallint not null check (rang >= 1),
  primary key (evening_id, group_name, player_id)
);

alter table public.ausbullen enable row level security;
revoke all on table public.ausbullen from anon;
-- Neue Tabellen bekommen in diesem Projekt keine Standardrechte; RLS regelt den Zugriff.
grant select, insert, update, delete on table public.ausbullen to authenticated;

create policy ausbullen_select on public.ausbullen
  for select to authenticated using (true);
create policy ausbullen_admin on public.ausbullen
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Reihenfolge setzen: p_spieler in der Reihenfolge des Ausbullens (erster = bester).
-- Ein leeres Array löscht die Reihenfolge der Gruppe.
create or replace function public.ausbullen_setzen(p_evening uuid, p_group text, p_spieler uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'nur Admin' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_spieler, '{}')) as s(id)
    where not exists (
      select 1 from public.matches m
      where m.evening_id = p_evening and m.group_name = p_group and s.id in (m.spieler_a, m.spieler_b)
    )
  ) then
    raise exception 'Spieler gehört nicht zu dieser Gruppe';
  end if;

  delete from public.ausbullen where evening_id = p_evening and group_name = p_group;
  insert into public.ausbullen (evening_id, group_name, player_id, rang)
  select p_evening, p_group, s.id, s.nr
  from unnest(coalesce(p_spieler, '{}')) with ordinality as s(id, nr);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.ausbullen_setzen(uuid, text, uuid[]) from public, anon;
grant execute on function public.ausbullen_setzen(uuid, text, uuid[]) to authenticated;

alter publication supabase_realtime add table public.ausbullen;

-- Leinwand: Ausbullen-Reihenfolge mitliefern (mit Spielernamen statt Kennungen).
create or replace function public.leinwand_daten()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'abend', json_build_object('beginn_at', e.beginn_at, 'ort', e.ort),
    'spiele', coalesce((
      select json_agg(json_build_object(
        'group_name', m.group_name,
        'runde', m.runde,
        'slot', m.slot,
        'board', m.board,
        'a', coalesce(pa.anzeigename, 'Unbekannt'),
        'b', coalesce(pb.anzeigename, 'Unbekannt'),
        'legs_a', m.legs_a,
        'legs_b', m.legs_b,
        'bestaetigt', m.bestaetigt_von is not null
      ))
      from public.matches m
      left join public.profiles pa on pa.id = m.spieler_a
      left join public.profiles pb on pb.id = m.spieler_b
      where m.evening_id = e.id
    ), '[]'::json),
    'ausbullen', coalesce((
      select json_agg(json_build_object(
        'group_name', b.group_name,
        'spieler', coalesce(p.anzeigename, 'Unbekannt'),
        'rang', b.rang
      ))
      from public.ausbullen b
      left join public.profiles p on p.id = b.player_id
      where b.evening_id = e.id
    ), '[]'::json)
  )
  from (
    select * from public.evenings
    where auf_leinwand
      and public.is_admin()
      and status not in ('gewertet', 'abgesagt')
      and beginn_at > now() - interval '12 hours'
    limit 1
  ) e;
$$;
