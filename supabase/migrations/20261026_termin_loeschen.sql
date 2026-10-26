-- Admin löscht einen falsch angelegten Abend. Nur ohne Spielplan: sobald Spiele existieren,
-- bleibt nur die Absage, damit Zusagen und Ergebnisse nicht verloren gehen.
create or replace function public.termin_loeschen(p_evening uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'nur Admin' using errcode = '42501';
  end if;
  if exists (select 1 from public.matches where evening_id = p_evening) then
    raise exception 'Der Abend hat schon einen Spielplan. Bitte absagen statt löschen.';
  end if;
  delete from public.attendance where evening_id = p_evening;
  delete from public.evenings where id = p_evening;
end;
$$;

revoke execute on function public.termin_loeschen(uuid) from public, anon;
grant execute on function public.termin_loeschen(uuid) to authenticated;
