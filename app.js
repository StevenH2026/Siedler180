import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { planEvening } from './src/draw.js?v=4';
import { gruppenTabelle, finaleRangGruppen } from './src/gruppen.js?v=1';

// Bei jeder Änderung hochzählen, zusammen mit dem ?v=-Parameter in index.html.
const APP_VERSION = 'Version 23 · Stand 24.10.2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Muss zur Datenbank-Regel profiles_anzeigename_check passen.
const ALIAS_REGEL = /^[\p{L}\p{N}_ .-]{2,20}$/u;

// Teilnahme-Status: Schlüssel wie in der Datenbank, Beschriftung für die Oberfläche.
const TEILNAHME = [
  ['zugesagt', 'Ich bin dabei'],
  ['nur_equipment', 'Nur Equipment'],
  ['abgesagt', 'Abgesagt'],
];

const $ = (id) => document.getElementById(id);
$('version').textContent = APP_VERSION;

let userId = null;
let adminModus = false;
let gewaehlterAbend = null;
let equipmentOffenFuer = null;

function zeige(abschnitt) {
  const eingeloggt = abschnitt === 'profile';
  $('login').hidden = eingeloggt;
  $('profile').hidden = !eingeloggt;
  $('abende').hidden = !eingeloggt;
  $('profil').hidden = !eingeloggt;
  $('logout').hidden = !eingeloggt;
}

function fehler(text) {
  $('fehler').textContent = text;
  $('fehler').hidden = !text;
}

function zeitText(iso) {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  });
}

async function ladeProfil(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('anzeigename')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function istAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return data === true;
}

function zeigeAlias(alias) {
  $('alias').value = alias ?? '';
  $('gruss').textContent = alias ? `Hallo ${alias}` : 'Willkommen';
  $('ranglisten-hinweis').hidden = Boolean(alias);
  // Ohne Spielernamen bleibt der Bereich offen, damit er nicht übersehen wird.
  $('profil').open = !alias;
}

// ---------- Teilnahme ----------

async function ladeAbende() {
  const { data: abende, error } = await supabase
    .from('evenings')
    .select('id, datum, beginn_at, ort, boards, status, anmeldeschluss')
    .in('status', adminModus ? ['offen', 'geplant', 'abgesagt'] : ['offen', 'geplant'])
    .order('beginn_at');
  if (error) throw error;

  const { data: teilnahmen, error: fehlerTeilnahmen } = await supabase
    .from('attendance')
    .select('evening_id, player_id, status, equipment, profiles(anzeigename)');
  if (fehlerTeilnahmen) throw fehlerTeilnahmen;

  const { data: spiele, error: fehlerSpiele } = await supabase
    .from('matches')
    .select('id, evening_id, group_name, runde, slot, spieler_a, spieler_b, legs_a, legs_b, eingetragen_von, bestaetigt_von, a:profiles!matches_spieler_a_fkey(anzeigename), b:profiles!matches_spieler_b_fkey(anzeigename)');
  if (fehlerSpiele) throw fehlerSpiele;

  return { abende, teilnahmen, spiele };
}

// ---------- Spielplan und Ergebnisse ----------

const ERGEBNISSE = [[2, 0], [2, 1], [1, 2], [0, 2]];

function zeichneSpielplan(spiele, nurLesen = false) {
  const bereich = document.createElement('div');
  bereich.className = 'spielplan';
  if (spiele.length === 0) return bereich;

  const titel = document.createElement('h3');
  titel.textContent = 'Spielplan';
  bereich.append(titel);

  const sortiert = spiele.slice().sort((x, y) => x.slot - y.slot || x.group_name.localeCompare(y.group_name));
  for (const spiel of sortiert) bereich.append(zeichneSpiel(spiel, nurLesen));
  return bereich;
}

