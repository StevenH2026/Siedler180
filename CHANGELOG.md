# Changelog Siedler180

## 1.1.1 · 21.11.2026
- Verwaltung: Teilnehmerliste im Überblick (Status, was mitgebracht wird, wer noch nicht geantwortet hat).
- Eigene Seite „Ergebnisse“ für den Admin: wartet auf Bestätigung, ohne Ergebnis, bestätigt; Bestätigen und Eintragen mit einem Tipp.
- Statusmeldungen erscheinen jetzt auch in Verwaltung und Spielplan (vorher nur in der Terminliste).

## 1.1.0 · 20.11.2026

### Anmeldung
- Anmeldung per Code aus der E-Mail (funktioniert in jedem Fenster und auf dem iPhone-Startbildschirm), der Link in der Mail geht weiterhin.

### Auslosung und Spielbetrieb
- Auslosen ab 3 Spielern. Turniermodus mit allen Varianten (Gruppenzahl, mit/ohne Hin- und Rückrunde, Finale bei mehreren Gruppen), geschätzte Dauer inkl. Finale, markiert nach Zielzeit 60–90 min ±15. Passt nichts, schlägt die App eine andere Boardzahl vor.
- Boardnummer je Spiel. Offene Vorrunden-Paarungen werden beim Finale angezeigt. Kein Finale bei nur einer Gruppe.
- Gleichstand: direkter Vergleich, danach Ausbullen (Admin trägt die Reihenfolge ein).
- Platz des Abends nach Finale bzw. Gruppentabelle; Spieler sehen „Dein Platz heute“. Neues „Mein Archiv“.

### Leinwand
- Nur für angemeldete Admins und nur während des Abends.
- Folien: Spielplan (jetzt/als Nächstes, Board, Pause), Gruppen, Weg ins Finale mit allen Finalpaarungen, am Ende alle Ergebnisse, Platzierung; Listen mit 15 Zeilen je Folie.
- Nach dem Werten bleibt die Ansicht mit Gesamtrangliste stehen, bis die Seite geschlossen wird.

### Betrieb
- Keep-alive dreimal täglich, Härtung der Teilnahme-Regeln, Datensicherung als Export.

## 1.0.1 · 26.10.2026
- Kleinere Korrekturen nach 1.0.0 (Details siehe Git-Verlauf).

## 1.0.0 · 26.10.2026

Erste Version für die Spielabende der Siedlergemeinschaft Viernheim.

### Anmeldung und Teilnahme
- Anmeldung per Magic Link per E-Mail, ohne Passwort. Spielername (Alias) beim ersten Start.
- Teilnahme: „Ich bin dabei“, „Nur Equipment“, „Abgesagt“.
- Equipment als Auswahl (Board, Surround, Beleuchtung, Teppich) mit Anzahl. „Mitbringen angeben“ auch für zugesagte Spieler.
- Anmeldeschluss 24 Stunden vor Beginn. Absage bleibt danach möglich, bis das erste Ergebnis vorliegt.
- Zugesagte Termine als Kalenderdatei (.ics).

### Auslosung (Admin)
- Board-Anzahl wird vor der Auslosung in der Verwaltung bestätigt.
- Gruppenform: faire Spielverteilung zuerst. Bei ungleicher Aufteilung (z. B. 7, 11, 13 Spieler) wählt der Admin zwischen Automatik, Zwei Gruppen oder Eine große Gruppe, jeweils mit Spielzahl und Zeit.
- Finale-Auslosung je Rang, sobald alle Vorrunden-Ergebnisse bestätigt sind.
- Abende anlegen über das Formular auf der Terminseite.

### Spielplan und Ergebnisse
- Spielplan für Spieler mit Finale oben und eigener Gruppe. Andere Gruppen auf Knopfdruck.
- Ergebnisse eintragen, der Gegner bestätigt. Abweichende Ergebnisse werden bewusst gemeldet.
- Bestätigte Ergebnisse können nur vom Admin geändert werden.

### Ranglisten und Leinwand
- Rangliste des Abends und Gesamtrangliste (gewertete Abende, rollierendes 12-Monats-Fenster, ab 4 gewerteten Abenden).
- Leinwand ohne Anmeldung für den Beamer: Der Admin markiert einen Abend, die Seite zeigt Gruppen und Rangliste. Ansicht und Wechselzeit wählbar.

### Bekannte Einschränkungen in 1.0.0
- Keine automatische Auslosung zum Anmeldeschluss, der Admin lost am Spielabend aus.
- Keine E-Mail-Benachrichtigungen zu Terminen oder Auslosung (nur Anmelde-Mails).
- Die Gesamtrangliste zeigt alle Spieler mit Spielernamen. Ein Opt-in gibt es noch nicht.
- Kein Warteliste-Modus.
- Eigene Domain für den Mail-Absender (SPF, DKIM, DMARC) steht aus.
