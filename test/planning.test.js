import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMonthlyCoverage, monthsFrom } from '../src/planning.js';

const TODAY = '2026-10-23';

test('monthsFrom: zwölf Monate ab Oktober 2026 über den Jahreswechsel', () => {
  const months = monthsFrom('2026-10', 12);
  assert.equal(months[0], '2026-10');
  assert.equal(months[2], '2026-12');
  assert.equal(months[3], '2027-01');
  assert.equal(months[11], '2027-09');
});

test('alle Monate abgedeckt -> ok', () => {
  const evenings = monthsFrom('2026-10', 12).map((ym, i) => ({
    id: `e${i}`,
    date: `${ym}-05`,
    status: 'geplant',
  }));
  const res = checkMonthlyCoverage({ evenings, today: TODAY });
  assert.equal(res.ok, true);
  assert.deepEqual(res.gaps, []);
  assert.deepEqual(res.window, { from: '2026-10', to: '2027-09' });
});

test('fehlender Monat wird gemeldet', () => {
  const evenings = monthsFrom('2026-10', 12)
    .filter((ym) => ym !== '2027-02')
    .map((ym, i) => ({ id: `e${i}`, date: `${ym}-12`, status: 'geplant' }));
  const res = checkMonthlyCoverage({ evenings, today: TODAY });
  assert.equal(res.ok, false);
  assert.deepEqual(res.gaps, ['2027-02']);
});

test('Entwürfe und abgesagte Abende zählen nicht als Abdeckung', () => {
  const evenings = [{ id: 'x', date: '2026-11-05', status: 'entwurf' }];
  const res = checkMonthlyCoverage({ evenings, today: TODAY, months: 2 });
  assert.deepEqual(res.gaps, ['2026-10', '2026-11']);
});

test('Abend am Monatsanfang und -ende zählt für den Monat', () => {
  const evenings = [
    { id: 'a', date: '2026-10-31', status: 'gewertet' },
    { id: 'b', date: '2026-11-01', status: 'freundschaftlich' },
  ];
  const res = checkMonthlyCoverage({ evenings, today: TODAY, months: 2 });
  assert.equal(res.ok, true);
});

test('Abende außerhalb des Zeitraums werden ignoriert', () => {
  const evenings = [{ id: 'alt', date: '2025-10-05', status: 'gewertet' }];
  const res = checkMonthlyCoverage({ evenings, today: TODAY, months: 1 });
  assert.deepEqual(res.gaps, ['2026-10']);
});
