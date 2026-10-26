# Changelog Siedler180

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