function zeichneSpiel(spiel, nurLesen = false) {
  const beteiligt = userId === spiel.spieler_a || userId === spiel.spieler_b;
  const darfEintragen = !nurLesen && (beteiligt || adminModus);
  const bestaetigt = Boolean(spiel.bestaetigt_von);
  const aName = spiel.a?.anzeigename ?? 'Unbekannt';
  const bName = spiel.b?.anzeigename ?? 'Unbekannt';

  const karte = document.createElement('div');
  karte.className = 'spiel';

  const kopf = document.createElement('p');
  kopf.className = 'hinweis';
  kopf.textContent = `Slot ${spiel.slot} · Runde ${spiel.runde} · ${spiel.group_name}`;
  karte.append(kopf);

  const paarung = document.createElement('p');
  paarung.className = 'paarung';
  paarung.textContent = `${aName} – ${bName}`;
  karte.append(paarung);

  const stand = document.createElement('p');
  stand.className = 'hinweis';
  if (spiel.legs_a === null) {
    stand.textContent = 'Noch kein Ergebnis';
  } else if (bestaetigt) {
    stand.textContent = `Bestätigt: ${spiel.legs_a}:${spiel.legs_b}`;
  } else {
    const wer = spiel.eingetragen_von === userId ? 'Von dir eingetragen' : 'Eingetragen';
    stand.textContent = `${wer}: ${spiel.legs_a}:${spiel.legs_b} · wartet auf Bestätigung`;
  }
  karte.append(stand);

  // Der Gegner eines eingetragenen, unbestätigten Ergebnisses bestätigt per Knopf.
  // Ein abweichendes Ergebnis meldet er nur bewusst über den ausklappbaren Bereich.
  const wartetAufMich = darfEintragen && spiel.legs_a !== null && !bestaetigt && spiel.eingetragen_von !== userId;

  const reihe = document.createElement('div');
  reihe.className = 'ergebnis-knoepfe';
  for (const [la, lb] of ERGEBNISSE) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = `${la}:${lb}`;
    if (spiel.legs_a === la && spiel.legs_b === lb) knopf.classList.add('aktiv');
    knopf.addEventListener('click', () => {
      // Ein bestätigtes Ergebnis zu ändern ist nur dem Admin erlaubt und braucht eine Rückfrage.
      if (bestaetigt && (spiel.legs_a !== la || spiel.legs_b !== lb)) {
        const ok = confirm(
          `Das bestätigte Ergebnis ${spiel.legs_a}:${spiel.legs_b} wirklich auf ${la}:${lb} ändern?`,
        );
        if (!ok) return;
      }
      ergebnisSetzen(spiel.id, la, lb);
    });
    reihe.append(knopf);
  }

  if (wartetAufMich) {
    const bestaetigen = document.createElement('button');
    bestaetigen.type = 'button';
    bestaetigen.textContent = `${spiel.legs_a}:${spiel.legs_b} bestätigen`;
    bestaetigen.addEventListener('click', () => ergebnisBestaetigen(spiel.id));
    karte.append(bestaetigen);

    const abweichend = document.createElement('details');
    abweichend.className = 'hinweis';
    abweichend.dataset.spielId = spiel.id;
    const summe = document.createElement('summary');
    summe.textContent = 'Anderes Ergebnis melden';
    abweichend.append(summe, reihe);
    karte.append(abweichend);
  } else if (darfEintragen && (!bestaetigt || adminModus)) {
    karte.append(reihe);
  }

  if (adminModus && !nurLesen && spiel.legs_a !== null) {
    const loeschen = document.createElement('button');
    loeschen.type = 'button';
    loeschen.className = 'sekundaer';
    loeschen.textContent = 'Ergebnis zurücksetzen';
    loeschen.addEventListener('click', () => ergebnisZuruecksetzen(spiel));
    karte.append(loeschen);
  }
  return karte;
}

async function ergebnisZuruecksetzen(spiel) {
  const frage = spiel.bestaetigt_von
    ? `Das bestätigte Ergebnis ${spiel.legs_a}:${spiel.legs_b} löschen? Das Spiel wird wieder offen.`
    : `Das eingetragene Ergebnis ${spiel.legs_a}:${spiel.legs_b} löschen?`;
  if (!confirm(frage)) return;

  const { error } = await supabase
    .from('matches')
    .update({ legs_a: null, legs_b: null, eingetragen_von: null, bestaetigt_von: null })
    .eq('id', spiel.id);
  if (error) {
    $('abend-status').textContent = `Zurücksetzen fehlgeschlagen: ${error.message}`;
    return;
  }
  await zeichneAbende();
  $('abend-status').textContent = 'Ergebnis zurückgesetzt.';
}

async function ergebnisSetzen(matchId, legsA, legsB) {
  $('abend-status').textContent = '';
  const { error } = await supabase.rpc('set_match_result', {
    p_match: matchId, p_legs_a: legsA, p_legs_b: legsB,
  });
  if (error) {
    $('abend-status').textContent = `Ergebnis nicht gespeichert: ${error.message}`;
    return;
  }
  await zeichneAbende();
  $('abend-status').textContent = 'Ergebnis gespeichert, der Gegner muss es bestätigen.';
}

async function ergebnisBestaetigen(matchId) {
  $('abend-status').textContent = '';
  const { error } = await supabase.rpc('confirm_match_result', { p_match: matchId });
  if (error) {
    $('abend-status').textContent = `Bestätigung fehlgeschlagen: ${error.message}`;
    return;
  }
  await zeichneAbende();
  $('abend-status').textContent = 'Ergebnis bestätigt.';
}

