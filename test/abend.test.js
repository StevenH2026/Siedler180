import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abendRangliste, gruppenTabellen } from '../src/abend.js';

const sp = (group_name, a, b, legs_a, legs_b, bestaetigt = true) => ({
  group_name, spieler_a: a, spieler_b: b, legs_a, legs_b, bestaetigt_von: bestaetigt ? 'x' : null,
});

test('Abend-Rangliste: mehr gewonnene Legs vorne, dann weniger verlorene, Gleichstand teilt den Rang', () => {
  const spiele = [
    sp('Gruppe A', 'P1', 'P2', 2, 0),
    sp('Gruppe A', 'P1', 'P3', 2, 1),
    sp('Gruppe A', 'P2', 'P3', 1, 2),
  ];
  const r = abendRangliste(spiele);
  assert.deepEqual(r.map((z) => z.id), ['P1', 'P3', 'P2']);
  assert.deepEqual(r.map((z) => z.rang), [1, 2, 3]);
});

test('Abend-Rangliste zählt Vorrunde und Finale zusammen', () => {
  const spiele = [
    sp('Gruppe A', 'P1', 'P2', 2, 0),
    sp('Finale Rang 1', 'P1', 'P3', 0, 2),
  ];
  const r = abendRangliste(spiele);
  const p1 = r.find((z) => z.id === 'P1');
  assert.equal(p1.legsGewonnen, 2);
  assert.equal(p1.legsVerloren, 2);
  assert.equal(p1.spiele, 2);
});

test('Abend-Rangliste: unbestätigte Spiele zählen nicht', () => {
  const r = abendRangliste([sp('Gruppe A', 'P1', 'P2', 2, 0, false)]);
  assert.equal(r.length, 0);
});

test('Gleiche gewonnene und verlorene Legs: gleicher Rang', () => {
  const spiele = [sp('Gruppe A', 'P1', 'P2', 2, 1), sp('Gruppe B', 'P3', 'P4', 2, 1)];
  const r = abendRangliste(spiele);
  const rang = Object.fromEntries(r.map((z) => [z.id, z.rang]));
  assert.equal(rang.P1, 1);
  assert.equal(rang.P3, 1, 'gleiche Legs wie P1: gleicher Rang');
  assert.equal(rang.P2, 3);
  assert.equal(rang.P4, 3);
});

test('gruppenTabellen lässt das Finale weg', () => {
  const spiele = [
    sp('Gruppe A', 'P1', 'P2', 2, 0),
    sp('Gruppe B', 'P3', 'P4', 2, 0),
    sp('Finale Rang 1', 'P1', 'P3', 2, 0),
  ];
  const gruppen = gruppenTabellen(spiele);
  assert.deepEqual(gruppen.map((g) => g.gruppe), ['Gruppe A', 'Gruppe B']);
});
