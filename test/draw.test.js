import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planEvening, roundRobin } from '../src/draw.js';

// Deterministischer Zufall für reproduzierbare Tests.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const ids = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

test('roundRobin: gerade Anzahl, jedes Paar genau einmal', () => {
  const rounds = roundRobin(['A', 'B', 'C', 'D']);
  assert.equal(rounds.length, 3);
  const pairs = rounds.flat().map((p) => p.slice().sort().join('-')).sort();
  assert.deepEqual(pairs, ['A-B', 'A-C', 'A-D', 'B-C', 'B-D', 'C-D']);
});

test('roundRobin: ungerade Anzahl, Freilos in jeder Runde', () => {
  const rounds = roundRobin(['A', 'B', 'C']);
  const pairs = rounds.flat().map((p) => p.slice().sort().join('-')).sort();
  assert.deepEqual(pairs, ['A-B', 'A-C', 'B-C']);
  for (const r of rounds) assert.equal(r.length, 1);
});

test('12 Spieler, 3 Boards: drei Gruppen à 4, 18 Matches, 6 Spielrunden', () => {
  const plan = planEvening({ players: ids(12), boards: 3, rng: seeded(7) });
  assert.equal(plan.groups.length, 3);
  for (const g of plan.groups) assert.equal(g.players.length, 4);
  assert.equal(plan.matchCount, 18);
  assert.equal(plan.slots.length, 6);
  assert.equal(plan.estimatedMinutes, 42);
  assert.deepEqual(plan.warnings, []);
});

test('jede Gruppe spielt jedes Paar genau einmal', () => {
  const plan = planEvening({ players: ids(12), boards: 3, rng: seeded(42) });
  for (const g of plan.groups) {
    const groupMatches = plan.slots
      .flat()
      .filter((m) => m.group === g.name)
      .map((m) => [m.a, m.b].sort().join('-'));
    assert.equal(new Set(groupMatches).size, groupMatches.length, 'keine Doppelpaarung');
    assert.equal(groupMatches.length, 6);
  }
});

test('kein Spieler spielt zweimal in derselben Spielrunde', () => {
  const plan = planEvening({ players: ids(13), boards: 2, rng: seeded(3) });
  for (const slot of plan.slots) {
    const seen = new Set();
    for (const m of slot) {
      assert.ok(!seen.has(m.a) && !seen.has(m.b), 'Doppelbelegung in Slot');
      seen.add(m.a);
      seen.add(m.b);
    }
    assert.ok(slot.length <= 2, 'nicht mehr Matches als Boards');
  }
});

test('Gruppengrößen unterscheiden sich höchstens um 1', () => {
  for (const n of [5, 7, 9, 13, 17]) {
    const plan = planEvening({ players: ids(n), boards: 4, rng: seeded(n) });
    const sizes = plan.groups.map((g) => g.players.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `n=${n}: ${sizes}`);
    assert.equal(sizes.reduce((a, b) => a + b, 0), n);
  }
});

test('Warnung, wenn die geschätzte Dauer die Zielzeit überschreitet', () => {
  // 12 Spieler, 1 Board: 18 Slots à 7 min = 126 min > 120 min
  const plan = planEvening({ players: ids(12), boards: 1, rng: seeded(1) });
  assert.equal(plan.estimatedMinutes, 126);
  assert.equal(plan.warnings.length, 1);
});

test('Fehlerfälle: zu wenige Spieler, ungültige Boards, doppelte Ids', () => {
  assert.throws(() => planEvening({ players: ids(3), boards: 2 }), /mindestens 4/);
  assert.throws(() => planEvening({ players: ids(6), boards: 0 }), /boards/);
  assert.throws(() => planEvening({ players: ['A', 'A', 'B', 'C'], boards: 2 }), /doppelte/);
});

test('8 Spieler, 3 Boards: 12 Spiele auf 4 Slots (statt 6), 28 min', () => {
  const plan = planEvening({ players: ids(8), boards: 3, rng: seeded(11) });
  assert.equal(plan.matchCount, 12);
  assert.equal(plan.slots.length, 4);
  assert.equal(plan.estimatedMinutes, 28);
});

test('Invarianten über viele Kombinationen: Paare, Slots, Boards, Spieler je Slot', () => {
  for (let n = 4; n <= 30; n++) {
    for (let boards = 1; boards <= 4; boards++) {
      const plan = planEvening({ players: ids(n), boards, rng: seeded(n * 10 + boards) });
      // Jedes Paar einer Gruppe genau einmal
      const paare = new Map();
      for (const slot of plan.slots) {
        assert.ok(slot.length <= boards, `n=${n} b=${boards}: Slot über Boardzahl`);
        const seen = new Set();
        for (const m of slot) {
          assert.ok(!seen.has(m.a) && !seen.has(m.b), `n=${n} b=${boards}: Doppelbelegung`);
          seen.add(m.a);
          seen.add(m.b);
          const key = `${m.group}#${[m.a, m.b].sort().join('|')}`;
          paare.set(key, (paare.get(key) ?? 0) + 1);
        }
      }
      for (const [key, count] of paare) assert.equal(count, 1, `n=${n} b=${boards}: ${key}`);
      const erwartet = plan.groups.reduce((s, g) => s + (g.players.length * (g.players.length - 1)) / 2, 0);
      assert.equal(plan.matchCount, erwartet, `n=${n} b=${boards}: Spieleanzahl`);
    }
  }
});
