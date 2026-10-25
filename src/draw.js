// Abendform: Gruppen so wählen, dass die Spiele fair verteilt sind (erste Priorität), danach
// Round-Robin pro Gruppe und Aufteilung auf Spielrunden (Slots). Danach Finale nach Rängen.
// Reine Funktionen, keine Abhängigkeiten. Zufall ist injizierbar (rng), damit Tests deterministisch sind.

export const MIN_PLAYERS = 6;
export const MIN_GROUP = 3; // jeder Spieler soll mindestens 2 Gruppenspiele haben
export const MAX_GROUP = 5;

/**
 * Gruppenanzahl für n Spieler. Erste Priorität: gleich große Gruppen, denn dann spielt jeder
 * gleich viele Spiele. Danach: Gruppengröße möglichst nahe 4. Gruppen zwischen 3 und 5 Spielern.
 * Ist keine gleich große Aufteilung möglich, wird der Größenunterschied auf 1 begrenzt.
 */
export function gruppenAnzahl(n) {
  const kandidaten = [];
  for (let g = 2; g <= Math.floor(n / MIN_GROUP); g++) {
    const kleinst = Math.floor(n / g);
    const groesst = Math.ceil(n / g);
    if (kleinst < MIN_GROUP || groesst > MAX_GROUP) continue;
    kandidaten.push({ g, ungleich: groesst - kleinst, abstand: Math.abs(n / g - 4) });
  }
  if (kandidaten.length === 0) {
    throw new Error(`keine passende Gruppenaufteilung für ${n} Spieler`);
  }
  kandidaten.sort((a, b) => a.ungleich - b.ungleich || a.abstand - b.abstand);
  return kandidaten[0].g;
}

/**
 * Plant die Gruppenphase eines Spielabends.
 * @param {object} opts
 * @param {Array<string|number>} opts.players  Anwesende (Ids)
 * @param {number} opts.boards                 verfügbare Boards
 * @param {number} [opts.minutesPerSlot=7]     geschätzte Dauer einer Spielrunde
 * @param {number} [opts.targetMinutes=120]    Zielzeit des Abends
 * @param {() => number} [opts.rng=Math.random]
 */
export function planEvening({
  players,
  boards,
  minutesPerSlot = 7,
  targetMinutes = 120,
  rng = Math.random,
}) {
  if (!Number.isInteger(boards) || boards < 1) {
    throw new Error('boards muss eine ganze Zahl >= 1 sein');
  }
  if (players.length < MIN_PLAYERS) {
    throw new Error(`mindestens ${MIN_PLAYERS} Spieler nötig, angemeldet: ${players.length}`);
  }
  if (new Set(players).size !== players.length) {
    throw new Error('doppelte Spieler-Ids in der Anmeldung');
  }

  const shuffled = shuffle(players, rng);

  // Gleichmäßig verteilen: Gruppengrößen unterscheiden sich um höchstens 1.
  const anzahl = gruppenAnzahl(players.length);
  const groups = Array.from({ length: anzahl }, (_, i) => ({
    name: `Gruppe ${String.fromCharCode(65 + i)}`,
    players: [],
  }));
  shuffled.forEach((p, i) => groups[i % anzahl].players.push(p));

  const matches = roundRobinMatches(groups, (g) => g.name);
  const slots = packSlots(matches, boards, rng);
  return summarize({ groups, slots, boards, minutesPerSlot, targetMinutes });
}

/**
 * Plant das Finale: je Rang eine Gruppe (alle Ersten, alle Zweiten, ...).
 * @param {object} opts
 * @param {Array<Array<string|number>>} opts.rankGroups  Spieler je Rang, Index 0 = Rang 1
 */
export function planFinale({
  rankGroups,
  boards,
  minutesPerSlot = 7,
  targetMinutes = 120,
  rng = Math.random,
}) {
  if (!Number.isInteger(boards) || boards < 1) {
    throw new Error('boards muss eine ganze Zahl >= 1 sein');
  }
  const groups = rankGroups
    .map((players, i) => ({ name: `Finale Rang ${i + 1}`, players: players.slice() }))
    .filter((g) => g.players.length >= 2);
  const matches = roundRobinMatches(groups, (g) => g.name);
  const slots = packSlots(matches, boards, rng);
  return summarize({ groups, slots, boards, minutesPerSlot, targetMinutes });
}

function roundRobinMatches(groups, nameOf) {
  const perGroupRounds = groups.map((g) => roundRobin(g.players));
  const maxRounds = Math.max(0, ...perGroupRounds.map((r) => r.length));
  const matches = [];
  for (let r = 0; r < maxRounds; r++) {
    perGroupRounds.forEach((rounds, gi) => {
      for (const [a, b] of rounds[r] ?? []) {
        matches.push({ group: nameOf(groups[gi]), round: r + 1, a, b });
      }
    });
  }
  return matches;
}

function summarize({ groups, slots, boards, minutesPerSlot, targetMinutes }) {
  const matchCount = slots.reduce((sum, s) => sum + s.length, 0);
  const estimatedMinutes = slots.length * minutesPerSlot;
  const warnings = [];
  if (estimatedMinutes > targetMinutes) {
    warnings.push(
      `Geschätzte Dauer ${estimatedMinutes} min überschreitet die Zielzeit von ${targetMinutes} min. ` +
        'Mehr Boards oder kleinere Gruppen einplanen.',
    );
  }
  return { groups, slots, matchCount, estimatedMinutes, warnings };
}

/**
 * Round-Robin nach der Kreismethode. Gibt für jede Runde die Paarungen zurück.
 * Bei ungerader Spielerzahl entfällt in jeder Runde genau ein Spieler (Freilos).
 */
export function roundRobin(players) {
  const list = players.slice();
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    // Erstes Element fest, der Rest rotiert.
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

/**
 * Packt Spiele auf Slots: höchstens `boards` Spiele pro Slot, kein Spieler zweimal im Slot.
 * Ein Greedy-Durchlauf in Reihenfolge; danach werden zufällige Reihenfolgen probiert,
 * bis die Untergrenze erreicht ist oder die Versuche aufgebraucht sind.
 */
export function packSlots(matches, boards, rng = Math.random, tries = 200) {
  const greedy = (order) => {
    const rest = order.slice();
    const slots = [];
    while (rest.length > 0) {
      const slot = [];
      const belegt = new Set();
      for (let i = 0; i < rest.length && slot.length < boards; ) {
        const m = rest[i];
        if (!belegt.has(m.a) && !belegt.has(m.b)) {
          slot.push(m);
          belegt.add(m.a);
          belegt.add(m.b);
          rest.splice(i, 1);
        } else {
          i++;
        }
      }
      slots.push(slot);
    }
    return slots;
  };

  // Untergrenze: Boards-Kapazität und die meisten Spiele eines einzelnen Spielers
  // (ein Spieler kann pro Slot nur einmal antreten).
  const proSpieler = new Map();
  for (const m of matches) {
    proSpieler.set(m.a, (proSpieler.get(m.a) ?? 0) + 1);
    proSpieler.set(m.b, (proSpieler.get(m.b) ?? 0) + 1);
  }
  const untergrenze = Math.max(
    Math.ceil(matches.length / boards),
    ...proSpieler.values(),
  );

  let best = greedy(matches);
  for (let t = 0; t < tries && best.length > untergrenze; t++) {
    const candidate = greedy(shuffle(matches, rng));
    if (candidate.length < best.length) best = candidate;
  }
  return best;
}

function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