function zeichneAbend(abend, teilnahmen, spiele) {
  if (!adminModus && abend.status !== 'abgesagt' && spiele.some((s) => s.evening_id === abend.id)) {
    return zeichneAusgelost(abend, spiele, teilnahmen);
  }
  const eigene = teilnahmen.find((t) => t.evening_id === abend.id && t.player_id === userId);
  const zugesagt = teilnahmen.filter((t) => t.evening_id === abend.id && t.status === 'zugesagt');
  const offen = new Date(abend.anmeldeschluss) > new Date();

  const karte = document.createElement('article');
  karte.className = 'abend';

  const titel = document.createElement('h3');
  titel.textContent = zeitText(abend.beginn_at);
  karte.append(titel);

  const info = document.createElement('p');
  info.className = 'hinweis';
  info.textContent = `${abend.ort ?? 'Siedlerkeller'} · ${abend.boards} Boards · Anmeldeschluss ${zeitText(abend.anmeldeschluss)}`;
  karte.append(info);

  if (abend.status === 'abgesagt') {
    const abgesagt = document.createElement('p');
    abgesagt.className = 'hinweis';
    abgesagt.textContent = 'Dieser Abend ist abgesagt.';
    karte.append(abgesagt);
    if (adminModus) {
      const wieder = document.createElement('button');
      wieder.type = 'button';
      wieder.className = 'sekundaer';
      wieder.textContent = 'Wiederöffnen';
      wieder.addEventListener('click', () => abendWiederoeffnen(abend));
      karte.append(wieder);
    }
    return karte;
  }

  const status = document.createElement('p');
  status.className = 'hinweis';
  status.textContent = `Zugesagt: ${zugesagt.length}`;
  karte.append(status);

  if (eigene?.status === 'nur_equipment' && eigene.equipment) {
    const bringt = document.createElement('p');
    bringt.className = 'hinweis';
    bringt.textContent = `Du bringst mit: ${eigene.equipment}`;
    karte.append(bringt);
  }

  const planVorhanden = spiele.some((s) => s.evening_id === abend.id);
  const hatErgebnis = spiele.some((s) => s.evening_id === abend.id && s.legs_a !== null);

  if (adminModus && planVorhanden) {
    const imPlan = new Set(spiele.filter((s) => s.evening_id === abend.id).flatMap((s) => [s.spieler_a, s.spieler_b]));
    const abgesagtImPlan = teilnahmen.filter(
      (t) => t.evening_id === abend.id && t.status === 'abgesagt' && imPlan.has(t.player_id),
    ).length;
    if (abgesagtImPlan > 0) {
      const warnung = document.createElement('p');
      warnung.className = 'hinweis';
      warnung.textContent = `Achtung: ${abgesagtImPlan} abgesagter Spieler steht noch im Spielplan. Bitte am Spielabend neu auslosen.`;
      karte.append(warnung);
    }
  }

  const knopfReihe = document.createElement('div');
  knopfReihe.className = 'knoepfe';
  for (const [schluessel, beschriftung] of TEILNAHME) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = beschriftung;
    // Absage bleibt auch nach dem Anmeldeschluss möglich, solange kein Ergebnis vorliegt.
    knopf.disabled = schluessel === 'abgesagt'
      ? hatErgebnis
      : !offen;
    knopf.setAttribute('aria-pressed', String(eigene?.status === schluessel));
    if (eigene?.status === schluessel) knopf.classList.add('aktiv');
    knopf.addEventListener('click', () => {
      if (schluessel === 'nur_equipment') {
        equipmentOffenFuer = abend.id;
        zeichneAbende().catch(() => {});
        return;
      }
      if (schluessel === 'abgesagt' && planVorhanden && eigene?.status !== 'abgesagt') {
        const ok = confirm('Damit wird eine neue Auslosung nötig. Der Admin lost am Spielabend neu aus. Wirklich absagen?');
        if (!ok) return;
      }
      setzeTeilnahme(abend.id, schluessel);
    });
    knopfReihe.append(knopf);
  }
  karte.append(knopfReihe);

  if (equipmentOffenFuer === abend.id) {
    karte.append(zeichneEquipmentMaske(abend, eigene));
  }
  if (hatErgebnis) {
    const gesperrt = document.createElement('p');
    gesperrt.className = 'hinweis';
    gesperrt.textContent = 'Absage nicht mehr möglich, an diesem Abend liegen Ergebnisse vor.';
    karte.append(gesperrt);
  }

  if (adminModus) {
    const aus = document.createElement('button');
    aus.type = 'button';
    aus.className = 'sekundaer';
    aus.textContent = 'Auslosen';
    aus.addEventListener('click', () => loseAus(abend));
    karte.append(aus);

    const adminReihe = document.createElement('div');
    adminReihe.className = 'knoepfe';
    const zuruecksetzen = document.createElement('button');
    zuruecksetzen.type = 'button';
    zuruecksetzen.className = 'sekundaer';
    zuruecksetzen.textContent = 'Spielplan zurücksetzen';
    zuruecksetzen.addEventListener('click', () => spielplanZuruecksetzen(abend));
    const absagen = document.createElement('button');
    absagen.type = 'button';
    absagen.className = 'sekundaer';
    absagen.textContent = 'Abend absagen';
    absagen.addEventListener('click', () => abendAbsagen(abend));
    adminReihe.append(zuruecksetzen, absagen);
    karte.append(adminReihe);
  }

  if (!offen) {
    const zu = document.createElement('p');
    zu.className = 'hinweis';
    zu.textContent = 'Anmeldung geschlossen.';
    karte.append(zu);
  }

  if (spiele.some((s) => s.evening_id === abend.id)) {
    const plan = document.createElement('button');
    plan.type = 'button';
    plan.className = 'sekundaer';
    plan.textContent = 'Spielplan ansehen';
    plan.addEventListener('click', () => {
      window.location.hash = `plan/${abend.id}`;
    });
    karte.append(plan);
  }
  return karte;
}

