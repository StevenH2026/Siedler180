// Auswertung eines Spielabends: Gruppentabellen der Vorrunde und Rangliste über den ganzen Abend.
// Reine Funktionen. Eingabe: Spiele eines Abends (Felder wie in der Tabelle matches).
import { gruppenTabelle, finaleRangGruppen } from './gruppen.js';

export const istFinale = (gruppe) => gruppe.startsWith('Finale Rang');

// Nur bestätigte Ergebnisse zählen.
export function bestaetigteSpiele(spiele) {
  return spiele
    .filter((s) => s.bestaetigt_von && s.legs_a !== null)
    .map((s) => ({ a: s.spieler_a, b: s.spieler_b, legsA: s.legs_a, legsB: s.legs_b }));
}

// Gruppentabellen der Vorrunde (ohne Finale), in Gruppenreihenfolge.
export function gruppenTabellen(spiele) {
  const vorrunde = spiele.filter((s) => !istFinale(s.group_name));
  const gruppen = [...new Set(vorrunde.map((s) => s.group_name))].sort();
  return gruppen.map((gruppe) => {
    const gs = vorrunde.filter((s) => s.group_name === gruppe);
    const ids = [...new Set(gs.flatMap((s) => [s.spieler_a, s.spieler_b]))];
    const bestaetigt = bestaetigteSpiele(gs);
    return { gruppe, tabelle: gruppenTabelle(ids, bestaetigt), hatErgebnis: bestaetigt.length > 0 };
  });
}

// Rangliste über den ganzen Abend (Vorrunde und Finale): mehr gewonnene Legs, dann weniger verlorene.
// Gleiche Werte teilen sich den Rang.
export function abendRangliste(spiele) {
  const werte = new Map();
  const eintrag = (id) => {
    if (!werte.has(id)) werte.set(id, { won: 0, lost: 0, spiele: 0 });
    return werte.get(id);
  };
  for (const m of bestaetigteSpiele(spiele)) {
    const a = eintrag(m.a);
    const b = eintrag(m.b);
    a.won += m.legsA; a.lost += m.legsB; a.spiele += 1;
    b.won += m.legsB; b.lost += m.legsA; b.spiele += 1;
  }
  const sortiert = [...werte.entries()].sort(([, x], [, y]) => y.won - x.won || x.lost - y.lost);
  const zeilen = [];
  sortiert.forEach(([id, w], i) => {
    const vorher = i > 0 ? sortiert[i - 1][1] : null;
    const gleich = vorher && vorher.won === w.won && vorher.lost === w.lost;
    zeilen.push({
      rang: gleich ? zeilen[i - 1].rang : i + 1,
      id,
      legsGewonnen: w.won,
      legsVerloren: w.lost,
      spiele: w.spiele,
    });
  });
  return zeilen;
}

// Reihenfolge der Spielrunden: erst die Vorrunde, dann das Finale, jeweils nach Slot.
// Das Finale zählt seine Slots wieder ab 1, deshalb gehört die Phase in den Schlüssel.
const phase = (s) => (istFinale(s.group_name) ? 1 : 0);
const slotVon = (s) => s.slot ?? s.runde ?? 0;

// Vorrunden-Spiele ohne bestätigtes Ergebnis, nach Slot sortiert.
export function offeneVorrunde(spiele) {
  return spiele
    .filter((s) => !istFinale(s.group_name) && !s.bestaetigt_von)
    .sort((x, y) => slotVon(x) - slotVon(y) || x.group_name.localeCompare(y.group_name));
}

/**
 * Laufende und nächste Spielrunde für die Leinwand.
 * Laufend ist die erste Runde mit einem Spiel ohne bestätigtes Ergebnis.
 * @returns {{jetzt: Runde|null, naechste: Runde|null, alleBestaetigt: boolean, finaleAusgelost: boolean}}
 *   Runde = {finale: boolean, slot: number, spiele: Array}
 */
export function rundenStand(spiele) {
  const runden = new Map();
  for (const s of spiele) {
    const schluessel = `${phase(s)}-${String(slotVon(s)).padStart(4, '0')}`;
    if (!runden.has(schluessel)) runden.set(schluessel, { finale: phase(s) === 1, slot: slotVon(s), spiele: [] });
    runden.get(schluessel).spiele.push(s);
  }
  const reihe = [...runden.keys()].sort().map((k) => runden.get(k));
  for (const r of reihe) r.spiele.sort((x, y) => (x.board ?? 0) - (y.board ?? 0) || x.group_name.localeCompare(y.group_name));
  const i = reihe.findIndex((r) => r.spiele.some((s) => !s.bestaetigt_von));
  return {
    jetzt: i >= 0 ? reihe[i] : null,
    naechste: i >= 0 ? (reihe[i + 1] ?? null) : null,
    alleBestaetigt: spiele.length > 0 && i < 0,
    finaleAusgelost: spiele.some((s) => istFinale(s.group_name)),
  };
}

