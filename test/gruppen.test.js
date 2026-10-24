import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruppenTabelle, finaleRangGruppen } from '../src/gruppen.js';

// Hilfsfunktion: Spiel mit Legs aus Sicht von a.
const spiel = (a, b, legsA, legsB) => ({ a, b, legsA, legsB });

test('mehr gewonnene Legs steht höher', () => {
  const ids = ['A', 'B', 'C'];
  const matches = [spiel('A', 'B', 2, 0), spiel('A', 'C', 2, 1), spiel('B', 'C', 1, 2)];
  const t = gruppenTabelle(ids, matches);
  assert.deepEqual(t.map((e) => e.id), ['A', 'C', 'B']);
  assert.deepEqual(t.map((e) => e.rang), [1, 2, 3]);
});

test('bei gleichen gewonnenen Legs entscheiden weniger verlorene Legs', () => {
  // A und B haben je 4 gewonnen; A hat 2 verloren, B hat 4 verloren
  const ids = ['A', 'B', 'C', 'D'];
  const matches = [
    spiel('A', 'C', 2, 0), spiel('A', 'D', 2, 1), // A: 4 gewonnen, 1 verloren
    spiel('B', 'C', 2, 1), spiel('B', 'D', 2, 1), // B: 4 gewonnen, 2 verloren
    spiel('C', 'D', 2, 0),
  ];
  const t = gruppenTabelle(ids, matches);
  const rang = Object.fromEntries(t.map((e) => [e.id, e.rang]));
  assert.ok(rang.A < rang.B, `A (verloren 1) vor B (verloren 2), ist ${JSON.stringify(rang)}`);
});

test('Gleichstand bei Legs: direkter Vergleich entscheidet', () => {
  // Vier Spieler, jeder gegen jeden. A und B haben insgesamt gleich viele Legs (4 gewonnen, 2 verloren),
  // A hat den direkten Vergleich gewonnen. C und D haben (2, 4), dort gewinnt C direkt.
  const matches = [
    spiel('A', 'B', 2, 0),
    spiel('A', 'C', 2, 0),
    spiel('A', 'D', 0, 2),
    spiel('B', 'C', 2, 0),
    spiel('B', 'D', 2, 0),
    spiel('C', 'D', 2, 0),
  ];
  const t = gruppenTabelle(['A', 'B', 'C', 'D'], matches);
  const gesamt = Object.fromEntries(t.map((e) => [e.id, [e.legsGewonnen, e.legsVerloren]]));
  assert.deepEqual(gesamt.A, [4, 2]);
  assert.deepEqual(gesamt.B, [4, 2], 'A und B müssen insgesamt gleich stehen');
  const rang = Object.fromEntries(t.map((e) => [e.id, e.rang]));
  assert.equal(rang.A, 1, 'A gewinnt den direkten Vergleich');
  assert.equal(rang.B, 2);
  assert.equal(rang.C, 3, 'C gewinnt den direkten Vergleich gegen D');
  assert.equal(rang.D, 4);
});

test('Dreiergleichstand ohne Entscheidung: alle teilen sich den Rang', () => {
  // Zyklus: A schlägt B, B schlägt C, C schlägt A, jeweils 2:1
  const ids = ['A', 'B', 'C'];
  const matches = [spiel('A', 'B', 2, 1), spiel('B', 'C', 2, 1), spiel('C', 'A', 2, 1)];
  const t = gruppenTabelle(ids, matches);
  assert.deepEqual(t.map((e) => e.rang), [1, 1, 1]);
});

test('finaleRangGruppen: alle Ersten, alle Zweiten, alle Dritten', () => {
  const tabellen = [
    [{ id: 'A1', rang: 1 }, { id: 'A2', rang: 2 }, { id: 'A3', rang: 3 }],
    [{ id: 'B1', rang: 1 }, { id: 'B2', rang: 2 }, { id: 'B3', rang: 3 }],
    [{ id: 'C1', rang: 1 }, { id: 'C2', rang: 2 }, { id: 'C3', rang: 3 }],
  ];
  assert.deepEqual(finaleRangGruppen(tabellen), [
    ['A1', 'B1', 'C1'],
    ['A2', 'B2', 'C2'],
    ['A3', 'B3', 'C3'],
  ]);
});

test('finaleRangGruppen: Gleichstand verschiebt keine Ränge', () => {
  const tabellen = [
    [{ id: 'A1', rang: 1 }, { id: 'A2', rang: 1 }, { id: 'A3', rang: 3 }],
    [{ id: 'B1', rang: 1 }, { id: 'B2', rang: 2 }, { id: 'B3', rang: 3 }],
  ];
  const gruppen = finaleRangGruppen(tabellen);
  assert.deepEqual(gruppen[0], ['A1', 'A2', 'B1']);
  assert.deepEqual(gruppen[1], ['B2']);
  assert.deepEqual(gruppen[2], ['A3', 'B3']);
});
