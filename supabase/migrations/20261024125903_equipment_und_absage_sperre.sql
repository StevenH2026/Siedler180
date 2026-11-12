alter table public.attendance add column if not exists equipment text;

create or replace function public.absage_nach_ergebnis_sperren()
returns trigger language plpgsql as $$
begin
  if new.status = 'abgesagt'
     and (tg_op = 'INSERT' or old.status is distinct from 'abgesagt')
     and exists (
       select 1 from public.matches m
       where m.evening_id = new.evening_id and m.legs_a is not null
     ) then
    raise exception 'Absage nicht mehr möglich: an diesem Abend liegen bereits Ergebnisse vor';
  end if;
  return new;
end $$;

drop trigger if exists attendance_absage_sperre on public.attendance;
create trigger attendance_absage_sperre
  before insert or update on public.attendance
  for each row execute function public.absage_nach_ergebnis_sperren();