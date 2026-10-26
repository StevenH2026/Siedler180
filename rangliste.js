import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { computeStandings } from './src/legquote.js';
import { abendRangliste } from './src/abend.js?v=1';
import { APP_VERSION } from './src/version.js?v=2';

// Gleiche Sitzung wie in der App: das Fenster teilt den Speicher mit dem Hauptfenster.
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (id) => document.getElementById(id);

// Schließt das Fenster, wenn die App es geöffnet hat. Sonst zurück zur App in diesem Fenster.
$('zurueck').addEventListener('click', () => {
  if (window.opener) window.close();
  else window.location.href = 'index.html';
});

function bestaetigt(spiele) {
  return spiele.filter((s) => s.bestaetigt_von && s.legs_a !== null)
    .map((s) => ({ a: s.spieler_a, b: s.spieler_b, legsA: s.legs_a, legsB: s.legs_b }));
}

function tabelle(kopf, zeilen) {
  const wrap = document.createElement('div');
  wrap.className = 'tabelle-wrap';
  const t = document.createElement('table');
  const k = t.createTHead().insertRow();
  for (const text of kopf) {
    const th = document.createElement('th');
    th.textContent = text;
    k.append(th);
  }
  const body = t.createTBody();
  for (const zeile of zeilen) {
    const tr = body.insertRow();
    for (const wert of zeile) tr.insertCell().textContent = wert;
  }
  wrap.append(t);
  return wrap;
}

function legquoteText(q) {
  return q === null ? '–' : `${(q * 100).toFixed(1).replace('.', ',')} %`;
}

function zeitText(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function laden() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    $('status').textContent = 'Bitte zuerst in der App anmelden und dieses Fenster dann neu öffnen.';
    return;
  }

  const [evenResult, matchResult, profilResult] = await Promise.all([
    supabase.from('evenings').select('id, datum, beginn_at, ort, status').order('beginn_at'),
    supabase.from('matches').select('id, evening_id, group_name, runde, spieler_a, spieler_b, legs_a, legs_b, bestaetigt_von'),
    supabase.from('profiles').select('id, anzeigename'),
  ]);
  for (const r of [evenResult, matchResult, profilResult]) {
    if (r.error) {
      $('status').textContent = `Laden fehlgeschlagen: ${r.error.message}`;
      return;
    }
  }
  const evenings = evenResult.data;
  const matches = matchResult.data;
  const namen = new Map(profilResult.data.map((p) => [p.id, p.anzeigename ?? 'Unbekannt']));
  const mitAlias = new Set(profilResult.data.filter((p) => p.anzeigename).map((p) => p.id));

  $('status').textContent = '';
  zeichneAbendRangliste(evenings, matches, namen);
  zeichneGesamt(evenings, matches, mitAlias, namen);
  $('version').textContent = APP_VERSION;
}

// Gesamtrangliste: gewertete Abende im rollierenden 12-Monats-Fenster.
function zeichneGesamt(evenings, matches, mitAlias, namen) {
  const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const gewertet = evenings
    .filter((e) => e.status === 'gewertet')
    .map((e) => ({
      id: e.id,
      date: e.datum,
      status: 'gewertet',
      matches: bestaetigt(matches.filter((m) => m.evening_id === e.id)),
    }));

  let ergebnis;
  try {
    ergebnis = computeStandings({ evenings: gewertet, optin: mitAlias, today: heute });
  } catch (e) {
    $('gesamt-hinweis').textContent = `Berechnung nicht möglich: ${e.message}`;
    return;
  }

  $('gesamt-bereich').hidden = false;
  $('gesamt-hinweis').textContent =
    `Zeitraum ${ergebnis.window.from} bis ${ergebnis.window.to}. Sortiert nach gewonnenen Legs, dann verlorenen Legs. Ab 4 gewerteten Abenden.`;

  const zeilen = ergebnis.ranking.map((r) => [
    String(r.rank), namen.get(r.player) ?? 'Unbekannt', String(r.legsWon), String(r.legsLost),
    legquoteText(r.legquote), String(r.evenings),
  ]);
  $('gesamt-liste').replaceChildren(
    zeilen.length > 0
      ? tabelle(['Rang', 'Spieler', 'Legs gew.', 'Legs verl.', 'Legquote', 'Abende'], zeilen)
      : Object.assign(document.createElement('p'), { className: 'hinweis', textContent: 'Noch niemand mit 4 gewerteten Abenden.' }),
  );

  const unranked = ergebnis.unranked.filter((r) => r.evenings > 0);
  $('unranked-titel').hidden = unranked.length === 0;
  $('unranked-liste').replaceChildren(
    unranked.length > 0
      ? tabelle(['Spieler', 'Abende'], unranked.map((r) => [namen.get(r.player) ?? 'Unbekannt', String(r.evenings)]))
      : document.createTextNode(''),
  );
}

// Rangliste des Abends: Finalplätze, sonst die Vorrunde.
function zeichneAbendRangliste(evenings, matches, namen) {
  const mitSpielen = evenings
    .filter((e) => matches.some((m) => m.evening_id === e.id))
    .sort((a, b) => b.beginn_at.localeCompare(a.beginn_at));
  if (mitSpielen.length === 0) {
    $('abend-bereich').hidden = true;
    return;
  }
  $('abend-bereich').hidden = false;

  const wahl = $('abend-wahl');
  wahl.replaceChildren(...mitSpielen.map((e) => {
    const option = document.createElement('option');
    option.value = e.id;
    option.textContent = `${zeitText(e.beginn_at)} · ${e.ort ?? 'Siedlerkeller'}`;
    return option;
  }));
  wahl.value = mitSpielen[0].id;
  wahl.onchange = () => zeigeAbend(wahl.value, matches, namen);
  zeigeAbend(wahl.value, matches, namen);
}

// Rangliste des Abends: alle Spieler nach gewonnenen Legs am ganzen Abend (Vorrunde und Finale).
function zeigeAbend(abendId, matches, namen) {
  const spiele = matches.filter((m) => m.evening_id === abendId);
  const offen = spiele.filter((m) => !m.bestaetigt_von).length;
  const hinweis = $('abend-hinweis');
  if (abendRangliste(spiele).length === 0) {
    hinweis.textContent = 'Für diesen Abend gibt es noch keine bestätigten Ergebnisse.';
    $('abend-liste').replaceChildren();
    return;
  }
  hinweis.textContent = offen > 0
    ? `${offen} Spiel(e) noch nicht bestätigt. Die Rangfolge ist vorläufig.`
    : 'Rangfolge nach gewonnenen Legs am ganzen Abend, bei Gleichstand nach verlorenen Legs.';
  const zeilen = abendRangliste(spiele).map((z) => [
    String(z.rang), namen.get(z.id) ?? 'Unbekannt', String(z.legsGewonnen), String(z.legsVerloren), String(z.spiele),
  ]);
  $('abend-liste').replaceChildren(tabelle(['Platz', 'Spieler', 'Legs gew.', 'Legs verl.', 'Spiele'], zeilen));
}

laden().catch((e) => {
  $('status').textContent = `Fehler: ${e.message}`;
});
