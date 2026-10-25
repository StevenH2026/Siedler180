// Auswertung eines Spielabends: Gruppentabellen der Vorrunde und Rangliste über den ganzen Abend.
// Reine Funktionen. Eingabe: Spiele eines Abends (Felder wie in der Tabelle matches).
import { gruppenTabelle } from './gruppen.js';

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
