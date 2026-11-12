-- Beginn des Abends (Ortszeit Berlin); Anmeldeschluss standardmäßig 24 Stunden davor
alter table public.evenings add column if not exists beginn time not null default '19:30';

create or replace function public.set_anmeldeschluss() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.anmeldeschluss is null
     or (tg_op = 'UPDATE'
         and (new.datum, new.beginn) is distinct from (old.datum, old.beginn)
         and new.anmeldeschluss = old.anmeldeschluss) then
    new.anmeldeschluss := ((new.datum + new.beginn) at time zone 'Europe/Berlin') - interval '24 hours';
  end if;
  return new;
end $$;

create trigger evenings_set_anmeldeschluss
  before insert or update on public.evenings
  for each row execute function public.set_anmeldeschluss();