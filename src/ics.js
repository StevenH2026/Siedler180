// ICS-Kalenderdatei (RFC 5545) für einen Spielabend.
// Zeiten werden in UTC geschrieben, damit kein VTIMEZONE-Block nötig ist.

/**
 * @param {object} opts
 * @param {string} opts.uid              eindeutige Kennung des Termins
 * @param {string} opts.localDate        YYYY-MM-DD in der Zeitzone tz
 * @param {string} opts.localTime        HH:MM in der Zeitzone tz
 * @param {number} [opts.durationMinutes=120]
 * @param {string} opts.summary
 * @param {string} [opts.location='']
 * @param {string} [opts.description='']
 * @param {string} [opts.tz='Europe/Berlin']
 * @param {Date}   [opts.now=new Date()] für DTSTAMP
 */
export function buildIcs({
  uid,
  localDate,
  localTime,
  durationMinutes = 120,
  summary,
  location = '',
  description = '',
  tz = 'Europe/Berlin',
  now = new Date(),
}) {
  return buildIcsKalender([{ uid, localDate, localTime, durationMinutes, summary, location, description, tz }], { now });
}

/**
 * Mehrere Termine in einer Kalenderdatei.
 * @param {Array<object>} termine  Felder wie bei buildIcs (ohne now)
 * @param {object} [opts]
 * @param {Date} [opts.now=new Date()]
 */
export function buildIcsKalender(termine, { now = new Date() } = {}) {
  const vevents = termine.flatMap((t) => veventZeilen(t, now));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Spielabend-App//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ];
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}

function veventZeilen({
  uid,
  localDate,
  localTime,
  durationMinutes = 120,
  summary,
  location = '',
  description = '',
  tz = 'Europe/Berlin',
}, now) {
  const start = localToUtc(localDate, localTime, tz);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return [
    'BEGIN:VEVENT',
    `UID:${escape(uid)}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escape(summary)}`,
    `LOCATION:${escape(location)}`,
    `DESCRIPTION:${escape(description)}`,
    'END:VEVENT',
  ];
}


export function escape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Zeilen dürfen höchstens 75 Oktette lang sein; Fortsetzung beginnt mit einem Leerzeichen.
function foldLine(line) {
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 75) {
      out.push(cur);
      cur = ' ' + ch;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function formatUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Offset (ms) der Zeitzone tz zum Zeitpunkt ms.
function tzOffset(ms, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

export function localToUtc(localDate, localTime, tz) {
  const [y, m, d] = localDate.split('-').map(Number);
  const [h, min] = localTime.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  // Zweimal iterieren, damit ein DST-Übergang zwischen Schätzung und Ergebnis korrekt landet.
  let utc = guess - tzOffset(guess, tz);
  utc = guess - tzOffset(utc, tz);
  return new Date(utc);
}
