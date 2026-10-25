-- Leinwand: ein Abend ist markiert (Admin), die Leinwand liest ohne Anmeldung nur Ergebnisse.
alter table public.evenings add column if not exists auf_leinwand boolean not null default false;

-- Admin markiert genau einen Abend für die Leinwand (p_evening = null entfernt die Markierung).
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
  update public.evenings set auf_leinwand = (id = p_evening) where id is not null;
end;
$$;

revoke execute on function public.leinwand_setzen(uuid) from public, anon;
grant execute on function public.leinwand_setzen(uuid) to authenticated;

-- Öffentlich lesbar, aber nur Ergebnisse des markierten Abends. Keine Kennungen, nur Aliase.
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
  from (select * from public.evenings where auf_leinwand limit 1) e;
$$;

revoke execute on function public.leinwand_daten() from public;
grant execute on function public.leinwand_daten() to anon, authenticated;