// Maske für „Nur Equipment“: der Spieler trägt ein, was er mitbringt.
function zeichneEquipmentMaske(abend, eigene) {
  const form = document.createElement('form');
  form.className = 'equipment';

  const label = document.createElement('label');
  label.textContent = 'Welches Equipment bringst du mit?';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 200;
  input.id = `equipment-${abend.id}`;
  input.value = eigene?.equipment ?? '';
  input.placeholder = 'z. B. Boards, Scheibe, Darts';
  label.htmlFor = input.id;

  const speichern = document.createElement('button');
  speichern.type = 'submit';
  speichern.textContent = 'Speichern';
  const abbrechen = document.createElement('button');
  abbrechen.type = 'button';
  abbrechen.className = 'sekundaer';
  abbrechen.textContent = 'Abbrechen';
  abbrechen.addEventListener('click', () => {
    equipmentOffenFuer = null;
    zeichneAbende().catch(() => {});
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      $('abend-status').textContent = 'Bitte trag ein, was du mitbringst.';
      return;
    }
    setzeTeilnahme(abend.id, 'nur_equipment', text);
  });
  form.append(label, input, speichern, abbrechen);
  return form;
}

// Kompakte Zeile für einen weiteren Abend; „Anzeigen“ macht ihn zur vollen Karte.
function zeichneKompakt(abend, teilnahmen) {
  const eigene = teilnahmen.find((t) => t.evening_id === abend.id && t.player_id === userId);
  const zugesagt = teilnahmen.filter((t) => t.evening_id === abend.id && t.status === 'zugesagt').length;
  const eigenerStatus = abend.status === 'abgesagt'
    ? 'abgesagt'
    : (TEILNAHME.find(([schluessel]) => schluessel === eigene?.status)?.[1] ?? 'keine Antwort');

  const karte = document.createElement('div');
  karte.className = 'abend kompakt';

  const zeile = document.createElement('p');
  zeile.className = 'paarung';
  zeile.textContent = `${zeitText(abend.beginn_at)} · ${abend.ort ?? 'Siedlerkeller'}`;
  karte.append(zeile);

  const info = document.createElement('p');
  info.className = 'hinweis';
  info.textContent = `Zugesagt: ${zugesagt} · Du: ${eigenerStatus}`;
  karte.append(info);

  const anzeigen = document.createElement('button');
  anzeigen.type = 'button';
  anzeigen.className = 'sekundaer';
  anzeigen.textContent = 'Anzeigen';
  anzeigen.addEventListener('click', () => {
    gewaehlterAbend = abend.id;
    zeichneAbende().catch(() => {});
  });
  karte.append(anzeigen);
  return karte;
}

async function zeichneAbende() {
  // Erst laden, dann leeren und befüllen ohne weiteres await dazwischen.
  // Sonst können zwei gleichzeitige Aufrufe die Karten doppelt anhängen.
  const { abende, teilnahmen, spiele } = await ladeAbende();
  const liste = $('abend-liste');
  // Geöffnete „Anderes Ergebnis melden“-Bereiche beim Neuzeichnen offen halten.
  const offeneBereiche = new Set(
    [...liste.querySelectorAll('details[open][data-spiel-id]')].map((d) => d.dataset.spielId),
  );
  liste.replaceChildren();
  $('abende-leer').hidden = abende.length > 0;
  if (abende.length === 0) return;

  // Der gewählte Abend (standardmäßig der nächste) steht als volle Karte oben,
  // die weiteren Abende darunter als kompakte Zeilen.
  if (!abende.some((a) => a.id === gewaehlterAbend)) gewaehlterAbend = abende[0].id;
  const aktuell = abende.find((a) => a.id === gewaehlterAbend);
  liste.append(zeichneAbend(aktuell, teilnahmen, spiele));

  const weitere = abende.filter((a) => a.id !== aktuell.id);
  if (weitere.length > 0) {
    const titel = document.createElement('h3');
    titel.textContent = 'Weitere Abende';
    liste.append(titel);
    for (const abend of weitere) liste.append(zeichneKompakt(abend, teilnahmen));
  }
  for (const d of liste.querySelectorAll('details[data-spiel-id]')) {
    if (offeneBereiche.has(d.dataset.spielId)) d.open = true;
  }
}

