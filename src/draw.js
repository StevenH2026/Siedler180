// Abendform: Gruppen, Round-Robin pro Gruppe, Aufteilung auf Spielrunden (Slots).
// Reine Funktionen, keine Abhängigkeiten. Zufall ist injizierbar (rng), damit Tests deterministisch sind.

const TARGET_SIZE_SHORT = 4; // Gruppengröße bei n <= SHORT_LIMIT
const TARGET_SIZE_LONG = 6;  // sonst
const SHORT_LIMIT = 12;

export const MIN_PLAYERS = 4;

/**
 * Plant einen Spielabend.
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
  const n = shuffled.length;
  const target = n <= SHORT_LIMIT ? TARGET_SIZE_SHORT : TARGET_SIZE_LONG;
  const groupCount = Math.ceil(n / target);

  // Gleichmäßig verteilen: Gruppengrößen unterscheiden sich um höchstens 1.
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    name: `Gruppe ${String.fromCharCode(65 + i)}`,
    players: [],
  }));
  shuffled.forEach((p, i) => groups[i % groupCount].players.push(p));

  // Pro Gruppe ein vollständiges Round-Robin, dann logische Runden über alle Gruppen.
  const perGroupRounds = groups.map((g) => roundRobin(g.players));
  const maxRounds = Math.max(...perGroupRounds.map((r) => r.length));

  const slots = [];
  for (let r = 0; r < maxRounds; r++) {
    const logicalRound = [];
    perGroupRounds.forEach((rounds, gi) => {
      for (const [a, b] of rounds[r] ?? []) {
        logicalRound.push({ group: groups[gi].name, round: r + 1, a, b });
      }
    });
    // Spieler innerhalb einer logischen Runde sind verschieden (Gruppen sind disjunkt),
    // also darf man die Matches beliebig auf Slots mit höchstens `boards` Matches verteilen.
    for (let k = 0; k < logicalRound.length; k += boards) {
      slots.push(logicalRound.slice(k, k + boards));
    }
  }

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

function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
