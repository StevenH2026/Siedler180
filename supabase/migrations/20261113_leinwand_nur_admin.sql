-- Leinwand nur noch für angemeldete Admins und nur während des Abends (Entscheidung 13.11.2026).
-- Vorher war leinwand_daten() ohne Anmeldung abrufbar und lieferte den markierten Abend,
-- bis ein anderer Abend markiert wurde (also auch nach Ende des Abends).
--
-- Jetzt:
--   * Nur wer als Admin angemeldet ist, bekommt Daten. Alle anderen (auch anon) bekommen NULL.
--   * Der Abend muss markiert sein, nicht gewertet und nicht abgesagt sein
--     und darf höchstens 12 Stunden zurückliegen.
-- anon behält das Ausführungsrecht, damit der Keep-alive-Workflow weiter HTTP 200 bekommt
-- (die Funktion liefert dann NULL, der Datenbankzugriff findet trotzdem statt).
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

revoke execute on function public.leinwand_daten() from public;
grant execute on function public.leinwand_daten() to anon, authenticated;
