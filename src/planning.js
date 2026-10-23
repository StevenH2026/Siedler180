// Planungsprüfung: Hat jeder Kalendermonat im Planungszeitraum mindestens einen Spielabend?
// Annahme: Der Zeitraum beginnt mit dem aktuellen Monat und umfasst `months` Monate (Standard 12).
// Zählt werden Abende mit einem der Status in `countedStatuses`. Entwürfe zählen nicht.

export const DEFAULT_COUNTED_STATUSES = ['geplant', 'gewertet', 'freundschaftlich'];

/**
 * @param {object} opts
 * @param {Array<{id:string,date:string,status:string}>} opts.evenings  date als YYYY-MM-DD
 * @param {string} opts.today                                          YYYY-MM-DD
 * @param {number} [opts.months=12]
 * @param {string[]} [opts.countedStatuses]
 */
export function checkMonthlyCoverage({
  evenings,
  today,
  months = 12,
  countedStatuses = DEFAULT_COUNTED_STATUSES,
}) {
  const window = monthsFrom(today.slice(0, 7), months);
  const covered = new Set(
    evenings
      .filter((e) => countedStatuses.includes(e.status))
      .map((e) => e.date.slice(0, 7)),
  );
  const gaps = window.filter((ym) => !covered.has(ym));
  return {
    window: { from: window[0], to: window[window.length - 1] },
    gaps,
    ok: gaps.length === 0,
  };
}

/** Liefert `count` aufeinanderfolgende Monate ab `ym` (YYYY-MM) als YYYY-MM. */
export function monthsFrom(ym, count) {
  const [y, m] = ym.split('-').map(Number);
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}
