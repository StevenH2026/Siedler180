# Dokumentation Siedler180 (Version 1.0.0)

Technische Übersicht für Pflege und Weiterentwicklung. Für Spieler gibt es die [Spieler-Anleitung](spieler-anleitung.md), die Turnierregeln stehen in [turnierlogik.md](turnierlogik.md), die Vorbereitung zum Start in [vor-auslieferung.md](vor-auslieferung.md).

## Überblick
- Statische Webseite (HTML, CSS, JavaScript als ES-Module), kein Build-Schritt.
- Hosting: GitHub Pages aus dem Repository `StevenH2026/Siedler180` (Branch `main`).
- Backend: Supabase (Postgres, Auth mit Magic Link, Realtime). Projekt `pperengmwnidbtaqjlmv`, Region eu-central-1.
- Mail-Versand für die Anmeldung über Brevo (SMTP in Supabase eingetragen).
- Der Client nutzt nur den öffentlichen Publishable Key (`config.js`). Die Sicherheit liegt in den Zeilenrechten (RLS) und den Funktionen in der Datenbank.

## Seiten
| Datei | Zweck |
|---|---|
| `index.html`, `app.js` | Hauptseite: Anmeldung, Startseite, Termine, Spielplan, Verwaltung |
| `styles.css` | Gemeinsame Gestaltung, Leinwand-Design ab Klasse `.leinwand` |
| `rangliste.html`, `rangliste.js` | Ranglisten in eigenem Fenster |
| `leinwand.html`, `leinwand.js` | Beamer-Anzeige ohne Anmeldung |
| `src/version.js` | Versionsanzeige aller Seiten |

## Module in `src/`
| Modul | Inhalt |
|---|---|
| `draw.js` | Auslosung: `gruppenAnzahl` (faire Gruppenform), `gruppenOptionen` (Varianten mit Zeit), `planEvening`, `planFinale`, Packung der Spiele auf die Boards |
| `gruppen.js` | Gruppentabelle und Finale-Gruppen aus den Rängen |
| `abend.js` | Ranglisten und Tabellen eines Abends |
| `legquote.js` | Gesamtrangliste über gewertete Abende (12 Monate, mindestens 4 Abende) |
| `ics.js` | Kalenderdatei (.ics) für zugesagte Termine |
| `planning.js` | Prüfung der Monatsabdeckung, noch nicht eingebunden |

## Datenbank
Tabellen:
- `profiles` (Spielername, Anzeige), `admins`
- `evenings`: Datum, Beginn, `beginn_at` (Europe/Berlin), Ort, `boards` (bestätigte Anzahl), Status (`entwurf`, `offen`, `geplant`, `gewertet`, `freundschaftlich`, `abgesagt`), `anmeldeschluss`, `auf_leinwand`
- `attendance`: Teilnahme je Spieler und Abend. Status `zugesagt`, `nur_equipment`, `abgesagt`. Equipment als Liste in `equipment_items` (jsonb)
- `matches`: Spiele mit Gruppe, Runde, Slot, Legs und Bestätigung

Wichtige Funktionen:
- `is_admin()`: Admin-Prüfung für alle Admin-Aktionen
- `set_anmeldeschluss()` (Trigger): Anmeldeschluss 24 Stunden vor Beginn
- `auslosen()`, `finale_auslosen()`: Spielplan schreiben, nur Admin
- `set_match_result()`, `confirm_match_result()`: Ergebnis eintragen und bestätigen
- `absage_nach_ergebnis_sperren()` (Trigger): Absage nicht mehr möglich, sobald ein Ergebnis vorliegt
- `termin_anlegen(datum, beginn, ort, boards)`: Abend anlegen, nur Admin
- `leinwand_setzen(abend)`: markiert einen Abend für die Leinwand, nur Admin
- `leinwand_daten()`: öffentlich lesbar, liefert nur Ergebnisse und Aliase des markierten Abends

Zeilenrechte (Auszug):
- `attendance`: eigene Zeilen bis zum Anmeldeschluss, eigene Absage auch danach, Admin alles
- Ergebnisse und Termine sind für angemeldete Spieler lesbar

Migrationen liegen in `supabase/migrations/`. Drei Änderungen sind direkt in der Datenbank angewendet, aber noch nicht als Datei abgelegt: Realtime-Publikation, Equipment und Absage-Sperre, Absage nach Anmeldeschluss. Das ist nachzutragen.

## Admin-Ablauf an einem Spielabend
1. Termin anlegen: Formular auf der Terminseite (ausklappbar, nur Admin).
2. Zusagen abwarten. Equipment und Boards prüfen.
3. Verwaltung des Abends öffnen. Boards am Abend bestätigen, Gruppenform wählen (bei ungleicher Aufteilung nach Umfrage).
4. Auslosen. Der Dialog nennt Boards, Gruppen und Zeit.
5. Ergebnisse prüfen, bei Bedarf korrigieren.
6. Finale auslosen, sobald alle Vorrunden-Ergebnisse bestätigt sind.
7. Abend werten, sobald alle Spiele bestätigt sind. Er zählt dann für die Gesamtrangliste.
8. Leinwand: Abend markieren, Beamer-Rechner öffnet `leinwand.html`.

## Versionierung und Cache
- Die Versionsnummer steht in `src/version.js` und wird auf allen Seiten angezeigt.
- Der Browser lädt Module nach Dateiname. Bei jeder Änderung an einer Datei muss der `?v=`-Parameter in der importierenden Datei und im HTML erhöht werden. Sonst zeigt der Browser alte Versionen.
- Stylesheet: `styles.css?v=` in allen HTML-Dateien gleich halten.

## Tests
- `npm test` (Node, eingebauter Test-Runner). Derzeit 49 Tests in `test/`.
- Die Tests laufen in Node. Browser-Fehler wie fehlende Node-Objekte fallen dort nicht auf.

## Deployment
1. Änderung committen und nach `main` pushen. GitHub Pages veröffentlicht automatisch.
2. Datenbankänderungen als Migrationsdatei ablegen und in Supabase anwenden.
3. Versionsnummer, Changelog und ggf. Release-Tag aktualisieren.

## Release 1.0.0
- Tag `v1.0.0` auf dem Commit des Releases. Release-Notizen aus `CHANGELOG.md`.
- Bekannte Einschränkungen stehen im Changelog.

## Bekannt offen
- Browser- und Smartphone-Test der Leinwand, Equipment-Auswahl, Board-Bestätigung und Gruppenform.
- Opt-in für die Rangliste.
- Automatische Auslosung zum Anmeldeschluss (pg_cron prüfen).
- E-Mail-Benachrichtigungen mit ICS-Anhang und Planungsprüfung.
- Eigene Domain für den Absender (SPF, DKIM, DMARC).
- Manifest-Icons.
