-- Auslosung: ersetzt den Spielplan eines Abends atomar (Admin only).
-- p_matches: jsonb-Array mit {group, runde, slot, a, b}.
create or replace function public.auslosen(p_evening uuid, p_matches jsonb)
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
  if exists (select 1 from matches where evening_id = p_evening and legs_a is not null) then
    raise exception 'Es gibt bereits eingetragene Ergebnisse, Auslosung nicht möglich';
  end if;

  delete from matches where evening_id = p_evening;

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

revoke execute on function public.auslosen(uuid, jsonb) from public, anon;
grant execute on function public.auslosen(uuid, jsonb) to authenticated;
