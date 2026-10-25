-- Equipment als Liste: [{"art":"board","anzahl":2}, ...].
-- Die Boards für die Auslosung ergeben sich aus der Summe von anzahl bei art 'board'
-- über alle Zusagen und "Nur Equipment" des Abends.
alter table public.attendance add column if not exists equipment_items jsonb not null default '[]'::jsonb;
alter table public.attendance drop constraint if exists equipment_items_array;
alter table public.attendance add constraint equipment_items_array check (jsonb_typeof(equipment_items) = 'array');