// ---------- Ansichten: Abende und Gesamtplan ----------

// Startseite nach der Auslosung (Spieler): Gruppe, Spielplan und Absage.
function zeichneAusgelost(abend, spiele, teilnahmen) {
  const karte = document.createElement('article');
  karte.className = 'abend';

  const titel = document.createElement('h3');
  titel.textContent = zeitText(abend.beginn_at);
  karte.append(titel);

  const info = document.createElement('p');
  info.className = 'hinweis';
  info.textContent = `${abend.ort ?? 'Siedlerkeller'} · ${abend.boards} Boards`;
  karte.append(info);

  const eigene = spiele.find((s) => s.evening_id === abend.id && (s.spieler_a === userId || s.spieler_b === userId));
  const eigeneTeilnahme = teilnahmen.find((t) => t.evening_id === abend.id && t.player_id === userId);
  const abgesagt = eigeneTeilnahme?.status === 'abgesagt';
  const gruppe = eigene?.group_name;

  const status = document.createElement('p');
  if (abgesagt) {
    status.textContent = 'Du hast abgesagt. Der Admin lost am Spielabend neu aus.';
  } else {
    status.textContent = gruppe
      ? `Ausgelost. Du bist in ${gruppe}.`
      : 'Ausgelost. Du bist an diesem Abend nicht eingeplant.';
  }
  karte.append(status);

  const plan = document.createElement('button');
  plan.type = 'button';
  plan.textContent = 'Dein Spielplan';
  plan.addEventListener('click', () => {
    window.location.hash = `plan/${abend.id}`;
  });
  karte.append(plan);

  if (!abgesagt) {
    const hatErgebnis = spiele.some((s) => s.evening_id === abend.id && s.legs_a !== null);
    const absagen = document.createElement('button');
    absagen.type = 'button';
    absagen.className = 'sekundaer';
    absagen.textContent = 'Absagen';
    absagen.disabled = hatErgebnis;
    absagen.addEventListener('click', () => {
      const ok = confirm('Damit wird eine neue Auslosung nötig. Der Admin lost am Spielabend neu aus. Wirklich absagen?');
      if (ok) setzeTeilnahme(abend.id, 'abgesagt');
    });
    karte.append(absagen);
    if (hatErgebnis) {
      const gesperrt = document.createElement('p');
      gesperrt.className = 'hinweis';
      gesperrt.textContent = 'Absage nicht mehr möglich, an diesem Abend liegen Ergebnisse vor.';
      karte.append(gesperrt);
    }
  }
  return karte;
}

// Spielplan für Spieler: eigene Paarungen und Gruppentabelle. Andere Gruppen auf Knopfdruck.
function zeichneSpielerPlan(spiele) {
  const bereich = document.createElement('div');
  const meine = spiele
    .filter((s) => s.spieler_a === userId || s.spieler_b === userId)
    .sort((x, y) => x.slot - y.slot);
  const gruppe = meine[0]?.group_name ?? null;

  if (!gruppe) {
    const leer = document.createElement('p');
    leer.className = 'hinweis';
    leer.textContent = 'Du bist an diesem Abend nicht eingeplant.';
    bereich.append(leer);
  } else {
    const titel = document.createElement('h3');
    titel.textContent = 'Deine Paarungen';
    bereich.append(titel);

    // Pro Runde der eigenen Gruppe: eigenes Spiel oder Freispiel.
    const runden = [...new Set(spiele.filter((s) => s.group_name === gruppe).map((s) => s.runde))]
      .sort((a, b) => a - b);
    const meinRunde = new Map(meine.map((s) => [s.runde, s]));
    for (const runde of runden) {
      const spiel = meinRunde.get(runde);
      if (spiel) {
        bereich.append(zeichneSpiel(spiel));
      } else {
        const frei = document.createElement('div');
        frei.className = 'spiel';
        const titelFrei = document.createElement('p');
        titelFrei.className = 'paarung';
        titelFrei.textContent = 'Freispiel';
        const info = document.createElement('p');
        info.className = 'hinweis';
        info.textContent = `Runde ${runde} · ${gruppe}: Du setzt in dieser Runde aus.`;
        frei.append(titelFrei, info);
        bereich.append(frei);
      }
    }
    bereich.append(zeichneTurnier(spiele, { nur: [gruppe], finale: false }));
  }

  const anderes = document.createElement('div');
  anderes.hidden = true;
  anderes.append(zeichneTurnier(spiele, { ohne: gruppe ? [gruppe] : [], finale: true }));

  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'sekundaer';
  knopf.textContent = 'Andere Gruppen anzeigen';
  knopf.addEventListener('click', () => {
    anderes.hidden = !anderes.hidden;
    knopf.textContent = anderes.hidden ? 'Andere Gruppen anzeigen' : 'Andere Gruppen ausblenden';
  });
  bereich.append(knopf, anderes);
  return bereich;
}

