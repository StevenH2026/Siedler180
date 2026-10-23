import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Muss zur Datenbank-Regel profiles_anzeigename_check passen.
const ALIAS_REGEL = /^[\p{L}\p{N}_ .-]{2,20}$/u;

const $ = (id) => document.getElementById(id);

function zeige(abschnitt) {
  $('login').hidden = abschnitt !== 'login';
  $('profile').hidden = abschnitt !== 'profile';
}

function fehler(text) {
  $('fehler').textContent = text;
  $('fehler').hidden = !text;
}

async function ladeProfil(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('anzeigename')
    .eq('id', userId)
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

async function aktualisiereOberflaeche(session) {
  fehler('');
  if (!session) {
    zeige('login');
    return;
  }
  try {
    const profil = await ladeProfil(session.user.id);
    zeigeAlias(profil.anzeigename);
    $('admin-hinweis').hidden = !(await istAdmin());
  } catch (e) {
    fehler(`Profil konnte nicht geladen werden: ${e.message}`);
  }
  zeige('profile');
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

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('profiles')
    .update({ anzeigename: alias })
    .eq('id', user.id);

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
