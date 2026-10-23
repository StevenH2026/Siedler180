import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, addMonths, isValidResult } from '../src/legquote.js';

const TODAY = '2026-10-23';

const m = (a, b, legsA, legsB) => ({ a, b, legsA, legsB });

test('addMonths: rollierend 12 Monate, Monatsende gekappt', () => {
  assert.equal(addMonths('2026-10-23', -12), '2025-10-23');
  assert.equal(addMonths('2024-02-29', -12), '2023-02-28');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
});

test('isValidResult: nur 2:0, 2:1, 1:2, 0:2', () => {
  for (const [a, b] of [[2, 0], [2, 1], [1, 2], [0, 2]]) assert.ok(isValidResult(a, b));
  for (const [a, b] of [[2, 2], [3, 0], [1, 1], [0, 0]]) assert.ok(!isValidResult(a, b));
});

test('Legquote ist Summe über Legs, nicht Mittelwert pro Abend', () => {
  // A gewinnt 2:0 (1,0), verliert 0:2 (0,0), gewinnt 2:1 (0,667), gewinnt 2:1 (0,667).
  // Mittelwert pro Abend: (1,0 + 0,0 + 0,667 + 0,667) / 4 = 0,583
  // Summe über Legs: gewonnen 2+0+2+2 = 6, gespielt 2+2+3+3 = 10 -> 0,6
  const evenings = [
    { id: 'e1', date: '2026-10-01', status: 'gewertet', matches: [m('A', 'B', 2, 0)] },
    { id: 'e2', date: '2026-10-08', status: 'gewertet', matches: [m('A', 'B', 0, 2)] },
    { id: 'e3', date: '2026-10-15', status: 'gewertet', matches: [m('A', 'C', 2, 1)] },
    { id: 'e4', date: '2026-10-22', status: 'gewertet', matches: [m('A', 'C', 2, 1)] },
  ];
  const res = computeStandings({ evenings, optin: new Set(['A']), today: TODAY });
  const a = res.ranking.find((r) => r.player === 'A');
  assert.equal(a.legsPlayed, 10);
  assert.equal(a.legquote, 0.6);
  assert.notEqual(a.legquote, 0.583); // Mittelwert pro Abend wäre falsch
});

test('Mindestens 4 gewertete Abende, sonst kein Rang', () => {
  const evenings = [
    { id: 'e1', date: '2026-10-01', status: 'gewertet', matches: [m('A', 'B', 2, 0)] },
    { id: 'e2', date: '2026-10-08', status: 'gewertet', matches: [m('A', 'B', 2, 0)] },
    { id: 'e3', date: '2026-10-15', status: 'gewertet', matches: [m('A', 'B', 2, 0)] },
  ];
  const res = computeStandings({ evenings, optin: new Set(['A', 'B']), today: TODAY });
  assert.equal(res.ranking.length, 0);
  assert.equal(res.unranked.length, 2);
});

test('Nur Opt-in-Spieler erscheinen, freundschaftliche Abende zählen nicht', () => {
  const evenings = [
    { id: 'e1', date: '2026-10-01', status: 'gewertet', matches: [m('A', 'X', 2, 0)] },
    { id: 'e2', date: '2026-10-08', status: 'freundschaftlich', matches: [m('A', 'X', 2, 0)] },
  ];
  const res = computeStandings({ evenings, optin: new Set(['A']), today: TODAY, minEvenings: 1 });
  assert.equal(res.ranking.length, 1);
  assert.equal(res.ranking[0].evenings, 1);
  assert.equal(res.ranking.find((r) => r.player === 'X'), undefined);
});

test('Zeitraum: Abende älter als 12 Monate fallen heraus', () => {
  const evenings = [
    { id: 'alt', date: '2025-10-22', status: 'gewertet', matches: [m('A', 'B', 0, 2)] },
    { id: 'grenze', date: '2025-10-23', status: 'gewertet', matches: [m('A', 'B', 0, 2)] },
    { id: 'neu', date: '2025-10-24', status: 'gewertet', matches: [m('A', 'B', 2, 0)] },
  ];
  const res = computeStandings({ evenings, optin: new Set(['A']), today: TODAY, minEvenings: 1 });
  // Fenster ist (2025-10-23, 2026-10-23]: nur 'neu' zählt
  assert.equal(res.window.from, '2025-10-23');
  assert.equal(res.ranking[0].legquote, 1);
  assert.equal(res.ranking[0].evenings, 1);
});

test('Gleichstand: gleiche Legquote und Legs -> gleicher Rang, nächster Rang übersprungen', () => {
  const evenings = [
    { id: 'e1', date: '2026-10-01', status: 'gewertet', matches: [m('A', 'X', 2, 0), m('B', 'X', 2, 0)] },
    { id: 'e2', date: '2026-10-08', status: 'gewertet', matches: [m('A', 'Y', 2, 1), m('B', 'Y', 2, 1)] },
    { id: 'e3', date: '2026-10-15', status: 'gewertet', matches: [m('A', 'Z', 2, 0), m('B', 'Z', 2, 0)] },
    { id: 'e4', date: '2026-10-22', status: 'gewertet', matches: [m('A', 'W', 2, 0), m('B', 'W', 2, 0)] },
  ];
  const res = computeStandings({ evenings, optin: new Set(['A', 'B']), today: TODAY });
  const ranks = res.ranking.map((r) => r.rank);
  assert.deepEqual(ranks, [1, 1]);
});

test('Ungültiges Ergebnis wirft einen Fehler', () => {
  const evenings = [
    { id: 'e1', date: '2026-10-01', status: 'gewertet', matches: [m('A', 'B', 2, 2)] },
  ];
  assert.throws(() => computeStandings({ evenings, optin: new Set(['A']), today: TODAY }), /Ungültiges/);
});
