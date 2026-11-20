-- Boardnummer je Spiel (20.11.2026). Die Auslosung vergibt pro Runde (slot) Board 1, 2, ...
-- und speichert sie, damit App und Leinwand dieselbe Nummer zeigen.
-- Ältere Spielpläne haben keine Nummer (NULL); sie werden ohne Board angezeigt.
alter table public.matches add column if not exists board smallint check (board is null or board >= 1);

create or replace function public.auslosen(p_evening uuid, p_matches jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'nur Admin darf auslosen' using errcode = '42501';
  end if;
  if exists (select 1 from matches where evening_id = p_evening and legs_a is not null) then
    raise exception 'Es gibt bereits eingetragene Ergebnisse, Auslosung nicht möglich';
  end if;

  delete from matches where evening_id = p_evening;

  insert into matches (evening_id, group_name, runde, slot, board, spieler_a, spieler_b)
  select p_evening,
         m->>'group',
         (m->>'runde')::integer,
         (m->>'slot')::integer,
         (m->>'board')::smallint,
         (m->>'a')::uuid,
         (m->>'b')::uuid
  from jsonb_array_elements(p_matches) as m;

  get diagnostics n = row_count;
  return n;
end;
$function$;

create or replace function public.finale_auslosen(p_evening uuid, p_matches jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'nur Admin darf auslosen' using errcode = '42501';
  end if;
  if not exists (
    select 1 from matches where evening_id = p_evening and group_name not like 'Finale Rang %'
  ) then
    raise exception 'Keine Gruppenspiele vorhanden, Finale nicht möglich';
  end if;
  if exists (
    select 1 from matches
    where evening_id = p_evening and group_name not like 'Finale Rang %' and bestaetigt_von is null
  ) then
    raise exception 'Die Gruppenphase ist noch nicht vollständig bestätigt';
  end if;
  if exists (
    select 1 from matches
    where evening_id = p_evening and group_name like 'Finale Rang %' and legs_a is not null
  ) then
    raise exception 'Im Finale gibt es bereits eingetragene Ergebnisse, Auslosung nicht möglich';
  end if;

  delete from matches where evening_id = p_evening and group_name like 'Finale Rang %';

  insert into matches (evening_id, group_name, runde, slot, board, spieler_a, spieler_b)
  select p_evening,
         m->>'group',
         (m->>'runde')::integer,
         (m->>'slot')::integer,
         (m->>'board')::smallint,
         (m->>'a')::uuid,
         (m->>'b')::uuid
  from jsonb_array_elements(p_matches) as m;

  get diagnostics n = row_count;
  return n;
end;
$function$;

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