async function zeichnePlan(abendId) {
  const { abende, teilnahmen, spiele } = await ladeAbende();
  const abend = abende.find((a) => a.id === abendId);
  const liste = $('plan-liste');
  liste.replaceChildren();

  if (!abend) {
    $('plan-titel').textContent = 'Abend nicht gefunden';
    $('plan-teilnehmer').textContent = '';
    return;
  }
  $('plan-titel').textContent = `${zeitText(abend.beginn_at)} · ${abend.ort ?? 'Siedlerkeller'}`;

  const zugesagt = teilnahmen
    .filter((t) => t.evening_id === abend.id && t.status === 'zugesagt')
    .map((t) => t.profiles?.anzeigename ?? 'Unbekannt');
  $('plan-teilnehmer').textContent = adminModus
    ? `Zugesagt (${zugesagt.length}): ${zugesagt.join(', ') || 'noch niemand'}`
    : '';

  const eigene = spiele.filter((s) => s.evening_id === abend.id);
  if (eigene.length === 0) {
    const leer = document.createElement('p');
    leer.className = 'hinweis';
    leer.textContent = 'Noch kein Spielplan ausgelost.';
    liste.append(leer);
  } else {
    if (adminModus) {
      liste.append(zeichneTurnier(eigene));
      liste.append(zeichneSpielplan(eigene, false));
    } else {
      liste.append(zeichneSpielerPlan(eigene));
    }
  }
}

// Turnierübersicht: Gruppentabellen aus bestätigten Ergebnissen.
// Optionen: nur (nur diese Gruppen), ohne (diese Gruppen ausblenden), finale (Finale-Vorschau zeigen).
// Die Finale-Vorschau erscheint erst, wenn alle Gruppenspiele bestätigt sind.
function zeichneTurnier(spiele, { nur = null, ohne = [], finale = true } = {}) {
  const bereich = document.createElement('div');
  bereich.className = 'turnier';
  if (spiele.length === 0) return bereich;

  const namen = new Map();
  for (const s of spiele) {
    namen.set(s.spieler_a, s.a?.anzeigename ?? 'Unbekannt');
    namen.set(s.spieler_b, s.b?.anzeigename ?? 'Unbekannt');
  }

  // Tabellen für alle Gruppen berechnen, auch für ausgeblendete: das Finale braucht sie.
  const alleGruppen = [...new Set(spiele.map((s) => s.group_name))].sort();
  const berechnet = new Map();
  for (const gruppe of alleGruppen) {
    const gruppeSpiele = spiele.filter((s) => s.group_name === gruppe);
    const ids = [...new Set(gruppeSpiele.flatMap((s) => [s.spieler_a, s.spieler_b]))];
    const bestaetigt = gruppeSpiele
      .filter((s) => s.bestaetigt_von)
      .map((s) => ({ a: s.spieler_a, b: s.spieler_b, legsA: s.legs_a, legsB: s.legs_b }));
    berechnet.set(gruppe, {
      tabelle: gruppenTabelle(ids, bestaetigt),
      // Ohne ein bestätigtes Ergebnis in der Gruppe gibt es noch keinen Rang.
      hatErgebnis: bestaetigt.length > 0,
    });
  }

  const gruppen = document.createElement('div');
  gruppen.className = 'gruppen';
  for (const gruppe of alleGruppen) {
    if ((nur && !nur.includes(gruppe)) || ohne.includes(gruppe)) continue;
    const { tabelle, hatErgebnis } = berechnet.get(gruppe);

    const block = document.createElement('div');
    block.className = 'gruppe';
    const titel = document.createElement('h3');
    titel.textContent = gruppe;
    block.append(titel);

    const tabelleEl = document.createElement('table');
    const kopf = tabelleEl.createTHead().insertRow();
    for (const text of ['Platz', 'Spieler', 'Legs', 'Spiele']) {
      const th = document.createElement('th');
      th.textContent = text;
      kopf.append(th);
    }
    const body = tabelleEl.createTBody();
    for (const eintrag of tabelle) {
      const zeile = body.insertRow();
      zeile.insertCell().textContent = hatErgebnis ? String(eintrag.rang) : '–';
      zeile.insertCell().textContent = namen.get(eintrag.id) ?? 'Unbekannt';
      zeile.insertCell().textContent = `${eintrag.legsGewonnen}:${eintrag.legsVerloren}`;
      zeile.insertCell().textContent = String(eintrag.spiele);
    }
    const wrap = document.createElement('div');
    wrap.className = 'tabelle-wrap';
    wrap.append(tabelleEl);
    block.append(wrap);
    gruppen.append(block);
  }
  bereich.append(gruppen);

  const alleBestaetigt = spiele.every((s) => s.bestaetigt_von);
  if (finale && alleBestaetigt) {
    const finaleEl = document.createElement('div');
    finaleEl.className = 'finale';
    const titel = document.createElement('h3');
    titel.textContent = 'Finale (Vorschau)';
    finaleEl.append(titel);
    const hinweis = document.createElement('p');
    hinweis.className = 'hinweis';
    hinweis.textContent = 'Alle Gruppenspiele sind bestätigt. Die Finalgruppen stehen fest, die Finalspiele sind noch nicht ausgelost.';
    finaleEl.append(hinweis);
    const liste = document.createElement('ul');
    const tabellen = alleGruppen.map((g) => berechnet.get(g).tabelle);
    finaleRangGruppen(tabellen).forEach((ids, index) => {
      const eintrag = document.createElement('li');
      const namenText = ids.map((id) => namen.get(id) ?? 'Unbekannt').join(', ');
      eintrag.textContent = `Finale Rang ${index + 1}: ${namenText || '–'}`;
      liste.append(eintrag);
    });
    finaleEl.append(liste);
    bereich.append(finaleEl);
  }
  return bereich;
}

