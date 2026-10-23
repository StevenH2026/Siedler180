-- Ein bestätigtes Ergebnis darf nur noch der Admin ändern.
create or replace function public.set_match_result(p_match uuid, p_legs_a integer, p_legs_b integer)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  m public.matches;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'nicht angemeldet'; end if;
  if (p_legs_a, p_legs_b) not in ((2,0),(2,1),(1,2),(0,2)) then
    raise exception 'ungültiges Ergebnis: %:%', p_legs_a, p_legs_b;
  end if;
  select * into m from public.matches where id = p_match;
  if not found then raise exception 'Match nicht gefunden'; end if;
  if not (uid in (m.spieler_a, m.spieler_b) or public.is_admin()) then
    raise exception 'nicht beteiligt';
  end if;
  if m.bestaetigt_von is not null and not public.is_admin() then
    raise exception 'Ergebnis ist bereits bestätigt';
  end if;
  update public.matches
    set legs_a = p_legs_a,
        legs_b = p_legs_b,
        eingetragen_von = uid,
        bestaetigt_von = case when public.is_admin() then uid else null end
    where id = p_match;
end
$function$;
