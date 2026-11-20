import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { gruppenTabellen, abendRangliste, rundenStand, finaleUebersicht } from './src/abend.js?v=2';

// Leinwand: zeigt den vom Admin markierten Abend, solange er läuft (nicht gewertet, nicht abgesagt,
// höchstens 12 Stunden nach Beginn). Die Lesefunktion liefert nur an angemeldete Admins Daten; die Leinwand
// nutzt dafür die Anmeldung der App im selben Browser. Ansicht und Wechselzeit wählt man oben im Bild;
// die Wahl wird im Browser dieses Geräts gemerkt.
const AKTUALISIEREN_SEKUNDEN = 8;
const SCHLUESSEL = 'siedler180-leinwand';
const STANDARD = { ansicht: 'durchlauf', sek: 12 };
const ERLAUBTE_SEKUNDEN = [8, 12, 20, 30, 60];

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
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
  const spielplanFolie = { titel: 'Spielplan', typ: 'spielplan' };
  // Finalübersicht nur, wenn es ein Finale geben kann (mindestens zwei Vorrundengruppen).
  const finaleFolie = gruppen.length >= 2 ? [{ titel: 'Weg ins Finale', typ: 'finale' }] : [];
  if (spiele.length === 0) {
    folien = [];
  } else if (einstellung.ansicht === 'seite') {
    folien = [spielplanFolie, { titel: 'Gruppen', typ: 'alle' }, ...finaleFolie, ranglisteFolie];
  } else {
    folien = [
      spielplanFolie,
      ...gruppen.map((g) => ({ titel: g.gruppe, typ: 'gruppe', daten: g })),
      ...finaleFolie,
      ranglisteFolie,
    ];
  }
}

function absatz(text, klasse = '') {
  const p = document.createElement('p');
  p.textContent = text;
  if (klasse) p.className = klasse;
  return p;
}

function rundenTitel(runde) {
  return runde.finale ? `Finale, Runde ${runde.slot}` : `Runde ${runde.slot}`;
}

function ergebnisText(s) {
  if (s.legs_a === null || s.legs_a === undefined) return 'läuft';
  return s.bestaetigt_von ? `${s.legs_a}:${s.legs_b}` : `${s.legs_a}:${s.legs_b} (unbestätigt)`;
}

// Spielplan: laufende Runde mit Ergebnissen, darunter die nächste Runde und wer pausiert.
function spielplanAnsicht() {
  const stand = rundenStand(spiele);
  const hülle = document.createElement('div');
  hülle.className = 'spielplan-leinwand';
  if (!stand.jetzt) {
    hülle.append(absatz(stand.alleBestaetigt && gruppen.length >= 2 && !stand.finaleAusgelost
      ? 'Vorrunde beendet. Das Finale wird gleich ausgelost.'
      : 'Alle Spiele sind gespielt.', 'gross'));
    return hülle;
  }
  const jetzt = document.createElement('section');
  const h = document.createElement('h3');
  h.textContent = `Jetzt: ${rundenTitel(stand.jetzt)}`;
  jetzt.append(h, tabelle(['Gruppe', 'Paarung', 'Ergebnis'],
    stand.jetzt.spiele.map((s) => [s.group_name, `${s.spieler_a} – ${s.spieler_b}`, ergebnisText(s)])));
  // Wer in derselben Phase gerade kein Spiel hat.
  const phase = spiele.filter((s) => s.group_name.startsWith('Finale Rang') === stand.jetzt.finale);
  const alle = new Set(phase.flatMap((s) => [s.spieler_a, s.spieler_b]));
  for (const s of stand.jetzt.spiele) { alle.delete(s.spieler_a); alle.delete(s.spieler_b); }
  if (alle.size > 0) jetzt.append(absatz(`Pause: ${[...alle].join(', ')}`, 'hinweis'));
  hülle.append(jetzt);

  if (stand.naechste) {
    const danach = document.createElement('section');
    const h2 = document.createElement('h3');
    h2.textContent = `Als Nächstes: ${rundenTitel(stand.naechste)}`;
    danach.append(h2, tabelle(['Gruppe', 'Paarung'],
      stand.naechste.spiele.map((s) => [s.group_name, `${s.spieler_a} – ${s.spieler_b}`])));
    hülle.append(danach);
  }
  return hülle;
}

// Weg ins Finale: links die Vorrundengruppen, rechts die Finalgruppen mit den Plätzen.
function finaleAnsicht() {
  const u = finaleUebersicht(spiele);
  const raster = document.createElement('div');
  raster.className = 'finale-leinwand';

  const links = document.createElement('section');
  const hl = document.createElement('h3');
  hl.textContent = u.vorrundeFertig ? 'Vorrunde' : 'Vorrunde (Zwischenstand)';
  links.append(hl);
  for (const g of u.gruppen) {
    const titel = document.createElement('h4');
    titel.textContent = g.gruppe;
    links.append(titel, tabelle(['Platz', 'Spieler'],
      g.tabelle.map((e) => [g.hatErgebnis ? String(e.rang) : '–', e.id])));
  }

  const rechts = document.createElement('section');
  const hr = document.createElement('h3');
  hr.textContent = u.finaleAusgelost ? 'Finale' : (u.vorrundeFertig ? 'Finale (noch nicht ausgelost)' : 'Finale (vorläufig)');
  rechts.append(hr);
  if (u.finalgruppen.length === 0) {
    rechts.append(absatz('Die Finalgruppen stehen fest, sobald jede Gruppe Ergebnisse hat.', 'hinweis'));
  }
  for (const f of u.finalgruppen) {
    const titel = document.createElement('h4');
    titel.textContent = f.spieler.length > 1 ? `${f.name}: ${f.plaetze}` : `${f.name.replace('Finale ', '')}: ${f.plaetze}`;
    rechts.append(titel);
    if (f.tabelle && f.hatErgebnis) {
      rechts.append(tabelle(['Platz', 'Spieler', 'Legs'],
        f.tabelle.map((e) => [String(f.start + e.rang - 1), e.id, `${e.legsGewonnen}:${e.legsVerloren}`])));
    } else {
      rechts.append(absatz(f.spieler.length === 1 ? `${f.spieler[0]} (kein Finalspiel nötig)` : f.spieler.join(' – ')));
    }
  }
  raster.append(links, rechts);
  return raster;
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

  if (folie.typ === 'spielplan') {
    $('bildschirm').replaceChildren(spielplanAnsicht());
  } else if (folie.typ === 'finale') {
    $('bildschirm').replaceChildren(finaleAnsicht());
  } else if (folie.typ === 'gruppe') {
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
    const hülle = document.createElement('div');
    hülle.className = 'rangliste-leinwand';
    hülle.append(zeilen.length > 0
      ? tabelle(['Platz', 'Spieler', 'Legs gew.', 'Legs verl.'], zeilen)
      : Object.assign(document.createElement('p'), { textContent: 'Noch keine bestätigten Ergebnisse.' }));
    $('bildschirm').replaceChildren(hülle);
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
    const { data: sitzung } = await supabase.auth.getSession();
    $('hinweis').textContent = sitzung.session
      ? 'Kein laufender Abend für die Leinwand markiert (oder der Abend ist bereits gewertet).'
      : 'Bitte in der App als Admin anmelden und die Leinwand von dort öffnen.';
    return;
  }

  abendDaten = data.abend;
  // Die Funktion liefert Aliase statt Kennungen, daher ist der Alias die Spielerkennung hier.
  spiele = data.spiele.map((m) => ({
    group_name: m.group_name,
    runde: m.runde,
    slot: m.slot,
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
