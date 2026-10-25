import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { gruppenTabellen, abendRangliste } from './src/abend.js?v=1';

// Leinwand: zeigt den vom Admin markierten Abend. Keine Anmeldung nötig, die Lesefunktion
// liefert nur Ergebnisse und Aliase. Ansicht und Wechselzeit wählt man oben im Bild;
// die Wahl wird im Browser dieses Geräts gemerkt.
const AKTUALISIEREN_SEKUNDEN = 8;
const SCHLUESSEL = 'siedler180-leinwand';
const STANDARD = { ansicht: 'durchlauf', sek: 12 };
const ERLAUBTE_SEKUNDEN = [8, 12, 20, 30, 60];

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const $ = (id) => document.getElementById(id);
let einstellung = leseEinstellung();
let spiele = [];
let gruppen = [];
let folien = [];
let index = 0;
let abendDaten = null;
let wechselTimer = null;

function leseEinstellung() {
  try {
    const gespeichert = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null');
    if (gespeichert
      && ['durchlauf', 'seite'].includes(gespeichert.ansicht)
      && ERLAUBTE_SEKUNDEN.includes(Number(gespeichert.sek))) {
      return { ansicht: gespeichert.ansicht, sek: Number(gespeichert.sek) };
    }
  } catch { /* Speicher nicht verfügbar: Standard nehmen */ }
  return { ...STANDARD };
}

function speichereEinstellung() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(einstellung));
  } catch { /* nicht gespeicherte Wahl ist nicht schlimm */ }
}

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

function gruppenTabelle(g) {
  const zeilen = g.tabelle.map((e) => [
    g.hatErgebnis ? String(e.rang) : '–',
    e.id,
    `${e.legsGewonnen}:${e.legsVerloren}`,
    String(e.spiele),
  ]);
  return tabelle(['Platz', 'Spieler', 'Legs', 'Spiele'], zeilen);
}

function baueFolien() {
  if (!abendDaten) {
    folien = [];
    return;
  }
  const ranglisteFolie = { titel: 'Rangliste des Abends', typ: 'rangliste' };
  if (einstellung.ansicht === 'seite') {
    folien = [{ titel: 'Gruppen', typ: 'alle' }, ranglisteFolie];
  } else {
    folien = [
      ...gruppen.map((g) => ({ titel: g.gruppe, typ: 'gruppe', daten: g })),
      ranglisteFolie,
    ];
  }
}

function zeigeFolie() {
  if (!abendDaten) return;
  if (folien.length === 0) {
    $('folie-titel').textContent = '';
    $('fortschritt').textContent = '';
    $('bildschirm').replaceChildren();
    return;
  }
  index = Math.min(index, folien.length - 1);
  const folie = folien[index];
  $('folie-titel').textContent = folie.titel;
  $('fortschritt').textContent = folien.length > 1 ? `Seite ${index + 1} von ${folien.length}` : '';

  if (folie.typ === 'gruppe') {
    $('bildschirm').replaceChildren(gruppenTabelle(folie.daten));
  } else if (folie.typ === 'alle') {
    const raster = document.createElement('div');
    raster.className = 'gruppen-alle';
    for (const g of gruppen) {
      const block = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = g.gruppe;
      block.append(h, gruppenTabelle(g));
      raster.append(block);
    }
    $('bildschirm').replaceChildren(raster);
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

function weiterschalten() {
  if (folien.length < 2) return;
  index = (index + 1) % folien.length;
  zeigeFolie();
}

function starteWechsel() {
  stoppeWechsel();
  wechselTimer = setInterval(weiterschalten, einstellung.sek * 1000);
}

function stoppeWechsel() {
  if (wechselTimer) clearInterval(wechselTimer);
  wechselTimer = null;
}

async function laden() {
  const { data, error } = await supabase.rpc('leinwand_daten');
  if (error) throw error;

  if (!data) {
    abendDaten = null;
    spiele = [];
    gruppen = [];
    folien = [];
    stoppeWechsel();
    $('kopf').textContent = 'Spielstand';
    $('folie-titel').textContent = '';
    $('fortschritt').textContent = '';
    $('bildschirm').replaceChildren();
    $('hinweis').textContent = 'Für die Leinwand ist noch kein Abend markiert.';
    return;
  }

  abendDaten = data.abend;
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
  gruppen = gruppenTabellen(spiele);
  $('kopf').textContent = `${abendDaten.ort ?? 'Siedlerkeller'} · ${zeitText(abendDaten.beginn_at)}`;
  $('hinweis').textContent = spiele.length === 0 ? 'Für diesen Abend sind noch keine Spiele ausgelost.' : '';

  baueFolien();
  zeigeFolie();
  if (!wechselTimer) starteWechsel();
}

function ladenSicher() {
  laden().catch((e) => {
    $('hinweis').textContent = `Fehler beim Laden: ${e.message}`;
  });
}

// Bedienung: Auswahl sofort anwenden und merken.
$('ansicht').value = einstellung.ansicht;
$('wechsel').value = String(einstellung.sek);

$('ansicht').addEventListener('change', (e) => {
  einstellung.ansicht = e.target.value;
  speichereEinstellung();
  index = 0;
  baueFolien();
  zeigeFolie();
  starteWechsel();
});

$('wechsel').addEventListener('change', (e) => {
  einstellung.sek = Number(e.target.value);
  speichereEinstellung();
  starteWechsel();
});

ladenSicher();
setInterval(ladenSicher, AKTUALISIEREN_SEKUNDEN * 1000);
