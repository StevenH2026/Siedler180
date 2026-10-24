-- Finale-Auslosung (Admin only). p_matches: jsonb-Array mit {group, runde, slot, a, b},
-- group = "Finale Rang n". Voraussetzung: alle Gruppenspiele sind bestätigt.
-- Ein vorhandenes Finale wird ersetzt, solange darin keine Ergebnisse stehen.
create or replace function public.finale_auslosen(p_evening uuid, p_matches jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

  insert into matches (evening_id, group_name, runde, slot, spieler_a, spieler_b)
  select p_evening,
         m->>'group',
         (m->>'runde')::integer,
         (m->>'slot')::integer,
         (m->>'a')::uuid,
         (m->>'b')::uuid
  from jsonb_array_elements(p_matches) as m;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.finale_auslosen(uuid, jsonb) from public, anon;
grant execute on function public.finale_auslosen(uuid, jsonb) to authenticated;
