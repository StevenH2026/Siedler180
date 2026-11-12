-- Beginn als echter Zeitpunkt, damit die App ohne Umrechnung im Browser anzeigt
alter table public.evenings add column if not exists beginn_at timestamptz;

create or replace function public.set_anmeldeschluss() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.beginn_at := (new.datum + new.beginn) at time zone 'Europe/Berlin';
  if new.anmeldeschluss is null
     or (tg_op = 'UPDATE'
         and (new.datum, new.beginn) is distinct from (old.datum, old.beginn)
         and new.anmeldeschluss = old.anmeldeschluss) then
    new.anmeldeschluss := new.beginn_at - interval '24 hours';
  end if;
  return new;
end $$;

-- Bestehende Zeile nachziehen (Trigger läuft dabei)
update public.evenings set datum = datum;