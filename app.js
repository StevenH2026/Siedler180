import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { planEvening } from './src/draw.js?v=2';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Muss zur Datenbank-Regel profiles_anzeigename_check passen.
const ALIAS_REGEL = /^[\p{L}\p{N}_ .-]{2,20}$/u;

// Teilnahme-Status: Schlüssel wie in der Datenbank, Beschriftung für die Oberfläche.
const TEILNAHME = [
  ['zugesagt', 'Ich bin dabei'],
  ['nur_equipment', 'Nur Equipment'],
  ['warteliste', 'Warteliste'],
  ['abgesagt', 'Abgesagt'],
];

const $ = (id) => document.getElementById(id);

let userId = null;
let adminModus = false;

function zeige(abschnitt) {
  const eingeloggt = abschnitt === 'profile';
  $('login').hidden = eingeloggt;
  $('profile').hidden = !eingeloggt;
  $('abende').hidden = !eingeloggt;
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
}

// ---------- Teilnahme ----------

async function ladeAbende() {
  const { data: abende, error } = await supabase
    .from('evenings')
    .select('id, datum, beginn_at, ort, boards, status, anmeldeschluss')
    .in('status', ['offen', 'geplant'])
    .order('beginn_at');
  if (error) throw error;

  const { data: teilnahmen, error: fehlerTeilnahmen } = await supabase
    .from('attendance')
    .select('evening_id, player_id, status, profiles(anzeigename)');
  if (fehlerTeilnahmen) throw fehlerTeilnahmen;

  const { data: spiele, error: fehlerSpiele } = await supabase
    .from('matches')
    .select('id, evening_id, group_name, runde, slot, spieler_a, spieler_b, legs_a, legs_b, eingetragen_von, bestaetigt_von, a:profiles!matches_spieler_a_fkey(anzeigename), b:profiles!matches_spieler_b_fkey(anzeigename)');
  if (fehlerSpiele) throw fehlerSpiele;

  return { abende, teilnahmen, spiele };
}

// ---------- Spielplan und Ergebnisse ----------

const ERGEBNISSE = [[2, 0], [2, 1], [1, 2], [0, 2]];

function zeichneSpielplan(spiele) {
  const bereich = document.createElement('div');
  bereich.className = 'spielplan';
  if (spiele.length === 0) return bereich;

  const titel = document.createElement('h3');
  titel.textContent = 'Spielplan';
  bereich.append(titel);

  const sortiert = spiele.slice().sort((x, y) => x.slot - y.slot || x.group_name.localeCompare(y.group_name));
  for (const spiel of sortiert) bereich.append(zeichneSpiel(spiel));
  return bereich;
}

function zeichneSpiel(spiel) {
  const beteiligt = userId === spiel.spieler_a || userId === spiel.spieler_b;
  const darfEintragen = beteiligt || adminModus;
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

  if (darfEintragen && (!bestaetigt || adminModus)) {
    const reihe = document.createElement('div');
    reihe.className = 'ergebnis-knoepfe';
    for (const [la, lb] of ERGEBNISSE) {
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.textContent = `${la}:${lb}`;
      if (spiel.legs_a === la && spiel.legs_b === lb) knopf.classList.add('aktiv');
      knopf.addEventListener('click', () => ergebnisSetzen(spiel.id, la, lb));
      reihe.append(knopf);
    }
    karte.append(reihe);
  }

  if (darfEintragen && spiel.legs_a !== null && !bestaetigt && spiel.eingetragen_von !== userId) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'sekundaer';
    knopf.textContent = 'Ergebnis bestätigen';
    knopf.addEventListener('click', () => ergebnisBestaetigen(spiel.id));
    karte.append(knopf);
  }
  return karte;
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

  const status = document.createElement('p');
  status.className = 'hinweis';
  status.textContent = `Zugesagt (${zugesagt.length}): ${zugesagt.map((z) => z.profiles?.anzeigename ?? 'Unbekannt').join(', ') || 'noch niemand'}`;
  karte.append(status);

  const knopfReihe = document.createElement('div');
  knopfReihe.className = 'knoepfe';
  for (const [schluessel, beschriftung] of TEILNAHME) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = beschriftung;
    knopf.disabled = !offen;
    knopf.setAttribute('aria-pressed', String(eigene?.status === schluessel));
    if (eigene?.status === schluessel) knopf.classList.add('aktiv');
    knopf.addEventListener('click', () => setzeTeilnahme(abend.id, schluessel));
    knopfReihe.append(knopf);
  }
  karte.append(knopfReihe);

  if (adminModus) {
    const aus = document.createElement('button');
    aus.type = 'button';
    aus.className = 'sekundaer';
    aus.textContent = 'Auslosen';
    aus.addEventListener('click', () => loseAus(abend));
    karte.append(aus);
  }

  if (!offen) {
    const zu = document.createElement('p');
    zu.className = 'hinweis';
    zu.textContent = 'Anmeldung geschlossen.';
    karte.append(zu);
  }

  karte.append(zeichneSpielplan(spiele.filter((s) => s.evening_id === abend.id)));
  return karte;
}

async function zeichneAbende() {
  // Erst laden, dann leeren und befüllen ohne weiteres await dazwischen.
  // Sonst können zwei gleichzeitige Aufrufe die Karten doppelt anhängen.
  const { abende, teilnahmen, spiele } = await ladeAbende();
  const liste = $('abend-liste');
  liste.replaceChildren();
  $('abende-leer').hidden = abende.length > 0;
  for (const abend of abende) {
    liste.append(zeichneAbend(abend, teilnahmen, spiele));
  }
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

async function setzeTeilnahme(evening_id, status) {
  $('abend-status').textContent = '';
  const { error } = await supabase
    .from('attendance')
    .upsert(
      { evening_id, player_id: userId, status, updated_at: new Date().toISOString() },
      { onConflict: 'evening_id,player_id' },
    );
  if (error) {
    $('abend-status').textContent = error.message.includes('row-level security')
      ? 'Die Anmeldung ist für diesen Abend geschlossen.'
      : `Speichern fehlgeschlagen: ${error.message}`;
    return;
  }
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
    await zeichneAbende();
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

const { data: { session } } = await supabase.auth.getSession();
aktualisiereOberflaeche(session);
