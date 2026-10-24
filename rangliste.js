import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { gruppenTabelle } from './src/gruppen.js?v=1';
import { computeStandings } from './src/legquote.js';

const APP_VERSION = 'Version 28 · Stand 24.10.2026';

// Gleiche Sitzung wie in der App: das Fenster teilt den Speicher mit dem Hauptfenster.
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (id) => document.getElementById(id);
const istFinale = (gruppe) => gruppe.startsWith('Finale Rang');

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
  wahl.onchange = () => zeigeAbend(wahl.value, matches, namen);
  zeigeAbend(wahl.value, matches, namen);
}

function zeigeAbend(abendId, matches, namen) {
  const spiele = matches.filter((m) => m.evening_id === abendId);
  const vorrunde = spiele.filter((m) => !istFinale(m.group_name));
  const finale = spiele.filter((m) => istFinale(m.group_name));
  const liste = $('abend-liste');
  const hinweis = $('abend-hinweis');

  if (finale.length > 0) {
    const finalFertig = finale.every((m) => m.bestaetigt_von);
    hinweis.textContent = finalFertig
      ? 'Endplatzierung aus dem Finale.'
      : 'Das Finale ist noch nicht vollständig bestätigt. Die Plätze sind vorläufig.';
    const gruppen = [...new Set(finale.map((m) => m.group_name))].sort();
    const zeilen = [];
    let platz = 1;
    for (const gruppe of gruppen) {
      const gs = finale.filter((m) => m.group_name === gruppe);
      const ids = [...new Set(gs.flatMap((m) => [m.spieler_a, m.spieler_b]))];
      const tab = gruppenTabelle(ids, bestaetigt(gs));
      for (const e of tab) {
        zeilen.push([String(platz + e.rang - 1), namen.get(e.id) ?? 'Unbekannt', gruppe,
          `${e.legsGewonnen}:${e.legsVerloren}`]);
      }
      platz += tab.length;
    }
    liste.replaceChildren(tabelle(['Platz', 'Spieler', 'Finalgruppe', 'Legs'], zeilen));
    return;
  }

  hinweis.textContent = vorrunde.length > 0
    ? 'Noch kein Finale. Gezeigt werden die Vorrunden-Tabellen.'
    : 'Für diesen Abend gibt es noch keine Spiele.';
  const blöcke = [];
  for (const gruppe of [...new Set(vorrunde.map((m) => m.group_name))].sort()) {
    const gs = vorrunde.filter((m) => m.group_name === gruppe);
    const ids = [...new Set(gs.flatMap((m) => [m.spieler_a, m.spieler_b]))];
    const tab = gruppenTabelle(ids, bestaetigt(gs));
    const titel = document.createElement('h3');
    titel.textContent = gruppe;
    blöcke.push(titel, tabelle(['Platz', 'Spieler', 'Legs', 'Spiele'],
      tab.map((e) => [String(e.rang), namen.get(e.id) ?? 'Unbekannt',
        `${e.legsGewonnen}:${e.legsVerloren}`, String(e.spiele)])));
  }
  liste.replaceChildren(...blöcke);
}

laden().catch((e) => {
  $('status').textContent = `Fehler: ${e.message}`;
});
