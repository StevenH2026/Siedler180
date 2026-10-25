import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { gruppenTabellen, abendRangliste } from './src/abend.js?v=1';

// Leinwand: wechselt alle paar Sekunden zwischen den Gruppentabellen und der Rangliste des Abends.
// Aktualisiert sich bei jeder Änderung an Spielen oder Abenden.
const SEKUNDEN = Number(new URLSearchParams(window.location.search).get('sek')) || 12;

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (id) => document.getElementById(id);
let folien = [];
let index = 0;
let namen = new Map();
let abend = null;
let spiele = [];
let timer = null;

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
      namen.get(e.id) ?? 'Unbekannt',
      `${e.legsGewonnen}:${e.legsVerloren}`,
      String(e.spiele),
    ]);
    $('bildschirm').replaceChildren(tabelle(['Platz', 'Spieler', 'Legs', 'Spiele'], zeilen));
  } else {
    const zeilen = abendRangliste(spiele).map((z) => [
      String(z.rang), namen.get(z.id) ?? 'Unbekannt', String(z.legsGewonnen), String(z.legsVerloren),
    ]);
    $('bildschirm').replaceChildren(
      zeilen.length > 0
        ? tabelle(['Platz', 'Spieler', 'Legs gew.', 'Legs verl.'], zeilen)
        : Object.assign(document.createElement('p'), { textContent: 'Noch keine bestätigten Ergebnisse.' }),
    );
  }
}

function starteWechsel() {
  if (timer) return;
  timer = setInterval(() => {
    if (folien.length === 0) return;
    index = (index + 1) % folien.length;
    zeigeFolie();
  }, SEKUNDEN * 1000);
}

async function laden() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    $('hinweis').textContent = 'Auf diesem Gerät zuerst in der App anmelden, dann diese Seite neu laden.';
    return false;
  }
  const [ev, ma, pr] = await Promise.all([
    supabase.from('evenings').select('id, beginn_at, ort, status'),
    supabase.from('matches').select('id, evening_id, group_name, runde, spieler_a, spieler_b, legs_a, legs_b, bestaetigt_von'),
    supabase.from('profiles').select('id, anzeigename'),
  ]);
  for (const r of [ev, ma, pr]) {
    if (r.error) throw r.error;
  }

  // Der aktuelle Abend ist der neueste mit Spielen.
  const mitSpielen = ev.data
    .filter((e) => ma.data.some((m) => m.evening_id === e.id))
    .sort((a, b) => b.beginn_at.localeCompare(a.beginn_at));
  namen = new Map(pr.data.map((p) => [p.id, p.anzeigename ?? 'Unbekannt']));
  if (mitSpielen.length === 0) {
    $('kopf').textContent = 'Spielstand';
    $('hinweis').textContent = 'Heute sind noch keine Spiele ausgelost.';
    return true;
  }

  abend = mitSpielen[0];
  spiele = ma.data.filter((m) => m.evening_id === abend.id);
  $('kopf').textContent = `${abend.ort ?? 'Siedlerkeller'} · ${zeitText(abend.beginn_at)}`;
  $('hinweis').textContent = '';

  folien = [
    ...gruppenTabellen(spiele).map((g) => ({ titel: g.gruppe, typ: 'gruppe', daten: g })),
    { titel: 'Rangliste des Abends', typ: 'rangliste' },
  ];
  index = Math.min(index, folien.length - 1);
  zeigeFolie();
  starteWechsel();
  return true;
}

// Aktualisieren bei jeder Änderung. Mehrere Änderungen kurz hintereinander werden zusammengefasst.
let aktualisierungTimer = null;
function beiAenderung() {
  clearTimeout(aktualisierungTimer);
  aktualisierungTimer = setTimeout(() => laden().catch(() => {}), 400);
}

laden()
  .then((angemeldet) => {
    if (!angemeldet) return;
    supabase.channel('leinwand')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, beiAenderung)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evenings' }, beiAenderung)
      .subscribe();
  })
  .catch((e) => {
    $('hinweis').textContent = `Fehler: ${e.message}`;
  });
