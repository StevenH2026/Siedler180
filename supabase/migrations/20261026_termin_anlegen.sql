-- Admin legt einen Spielabend an. Die Startzeit wird in Europe/Berlin umgerechnet, der Anmeldeschluss
-- setzt der bestehende Trigger.
create or replace function public.termin_anlegen(p_datum date, p_beginn time, p_ort text, p_boards int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'nur Admin' using errcode = '42501';
  end if;
  if p_datum is null or p_beginn is null then
    raise exception 'Datum und Uhrzeit fehlen';
  end if;
  if p_datum < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Das Datum liegt in der Vergangenheit';
  end if;
  if p_boards is null or p_boards < 1 or p_boards > 20 then
    raise exception 'Boards müssen zwischen 1 und 20 liegen';
  end if;
  insert into public.evenings (datum, beginn, beginn_at, ort, boards, status)
  values (
    p_datum,
    p_beginn,
    (p_datum + p_beginn) at time zone 'Europe/Berlin',
    coalesce(nullif(trim(p_ort), ''), 'Siedlerkeller'),
    p_boards,
    'offen'
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.termin_anlegen(date, time, text, int) from public, anon;
grant execute on function public.termin_anlegen(date, time, text, int) to authenticated;
