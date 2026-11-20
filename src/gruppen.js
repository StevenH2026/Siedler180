// Tabelle und Rangfolge innerhalb einer Gruppe, plus Aufteilung für das Finale.
// Reine Funktionen. Eingabe: nur bestätigte Ergebnisse.
//
// Kriterien (in dieser Reihenfolge):
//   1. gewonnene Legs (mehr ist besser)
//   2. verlorene Legs (weniger ist besser)
//   3. direkter Vergleich: dieselben Kriterien nur für die Spiele zwischen den punktgleichen Spielern
// Bleibt danach ein Gleichstand, teilen sich die Spieler den Rang (1, 1, 3, ...).

/**
 * @param {Array<string|number>} ids  Spieler der Gruppe
 * @param {Array<{a, b, legsA, legsB}>} matches  bestätigte Ergebnisse
 * @returns {Array<{id, rang, legsGewonnen, legsVerloren, spiele}>} sortiert nach Rang
 */
export function gruppenTabelle(ids, matches, bull = null) {
  const gesamt = zaehle(ids, matches);
  const raenge = rangfolge(ids, matches, bull);
  return ids
    .map((id) => ({ id, rang: raenge.get(id), ...gesamt.get(id) }))
    .sort((x, y) => x.rang - y.rang || y.legsGewonnen - x.legsGewonnen);
}

/**
 * Aufteilung fürs Finale: je Rang eine Liste der Spieler aus allen Gruppen.
 * @param {Array<Array<{id, rang}>>} tabellen  eine Tabelle je Gruppe
 * @returns {Array<Array<id>>} Index 0 = Rang 1, Lücken bei Gleichstand bleiben leer
 */
export function finaleRangGruppen(tabellen) {
  const hoechsterRang = Math.max(0, ...tabellen.flat().map((t) => t.rang));
  const nachRang = Array.from({ length: hoechsterRang }, () => []);
  for (const tabelle of tabellen) {
    for (const eintrag of tabelle) nachRang[eintrag.rang - 1].push(eintrag.id);
  }
  return nachRang;
}

// Zählt Legs je Spieler; berücksichtigt nur Spiele, bei denen beide Spieler in `scope` sind.
function zaehle(scope, matches) {
  const erlaubt = new Set(scope);
  const werte = new Map(scope.map((id) => [id, { legsGewonnen: 0, legsVerloren: 0, spiele: 0 }]));
  for (const m of matches) {
    if (!erlaubt.has(m.a) || !erlaubt.has(m.b)) continue;
    const a = werte.get(m.a);
    const b = werte.get(m.b);
    a.legsGewonnen += m.legsA;
    a.legsVerloren += m.legsB;
    a.spiele += 1;
    b.legsGewonnen += m.legsB;
    b.legsVerloren += m.legsA;
    b.spiele += 1;
  }
  return werte;
}

// Ränge (1-basiert) für alle `ids`, mit Direktvergleich bei Gleichstand.
// bull (optional): Map Spieler -> Ausbullen-Rang. Entscheidet einen Restgleichstand, wenn alle
// Gleichstehenden einen Wert haben (Entscheidung 20.11.2026).
function rangfolge(ids, matches, bull = null) {
  const werte = zaehle(ids, matches);
  const sortiert = [...ids].sort((x, y) => {
    const wx = werte.get(x);
    const wy = werte.get(y);
    return wy.legsGewonnen - wx.legsGewonnen || wx.legsVerloren - wy.legsVerloren;
  });

  const raenge = new Map();
  let i = 0;
  while (i < sortiert.length) {
    const wi = werte.get(sortiert[i]);
    let j = i;
    while (
      j + 1 < sortiert.length &&
      werte.get(sortiert[j + 1]).legsGewonnen === wi.legsGewonnen &&
      werte.get(sortiert[j + 1]).legsVerloren === wi.legsVerloren
    ) {
      j += 1;
    }
    const gleich = sortiert.slice(i, j + 1);
    if (gleich.length === 1) {
      raenge.set(gleich[0], i + 1);
    } else if (gleich.length < ids.length) {
      // Direktvergleich nur unter den Gleichstehenden. Schrumpft die Menge, ist die Rekursion endlich.
      const unter = rangfolge(gleich, matches, bull);
      for (const id of gleich) raenge.set(id, i + unter.get(id));
    } else if (bull && gleich.every((id) => bull.has(id))) {
      // Ausgebullt: Reihenfolge des Ausbullens.
      [...gleich].sort((x, y) => bull.get(x) - bull.get(y)).forEach((id, k) => raenge.set(id, i + 1 + k));
    } else {
      // Gleichstand bleibt bestehen: alle teilen sich den Rang.
      for (const id of gleich) raenge.set(id, i + 1);
    }
    i = j + 1;
  }
  return raenge;
}

/**
 * Restgleichstände einer Tabelle: Spieler, die sich einen Rang teilen.
 * @param {Array<{id, rang}>} tabelle
 * @returns {Array<Array<id>>}
 */
export function restGleichstaende(tabelle) {
  const nachRang = new Map();
  for (const e of tabelle) {
    if (!nachRang.has(e.rang)) nachRang.set(e.rang, []);
    nachRang.get(e.rang).push(e.id);
  }
  return [...nachRang.values()].filter((ids) => ids.length > 1);
}
