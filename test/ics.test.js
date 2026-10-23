import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, localToUtc, escape } from '../src/ics.js';

const NOW = new Date('2026-10-23T10:00:00Z');

test('Winterzeit: 19:30 Berlin am 5. November = 18:30 UTC', () => {
  const d = localToUtc('2026-11-05', '19:30', 'Europe/Berlin');
  assert.equal(d.toISOString(), '2026-11-05T18:30:00.000Z');
});

test('Sommerzeit: 19:30 Berlin am 5. Juli = 17:30 UTC', () => {
  const d = localToUtc('2026-07-05', '19:30', 'Europe/Berlin');
  assert.equal(d.toISOString(), '2026-07-05T17:30:00.000Z');
});

test('ICS enthält korrekte DTSTART/DTEND in UTC und CRLF', () => {
  const ics = buildIcs({
    uid: 'abend-2026-11-05@spielabend-app',
    localDate: '2026-11-05',
    localTime: '19:30',
    durationMinutes: 120,
    summary: 'Spielabend, Siedlerkeller',
    location: 'Siedlerkeller, Adolf-Damaschke-Str. 9',
    description: 'Bitte pünktlich; Boards: 3',
    now: NOW,
  });
  assert.match(ics, /DTSTART:20261105T183000Z\r\n/);
  assert.match(ics, /DTEND:20261105T203000Z\r\n/);
  assert.match(ics, /DTSTAMP:20261023T100000Z\r\n/);
  assert.match(ics, /SUMMARY:Spielabend\\, Siedlerkeller\r\n/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('Zeilen sind höchstens 75 Oktette lang (Folding)', () => {
  const ics = buildIcs({
    uid: 'x',
    localDate: '2026-11-05',
    localTime: '19:30',
    summary: 'Spielabend',
    description: 'Ä'.repeat(120) + ' und mehr Text '.repeat(10),
    now: NOW,
  });
  const lines = ics.split('\r\n').filter(Boolean);
  for (const line of lines) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `zu lang: ${line}`);
  }
  // Umbrochene Fortsetzungszeilen beginnen mit Leerzeichen
  assert.ok(lines.some((l) => l.startsWith(' ')));
});

test('escape: Komma, Semikolon, Backslash, Zeilenumbruch', () => {
  assert.equal(escape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
});
