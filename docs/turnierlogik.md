# Turnierlogik (Entscheidungen, Stand 24.10.2026)

## Entschieden
- Anwesenheit ist variabel: 17 Mitglieder, nicht jeder ist bei jedem Abend da. Die Auslosung arbeitet mit den tatsächlich Zugesagten.
- Dauer 1 bis 2 Stunden. Zielzeit 120 Minuten, 7 Minuten pro Spielrunde.
- Immer 3 Boards.
- **Gruppenphase:** Die Gruppenanzahl richtet sich nach einer fairen Spielverteilung (erste Priorität): gleich große Gruppen, sodass jeder gleich viele Spiele hat. Danach zählt eine Gruppengröße nahe 4, Gruppen zwischen 3 und 5 Spielern. Beispiele: 6 Spieler 2×3, 8 Spieler 2×4, 9 Spieler 3×3, 12 Spieler 3×4, 14 Spieler 4 Gruppen (3/3/4/4). Zeit ist zweitrangig. Jeder spielt gegen jeden in seiner Gruppe.
  - 6 Spieler: 2/2/2, 3 Spiele
  - 9 Spieler: 3/3/3, 9 Spiele, ca. 21 min
  - 12 Spieler: 4/4/4, 18 Spiele, ca. 42 min
  - 17 Spieler: 6/6/5, 40 Spiele, ca. 98 min
- **Rangfolge in der Gruppe** (in dieser Reihenfolge):
  1. gewonnene Legs (mehr ist besser)
  2. verlorene Legs (weniger ist besser)
  3. direkter Vergleich: dieselben Kriterien nur für die Spiele zwischen den punktgleichen Spielern
  Bleibt danach ein Gleichstand, teilen sich die Spieler den Rang (1, 1, 3, ...).
- **Finale:** je Rang eine Gruppe. Alle Ersten spielen gegeneinander, alle Zweiten, alle Dritten, und so weiter. Jede Finalgruppe spielt jeder gegen jeden.
  - Bei 9 Spielern: 3 Finalgruppen à 3, je 9 Spiele, ca. 21 min.
  - Die Platzierung ergibt sich aus der Finalgruppe: Erste Gruppe Plätze 1 bis 3, zweite Gruppe 4 bis 6, dritte Gruppe 7 bis 9.
- **Rangliste am Spielabend (Gruppe und Finale):** wie oben, also gewonnene Legs, verlorene Legs, direkter Vergleich.
- **Gesamtrangliste (über mehrere Abende, 12 Monate):**
  1. Summe der gewonnenen Legs (mehr ist besser)
  2. Summe der verlorenen Legs (weniger ist besser)
  Gleichstand bei beiden: gleicher Rang. Die Legquote wird angezeigt, sortiert aber nicht. Sie ist bei gleichen gewonnenen und verlorenen Legs automatisch gleich, also als Kriterium wirkungslos.
  Folge der Summenregel: Wer häufiger kommt, sammelt mehr Legs und steht höher. [Sicher]

## Teilnahme und Absagen (Entscheidungen, 24.10.2026)
- **Nur Equipment:** öffnet eine Maske, in der der Spieler einträgt, welches Equipment er mitbringen kann.
- **Warteliste:** entfällt. Ziel ist, alle Angemeldeten spielen zu lassen.
- **Absage bleibt möglich**, auch nach der Auslosung. Der Button „Abgesagt“ bleibt erhalten.
- **Absage nach dem Anmeldeschluss** ist erlaubt, zeigt aber einen Hinweis: Damit wird eine neue Auslosung gemacht.
- Die Auslosung findet am Spielabend statt. Das Risiko einer Neuauslosung ist daher gering.

## Offen
- Die alte Regel in `src/legquote.js` (Legquote als Hauptsortierung) ist ersetzt. Die Regeln im Kopf der Datei sind aktualisiert.
- Rangliste-Oberfläche mit Opt-in-Schalter ist noch nicht gebaut.
- Zeitbedarf des Finales bei größeren Abenden (z. B. 17 Spieler) prüfen.
- Neuauslosung nach Absage, wenn bereits Ergebnisse eingetragen sind: Die Datenbank verhindert das bisher. Entscheidung offen.
- Mindestanzahl: 6 Spieler (zwei Gruppen à drei). Ob bei weniger ein Sonderfall gilt, ist offen.
