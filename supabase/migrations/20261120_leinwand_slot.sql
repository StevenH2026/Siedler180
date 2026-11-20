-- Leinwand: Spielrunde (slot) mitliefern, für die Spielplan-Folie "Jetzt / Als Nächstes" (20.11.2026).
-- Sonst unverändert gegenüber 20261113_leinwand_nur_admin.sql: nur angemeldete Admins,
-- markierter Abend, nicht gewertet oder abgesagt, höchstens 12 Stunden nach Beginn.
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