// Welche Ansicht gilt, richtet sich nach der Adresse (#plan/<id> oder leer).
async function route() {
  const plan = window.location.hash.match(/^#plan\/(.+)$/);
  if (plan) {
    $('abende').hidden = true;
    $('plan').hidden = false;
    await zeichnePlan(plan[1]);
  } else {
    $('plan').hidden = true;
    $('abende').hidden = false;
    await zeichneAbende();
  }
}

// Änderungen anderer Spieler live übernehmen (Supabase Realtime, RLS gilt weiterhin).
let liveGestartet = false;
function starteLiveAktualisierung() {
  if (liveGestartet) return;
  liveGestartet = true;
  let timer = null;
  const neuZeichnen = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (userId) route().catch(() => {});
    }, 300);
  };
  supabase
    .channel('spielabend')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, neuZeichnen)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, neuZeichnen)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evenings' }, neuZeichnen)
    .subscribe();
}

// ---------- Auslosung (Admin) ----------

async function loseAus(abend) {
  $('abend-status').textContent = 'Lose aus …';

  const { data: zusagen, error } = await supabase
    .from('attendance')
    .select('player_id, profiles(anzeigename)')
    .eq('evening_id', abend.id)
    .eq('status', 'zugesagt');
  if (error) {
    $('abend-status').textContent = `Laden fehlgeschlagen: ${error.message}`;
    return;
  }

  const namen = new Map(zusagen.map((z) => [z.player_id, z.profiles?.anzeigename ?? 'Unbekannt']));

  let plan;
  try {
    plan = planEvening({ players: [...namen.keys()], boards: abend.boards });
  } catch (e) {
    $('abend-status').textContent = `Auslosung nicht möglich: ${e.message}`;
    return;
  }

  const frage = new Date(abend.anmeldeschluss) > new Date()
    ? `Die Anmeldung läuft noch bis ${zeitText(abend.anmeldeschluss)}. Trotzdem jetzt auslosen? Ein vorhandener Spielplan wird ersetzt.`
    : `Jetzt für ${namen.size} Spieler auslosen? Ein vorhandener Spielplan wird ersetzt.`;
  if (!confirm(frage)) {
    $('abend-status').textContent = '';
    return;
  }

  const matches = plan.slots.flatMap((slot, i) =>
    slot.map((m) => ({ group: m.group, runde: m.round, slot: i + 1, a: m.a, b: m.b })),
  );

  const { error: fehlerRpc } = await supabase.rpc('auslosen', { p_evening: abend.id, p_matches: matches });
  if (fehlerRpc) {
    $('abend-status').textContent = `Auslosung fehlgeschlagen: ${fehlerRpc.message}`;
    return;
  }

  const gruppen = plan.groups
    .map((g) => `${g.name}: ${g.players.map((p) => namen.get(p)).join(', ')}`)
    .join(' · ');
  const hinweise = plan.warnings.join(' ');
  await zeichneAbende();
  $('abend-status').textContent =
    `Ausgelost: ${plan.matchCount} Spiele in ${plan.slots.length} Runden, ca. ${plan.estimatedMinutes} min. ${gruppen}. ${hinweise}`.trim();
}

// ---------- Admin: zurücksetzen und absagen ----------

