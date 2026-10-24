# Vor der Auslieferung: Testdaten bereinigen

Alles, was während Bau und Test im Supabase-Projekt `pperengmwnidbtaqjlmv` angelegt wurde und nicht zum echten Betrieb gehört, muss vor dem Start entfernt werden.

## Testdaten (zu löschen)

| Art | Kennung | Status |
|---|---|---|
| Abend „TESTABEND – vor Auslieferung löschen“ | `7e87b5b9-c2e4-4eb8-b2e3-9c6579b84a9c` (2. November 2026) | offen |

Weitere Testdaten entstehen nur in Transaktionen, die zurückgerollt wurden. Dort ist nichts übrig geblieben.

Zusätzlich angelegte Testkonten (Auslosungstest, 23.10.2026):

| Art | Kennung | Status |
|---|---|---|
| Testkonten `test-spieler-1` bis `test-spieler-7` `@example.invalid`, IDs `a0000000-0000-4000-8000-00000000000N` | Profile, Kontakte, Teilnahmen, Spielplan hängen daran | offen |

Löschen (Reihenfolge egal, Fremdschlüssel sind kaskadierend):

```sql
delete from auth.users where email like 'test-spieler-%@example.invalid';
delete from evenings where id = '7e87b5b9-c2e4-4eb8-b2e3-9c6579b84a9c';
```

## Echte Daten (behalten)

- Admin-Konto von Steffen (Eintrag in `admins`, Profil und Kontakt über den Trigger angelegt)

## Vor dem Start prüfen

- [ ] Test-Abend gelöscht, Tabelle `evenings` enthält nur echte Termine
- [ ] Tabelle `matches` und `attendance` enthalten keine Testeinträge
- [ ] Keine Test-Auth-User außer dem Admin in `auth.users`
- [ ] Der Secret Key ist nirgends im Repository und nicht im Chat aufgetaucht; falls doch, rotieren
- [x] Eigener SMTP-Anbieter (Brevo) in Supabase eingetragen, Absender `steffen.hanske@gmail.com` verifiziert
- [ ] Eigene Domain für den Absender (Brevo-Hinweis: Freemail-Domains werden für DMARC nicht empfohlen). Dann SPF, DKIM und DMARC für die Domain setzen
- [ ] Schlüssel „Siedler180“ in Brevo nach dem Test prüfen, nur ein Schlüssel pro Dienst
- [ ] Manifest hat Icons (aktuell leer)
- [ ] Redirect-URL und Site URL in Supabase stimmen mit der Live-Adresse überein

## Testabende (Simulation 24.10.2026)
- Vier Testabende mit Ort „TEST – löschen“ (Termine 03.11., 10.11., 17.11., 24.11.2026), Teilnehmer TEST01 bis TEST07.
- Vor dem Start löschen: `delete from evenings where ort = 'TEST – löschen';` (Teilnahmen und Spiele folgen per Cascade).