/**
 * Weg ins Finale: Vorrundentabellen und daraus die Finalgruppen nach Rang mit den Plätzen, um die es geht.
 * Ist das Finale ausgelost, kommen die Spieler der Finalgruppen aus den Finalspielen, dazu deren Tabelle.
 * Ohne mindestens zwei Vorrundengruppen gibt es kein Finale (finalgruppen leer).
 */
export function finaleUebersicht(spiele) {
  const gruppen = gruppenTabellen(spiele);
  const vorrunde = spiele.filter((s) => !istFinale(s.group_name));
  const vorrundeFertig = vorrunde.length > 0 && vorrunde.every((s) => s.bestaetigt_von);
  const finaleAusgelost = spiele.some((s) => istFinale(s.group_name));
  const finalgruppen = [];
  if (gruppen.length >= 2 && gruppen.every((g) => g.hatErgebnis)) {
    let platz = 1;
    finaleRangGruppen(gruppen.map((g) => g.tabelle)).forEach((ids, i) => {
      if (ids.length === 0) return;
      const name = `Finale Rang ${i + 1}`;
      const gs = spiele.filter((s) => s.group_name === name);
      const spieler = gs.length > 0 ? [...new Set(gs.flatMap((s) => [s.spieler_a, s.spieler_b]))] : ids;
      finalgruppen.push({
        name,
        spieler,
        start: platz,
        plaetze: spieler.length === 1 ? `Platz ${platz}` : `Plätze ${platz}–${platz + spieler.length - 1}`,
        tabelle: gs.length > 0 ? gruppenTabelle(spieler, bestaetigteSpiele(gs)) : null,
        hatErgebnis: bestaetigteSpiele(gs).length > 0,
      });
      platz += spieler.length;
    });
  }
  return { gruppen, finalgruppen, vorrundeFertig, finaleAusgelost, vorlaeufig: !vorrundeFertig };
}

// Alle Spiele mit bestätigtem Ergebnis in Spielreihenfolge (Vorrunde, dann Finale; Slot, Board).
export function ergebnisListe(spiele) {
  return spiele
    .filter((s) => s.bestaetigt_von && s.legs_a !== null)
    .sort((x, y) => phase(x) - phase(y) || slotVon(x) - slotVon(y)
      || (x.board ?? 0) - (y.board ?? 0) || x.group_name.localeCompare(y.group_name));
}

/**
 * Platzierung des Abends (Entscheidung 20.11.2026):
 *  - eine Vorrundengruppe: Tabellenplatz der Gruppe,
 *  - mehrere Gruppen mit ausgelostem Finale: Plätze aus den Finalgruppen (Finale Rang 1 = Plätze 1..k usw.,
 *    innerhalb der Finalgruppe nach deren Tabelle),
 *  - mehrere Gruppen ohne Finale (noch nicht ausgelost): vorläufig nach gewonnenen Legs.
 * Legs-Spalten zählen immer den ganzen Abend.
 * @returns {{zeilen: Array<{rang, id, legsGewonnen, legsVerloren, spiele}>, art: 'gruppe'|'finale'|'legs', endgueltig: boolean}}
 */
export function abendPlaetze(spiele) {
  const legs = new Map(abendRangliste(spiele).map((z) => [z.id, z]));
  const mitLegs = (id, rang) => ({
    rang,
    id,
    legsGewonnen: legs.get(id)?.legsGewonnen ?? 0,
    legsVerloren: legs.get(id)?.legsVerloren ?? 0,
    spiele: legs.get(id)?.spiele ?? 0,
  });
  const sortiere = (zeilen) => zeilen.sort((x, y) => x.rang - y.rang || y.legsGewonnen - x.legsGewonnen);
  const alleBestaetigt = spiele.length > 0 && spiele.every((s) => s.bestaetigt_von);
  const gruppen = gruppenTabellen(spiele);

  if (gruppen.length === 1) {
    const g = gruppen[0];
    if (!g.hatErgebnis) return { zeilen: [], art: 'gruppe', endgueltig: false };
    return { zeilen: sortiere(g.tabelle.map((e) => mitLegs(e.id, e.rang))), art: 'gruppe', endgueltig: alleBestaetigt };
  }

  const u = finaleUebersicht(spiele);
  if (u.finaleAusgelost && u.finalgruppen.length > 0) {
    const zeilen = [];
    for (const f of u.finalgruppen) {
      if (f.tabelle && f.hatErgebnis) {
        for (const e of f.tabelle) zeilen.push(mitLegs(e.id, f.start + e.rang - 1));
      } else {
        // Allein in der Finalgruppe, oder noch kein Finalergebnis: alle auf dem ersten Platz der Gruppe.
        for (const id of f.spieler) zeilen.push(mitLegs(id, f.start));
      }
    }
    return { zeilen: sortiere(zeilen), art: 'finale', endgueltig: alleBestaetigt };
  }

  return { zeilen: abendRangliste(spiele), art: 'legs', endgueltig: false };
}
