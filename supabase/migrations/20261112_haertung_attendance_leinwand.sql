-- Härtung nach Prüfung vom 12.11.2026.
--
-- 1. attendance: Spieler durften ihre eigene Teilnahme auch löschen (die Policies waren FOR ALL).
--    Das umging den Anmeldeschluss und die Sperre nach vorliegenden Ergebnissen (der Trigger greift nur
--    bei INSERT und UPDATE). Jetzt gibt es für Spieler nur noch INSERT und UPDATE. Löschen darf nur der Admin
--    (attendance_admin_all) oder die Funktion termin_loeschen (security definer).
drop policy if exists attendance_own on public.attendance;
drop policy if exists attendance_own_absage on public.attendance;

-- Zusage, Equipment: solange die Anmeldung offen ist
create policy attendance_own_insert on public.attendance
  for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.evenings e
      where e.id = evening_id and e.status in ('offen', 'geplant')
        and e.anmeldeschluss > now()
    )
  );

create policy attendance_own_update on public.attendance
  for update to authenticated
  using (player_id = (select auth.uid()))
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.evenings e
      where e.id = attendance.evening_id and e.status in ('offen', 'geplant')
        and e.anmeldeschluss > now()
    )
  );

-- Absage: auch nach dem Anmeldeschluss, solange der Abend offen oder geplant ist.
-- Die Sperre bei vorliegenden Ergebnissen erzwingt der Trigger attendance_absage_sperre.
create policy attendance_own_absage_insert on public.attendance
  for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and status = 'abgesagt'
    and exists (
      select 1 from public.evenings e
      where e.id = evening_id and e.status in ('offen', 'geplant')
    )
  );

create policy attendance_own_absage_update on public.attendance
  for update to authenticated
  using (player_id = (select auth.uid()))
  with check (
    player_id = (select auth.uid())
    and status = 'abgesagt'
    and exists (
      select 1 from public.evenings e
      where e.id = attendance.evening_id and e.status in ('offen', 'geplant')
    )
  );

-- 2. Triggerfunktion ohne festen search_path (Supabase-Warnung function_search_path_mutable).
--    Die Funktion nennt alle Tabellen mit Schema, ein leerer search_path ist daher sicher.
alter function public.absage_nach_ergebnis_sperren() set search_path = '';

-- 3. leinwand_setzen(null) soll die Markierung entfernen. Vorher ergab (id = null) den Wert NULL
--    und verletzte die NOT-NULL-Spalte auf_leinwand.
create or replace function public.leinwand_setzen(p_evening uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'nur Admin' using errcode = '42501';
  end if;
  update public.evenings
    set auf_leinwand = coalesce(id = p_evening, false)
    where id is not null;
end;
$$;

revoke execute on function public.leinwand_setzen(uuid) from public, anon;
grant execute on function public.leinwand_setzen(uuid) to authenticated;
