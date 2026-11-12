-- Absage (Status abgesagt) ist auch nach dem Anmeldeschluss möglich, solange der Abend offen oder geplant ist.
-- Die Sperre bei vorliegenden Ergebnissen erzwingt der Trigger attendance_absage_sperre.
create policy attendance_own_absage on public.attendance
  for all
  to authenticated
  using (player_id = (select auth.uid()))
  with check (
    player_id = (select auth.uid())
    and status = 'abgesagt'
    and exists (
      select 1 from public.evenings e
      where e.id = attendance.evening_id and e.status in ('offen', 'geplant')
    )
  );