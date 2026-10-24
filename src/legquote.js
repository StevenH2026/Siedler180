// Rangliste nach Legquote.
// Regeln (Stand 2026-10-23):
//  - Legquote = gewonnene Legs / gespielte Legs, summiert über den Zeitraum (nicht Mittelwert pro Abend).
//  - Nur Abende mit Status "gewertet" zählen.
//  - Zeitraum: rollierend 12 Monate. Fenster ist (heute - 12 Monate, heute], Datum als YYYY-MM-DD.
//  - Mindestens 4 gewertete Abende, an denen der Spieler mindestens ein Match hatte.
//  - Nur Spieler mit Rangliste-Opt-in erscheinen.
//  - Sortierung (Stand 2026-10-24): 1. Summe gewonnene Legs (mehr ist besser),
//    2. Summe verlorene Legs (weniger ist besser). Die Legquote ist Anzeige, keine Sortierung:
//    bei gleichen gewonnenen und verlorenen Legs ist sie automatisch gleich.
//  - Gleichstand: gleiche gewonnene UND verlorene Legs -> gleicher Rang.

export const VALID_RESULTS = ['2:0', '2:1', '1:2', '0:2'];
export const DEFAULT_WINDOW_MONTHS = 12;
export const DEFAULT_MIN_EVENINGS = 4;

export function isValidResult(legsA, legsB) {
  return VALID_RESULTS.includes(`${legsA}:${legsB}`);
}

/**
 * @param {object} opts
 * @param {Array<{id:string,date:string,status:'gewertet'|'freundschaftlich',
 *   matches:Array<{a:string,b:string,legsA:number,legsB:number}>}>} opts.evenings
 * @param {Set<string>} opts.optin      Spieler-Ids mit Rangliste-Opt-in
 * @param {string} opts.today           YYYY-MM-DD
 */
export function computeStandings({
  evenings,
  optin,
  today,
  windowMonths = DEFAULT_WINDOW_MONTHS,
  minEvenings = DEFAULT_MIN_EVENINGS,
}) {
  const windowStart = addMonths(today, -windowMonths);
  const stats = new Map();
  const entry = (id) => {
    if (!stats.has(id)) stats.set(id, { won: 0, played: 0, evenings: new Set() });
    return stats.get(id);
  };

  for (const ev of evenings) {
    if (ev.status !== 'gewertet') continue;
    if (!(ev.date > windowStart && ev.date <= today)) continue;
    for (const m of ev.matches) {
      if (!isValidResult(m.legsA, m.legsB)) {
        throw new Error(`Ungültiges Ergebnis in Abend ${ev.id}: ${m.legsA}:${m.legsB}`);
      }
      const legsPlayed = m.legsA + m.legsB;
      for (const [pid, legsWon] of [
        [m.a, m.legsA],
        [m.b, m.legsB],
      ]) {
        const s = entry(pid);
        s.won += legsWon;
        s.played += legsPlayed;
        s.evenings.add(ev.id);
      }
    }
  }

  const ranked = [];
  const unranked = [];
  for (const pid of optin) {
    const s = stats.get(pid) ?? { won: 0, played: 0, evenings: new Set() };
    const row = {
      player: pid,
      legsWon: s.won,
      legsLost: s.played - s.won,
      legquote: s.played > 0 ? s.won / s.played : null,
      legsPlayed: s.played,
      evenings: s.evenings.size,
    };
    if (row.evenings >= minEvenings) ranked.push(row);
    else unranked.push(row);
  }

  ranked.sort((x, y) => y.legsWon - x.legsWon || x.legsLost - y.legsLost);
  let rank = 0;
  let prev = null;
  const ranking = ranked.map((row, i) => {
    const same = prev && prev.legsWon === row.legsWon && prev.legsLost === row.legsLost;
    if (!same) rank = i + 1;
    prev = row;
    return { rank, ...row };
  });

  return { window: { from: windowStart, to: today }, ranking, unranked };
}

/** Addiert Monate auf ein YYYY-MM-DD-Datum, Tag wird bei Bedarf auf das Monatsende gekappt. */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}
