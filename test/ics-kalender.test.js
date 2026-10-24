import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcsKalender } from '../src/ics.js';

test('Kalenderdatei mit mehreren Terminen: je ein VEVENT, eine VCALENDAR-Hülle', () => {
  const ics = buildIcsKalender([
    { uid: 'a@x', localDate: '2026-11-03', localTime: '19:30', summary: 'Spielabend', location: 'Siedlerkeller' },
    { uid: 'b@x', localDate: '2026-11-10', localTime: '19:30', summary: 'Spielabend', location: 'Siedlerkeller' },
  ], { now: new Date('2026-10-24T10:00:00Z') });
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.equal(ics.match(/BEGIN:VCALENDAR/g).length, 1);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(ics.includes('DTSTART:20261103T183000Z'));
});
