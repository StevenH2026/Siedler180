import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abendRangliste, gruppenTabellen, offeneVorrunde, rundenStand, finaleUebersicht } from '../src/abend.js';

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

const sl = (group_name, slot, a, b, legs_a, legs_b, bestaetigt = true) => ({ ...sp(group_name, a, b, legs_a, legs_b, bestaetigt), slot });

test('offeneVorrunde: nur unbestätigte Vorrundenspiele, nach Slot', () => {
  const spiele = [
    sl('Gruppe B', 2, 'P3', 'P4', null, null, false),
    sl('Gruppe A', 1, 'P1', 'P2', 2, 0),
    sl('Gruppe A', 1, 'P5', 'P6', 2, 1, false),
    sl('Finale Rang 1', 1, 'P1', 'P3', null, null, false),
  ];
  assert.deepEqual(offeneVorrunde(spiele).map((s) => s.spieler_a), ['P5', 'P3']);
});

test('rundenStand: jetzt ist die erste Runde mit offenem Spiel, Finale nach der Vorrunde', () => {
  const spiele = [
    sl('Gruppe A', 1, 'P1', 'P2', 2, 0),
    sl('Gruppe A', 2, 'P1', 'P3', 2, 1, false),
    sl('Gruppe A', 3, 'P2', 'P3', null, null, false),
  ];
  const r = rundenStand(spiele);
  assert.equal(r.jetzt.slot, 2);
  assert.equal(r.naechste.slot, 3);
  assert.equal(r.alleBestaetigt, false);

  const mitFinale = [
    sl('Gruppe A', 1, 'P1', 'P2', 2, 0),
    sl('Finale Rang 1', 1, 'P1', 'P3', null, null, false),
  ];
  const f = rundenStand(mitFinale);
  assert.equal(f.jetzt.finale, true);
  assert.equal(f.naechste, null);
  assert.equal(f.finaleAusgelost, true);
});

test('rundenStand: alles bestätigt', () => {
  const r = rundenStand([sl('Gruppe A', 1, 'P1', 'P2', 2, 0)]);
  assert.equal(r.jetzt, null);
  assert.equal(r.alleBestaetigt, true);
});

test('finaleUebersicht: Finalgruppen nach Rang mit Plätzen', () => {
  const spiele = [
    sl('Gruppe A', 1, 'A1', 'A2', 2, 0),
    sl('Gruppe A', 2, 'A1', 'A3', 2, 1),
    sl('Gruppe A', 3, 'A2', 'A3', 2, 1),
    sl('Gruppe B', 1, 'B1', 'B2', 2, 0),
  ];
  const u = finaleUebersicht(spiele);
  assert.equal(u.vorrundeFertig, true);
  assert.deepEqual(u.finalgruppen.map((g) => [g.name, g.spieler, g.plaetze]), [
    ['Finale Rang 1', ['A1', 'B1'], 'Plätze 1–2'],
    ['Finale Rang 2', ['A2', 'B2'], 'Plätze 3–4'],
    ['Finale Rang 3', ['A3'], 'Platz 5'],
  ]);
  assert.equal(u.finalgruppen[0].tabelle, null);
});

test('finaleUebersicht: nach der Finalauslosung zählen die Finalspiele', () => {
  const spiele = [
    sl('Gruppe A', 1, 'A1', 'A2', 2, 0),
    sl('Gruppe B', 1, 'B1', 'B2', 2, 0),
    sl('Finale Rang 1', 1, 'B1', 'A1', 2, 1),
  ];
  const u = finaleUebersicht(spiele);
  assert.equal(u.finaleAusgelost, true);
  assert.deepEqual(u.finalgruppen[0].tabelle.map((z) => z.id), ['B1', 'A1']);
});

test('finaleUebersicht: eine Gruppe oder noch keine Ergebnisse, keine Finalgruppen', () => {
  assert.equal(finaleUebersicht([sl('Gruppe A', 1, 'P1', 'P2', 2, 0)]).finalgruppen.length, 0);
  const ohne = [sl('Gruppe A', 1, 'A1', 'A2', null, null, false), sl('Gruppe B', 1, 'B1', 'B2', 2, 0)];
  assert.equal(finaleUebersicht(ohne).finalgruppen.length, 0);
});
