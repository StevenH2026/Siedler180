import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { gruppenTabellen, abendRangliste } from './src/abend.js?v=1';

// Leinwand: zeigt den vom Admin markierten Abend. Keine Anmeldung nötig, die Lesefunktion
// liefert nur Ergebnisse und Aliase. Wechselt alle paar Sekunden zwischen Gruppen und Rangliste
// und lädt sich selbst neu.
const SEKUNDEN = Number(new URLSearchParams(window.location.search).get('sek')) || 12;
const AKTUALISIEREN_SEKUNDEN = 8;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const $ = (id) => document.getElementById(id);
let folien = [];
let index = 0;
let spiele = [];
let wechselTimer = null;

function zeitText(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
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

function zeigeFolie() {
  if (folien.length === 0) return;
  const folie = folien[index];
  $('folie-titel').textContent = folie.titel;
  $('fortschritt').textContent = `Seite ${index + 1} von ${folien.length}`;

  if (folie.typ === 'gruppe') {
    const g = folie.daten;
    const zeilen = g.tabelle.map((e) => [
      g.hatErgebnis ? String(e.rang) : '–',
      e.id,
      `${e.legsGewonnen}:${e.legsVerloren}`,
      String(e.spiele),
    ]);
    $('bildschirm').replaceChildren(tabelle(['Platz', 'Spieler', 'Legs', 'Spiele'], zeilen));
  } else {
    const zeilen = abendRangliste(spiele).map((z) => [
      String(z.rang), z.id, String(z.legsGewonnen), String(z.legsVerloren),
    ]);
    $('bildschirm').replaceChildren(
      zeilen.length > 0
        ? tabelle(['Platz', 'Spieler', 'Legs gew.', 'Legs verl.'], zeilen)
        : Object.assign(document.createElement('p'), { textContent: 'Noch keine bestätigten Ergebnisse.' }),
    );
  }
}

function starteWechsel() {
  if (wechselTimer) return;
  wechselTimer = setInterval(() => {
    if (folien.length === 0) return;
    index = (index + 1) % folien.length;
    zeigeFolie();
  }, SEKUNDEN * 1000);
}

async function laden() {
  const { data, error } = await supabase.rpc('leinwand_daten');
  if (error) throw error;

  if (!data) {
    folien = [];
    $('kopf').textContent = 'Spielstand';
    $('folie-titel').textContent = '';
    $('fortschritt').textContent = '';
    $('bildschirm').replaceChildren();
    $('hinweis').textContent = 'Für die Leinwand ist noch kein Abend markiert.';
    return;
  }

  // Die Funktion liefert Aliase statt Kennungen, daher ist der Alias die Spielerkennung hier.
  spiele = data.spiele.map((m) => ({
    group_name: m.group_name,
    runde: m.runde,
    spieler_a: m.a,
    spieler_b: m.b,
    legs_a: m.legs_a,
    legs_b: m.legs_b,
    bestaetigt_von: m.bestaetigt ? 'x' : null,
  }));
  $('kopf').textContent = `${data.abend.ort ?? 'Siedlerkeller'} · ${zeitText(data.abend.beginn_at)}`;
  $('hinweis').textContent = spiele.length === 0 ? 'Für diesen Abend sind noch keine Spiele ausgelost.' : '';

  folien = [
    ...gruppenTabellen(spiele).map((g) => ({ titel: g.gruppe, typ: 'gruppe', daten: g })),
    { titel: 'Rangliste des Abends', typ: 'rangliste' },
  ];
  index = Math.min(index, folien.length - 1);
  zeigeFolie();
  starteWechsel();
}

// Regelmäßig neu laden, damit neue Ergebnisse ohne Eingriff erscheinen.
function ladenSicher() {
  laden().catch((e) => {
    $('hinweis').textContent = `Fehler beim Laden: ${e.message}`;
  });
}

ladenSicher();
setInterval(ladenSicher, AKTUALISIEREN_SEKUNDEN * 1000);