async function spielplanZuruecksetzen(abend) {
  const { count, error: fehlerZaehlen } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('evening_id', abend.id)
    .not('legs_a', 'is', null);
  if (fehlerZaehlen) {
    $('abend-status').textContent = `Prüfen fehlgeschlagen: ${fehlerZaehlen.message}`;
    return;
  }

  const frage = count > 0
    ? `Achtung: ${count} eingetragene Ergebnisse werden mit dem Spielplan gelöscht. Wirklich zurücksetzen?`
    : 'Spielplan dieses Abends löschen? Danach kannst du neu auslosen.';
  if (!confirm(frage)) return;

  const { error } = await supabase.from('matches').delete().eq('evening_id', abend.id);
  if (error) {
    $('abend-status').textContent = `Zurücksetzen fehlgeschlagen: ${error.message}`;
    return;
  }
  await zeichneAbende();
  $('abend-status').textContent = 'Spielplan gelöscht.';
}

async function abendAbsagen(abend) {
  if (!confirm('Abend absagen? Er verschwindet für alle aus der Liste. Teilnahmen bleiben gespeichert.')) return;

  const { error } = await supabase
    .from('evenings')
    .update({ status: 'abgesagt' })
    .eq('id', abend.id);
  if (error) {
    $('abend-status').textContent = `Absagen fehlgeschlagen: ${error.message}`;
    return;
  }
  await zeichneAbende();
  $('abend-status').textContent = 'Abend abgesagt.';
}

async function abendWiederoeffnen(abend) {
  const { error } = await supabase
    .from('evenings')
    .update({ status: 'offen' })
    .eq('id', abend.id);
  if (error) {
    $('abend-status').textContent = `Wiederöffnen fehlgeschlagen: ${error.message}`;
    return;
  }
  await zeichneAbende();
  $('abend-status').textContent = 'Abend wieder geöffnet.';
}

async function setzeTeilnahme(evening_id, status, equipment = null) {
  $('abend-status').textContent = '';
  const { error } = await supabase
    .from('attendance')
    .upsert(
      {
        evening_id,
        player_id: userId,
        status,
        equipment: status === 'nur_equipment' ? equipment : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'evening_id,player_id' },
    );
  if (error) {
    if (error.message.includes('row-level security')) {
      $('abend-status').textContent = 'Die Anmeldung ist für diesen Abend geschlossen.';
    } else if (error.message.includes('Absage nicht mehr möglich')) {
      $('abend-status').textContent = 'Absage nicht mehr möglich: an diesem Abend liegen bereits Ergebnisse vor.';
    } else {
      $('abend-status').textContent = `Speichern fehlgeschlagen: ${error.message}`;
    }
    return;
  }
  equipmentOffenFuer = null;
  await zeichneAbende();
  $('abend-status').textContent = 'Gespeichert.';
}

// ---------- Oberfläche ----------

async function aktualisiereOberflaeche(session) {
  fehler('');
  if (!session) {
    userId = null;
    zeige('login');
    return;
  }
  userId = session.user.id;
  zeige('profile');
  try {
    const profil = await ladeProfil(userId);
    zeigeAlias(profil.anzeigename);
    adminModus = await istAdmin();
    $('admin-hinweis').hidden = !adminModus;
    await route();
    starteLiveAktualisierung();
  } catch (e) {
    fehler(`Daten konnten nicht geladen werden: ${e.message}`);
  }
}

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = $('email').value.trim();
  $('login-status').textContent = 'Sende Link …';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  });
  $('login-status').textContent = error
    ? `Fehler: ${error.message}`
    : 'Prüfe dein Postfach. Der Link öffnet diese Seite.';
});

$('alias-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const alias = $('alias').value.trim().replace(/\s+/g, ' ');
  $('alias-status').textContent = '';

  if (!ALIAS_REGEL.test(alias)) {
    $('alias-status').textContent = 'Der Name passt nicht: 2 bis 20 Zeichen, nur Buchstaben, Ziffern, Leerzeichen, Punkt, Bindestrich oder Unterstrich.';
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ anzeigename: alias })
    .eq('id', userId);

  if (error) {
    $('alias-status').textContent = error.code === '23505'
      ? 'Dieser Name ist schon vergeben. Bitte wähle einen anderen.'
      : `Speichern fehlgeschlagen: ${error.message}`;
    return;
  }
  zeigeAlias(alias);
  $('alias-status').textContent = 'Gespeichert.';
});

$('logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  aktualisiereOberflaeche(session);
});

$('plan-zurueck').addEventListener('click', () => {
  history.pushState('', document.title, window.location.pathname + window.location.search);
  if (userId) route().catch(() => {});
});

window.addEventListener('hashchange', () => {
  if (userId) route().catch(() => {});
});

const { data: { session } } = await supabase.auth.getSession();
aktualisiereOberflaeche(session);
