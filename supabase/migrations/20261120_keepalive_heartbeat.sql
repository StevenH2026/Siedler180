-- Siedler180: Keep-alive mit echter Schreibaktivität (20.11.2026)
-- Anlass: Bei H3-Stats kam am 20.11. eine Pausierungs-Warnung, obwohl dort alle 3 Tage gepingt wurde.
-- Supabase: "a few user requests to the database each day". Außerdem ist leinwand_daten seit 13.11.
-- nur noch für angemeldete Admins am Abend; als Keep-alive-Ziel ungeeignet.
-- Neu: eigene Funktion keepalive(), schreibt einen Zeitstempel in eine Heartbeat-Tabelle (eine Zeile,
-- keine Nutzdaten). anon hat kein Recht auf die Tabelle; nur die Funktion (SECURITY DEFINER) schreibt.
-- Der Workflow ruft sie dreimal täglich auf.

-- Schritt 1 (als ein Block ausführen)
BEGIN;

CREATE TABLE IF NOT EXISTS public.keepalive_heartbeat (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pinged_at timestamptz NOT NULL DEFAULT now(),
  anzahl bigint NOT NULL DEFAULT 0
);
ALTER TABLE public.keepalive_heartbeat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.keepalive_heartbeat FROM anon, authenticated;
INSERT INTO public.keepalive_heartbeat (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS timestamptz
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.keepalive_heartbeat
     SET pinged_at = now(), anzahl = anzahl + 1
   WHERE id = 1
  RETURNING pinged_at;
$$;

REVOKE ALL ON FUNCTION public.keepalive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive() TO anon, authenticated;

COMMIT;


-- Schritt 2 (separat ausführen): Erwartet security_definer = true, volatil = v, anon_exec = true
SELECT p.prosecdef AS security_definer, p.provolatile AS volatil, p.proconfig AS einstellungen,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'keepalive';

-- Schritt 3 (separat ausführen): Erwartet keine Zeile
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'keepalive_heartbeat'
  AND grantee IN ('anon', 'authenticated');

-- Schritt 4 (nach einem Workflow-Lauf): Zeitstempel und Zähler müssen sich bewegen
SELECT pinged_at, anzahl FROM public.keepalive_heartbeat;

-- Rückbau (als ein Block):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.keepalive();
-- DROP TABLE IF EXISTS public.keepalive_heartbeat;
-- COMMIT;
