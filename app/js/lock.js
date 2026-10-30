// The lock in front of everything that writes to GitHub (comments, study edits, imports).
//
// The GitHub token is kept on the device only encrypted: PBKDF2 (600 000 rounds, SHA-256) turns the password
// into an AES-GCM key, which encrypts the token ("scriptura:lock" in localStorage). The password itself is
// never stored. On a trusted device the derived key is kept in IndexedDB as a non-extractable CryptoKey, so
// the page can decrypt on its own after a restart but no script can read the key out. On other devices the
// decrypted token lives only in memory, until the page is closed or reloaded.
// Real protection is the token's narrow scope (one repository, Contents: read and write): the password guards
// it on this device only.
import { $, esc, store } from './util.js';

export const DEFAULT_REPO = 'Supershoim/Scriptura';
const ROUNDS = 600000, MIN_PASSWORD = 8;
const DB = 'scriptura-lock', KEYS = 'keys', TRUSTED = 'trusted';

let creds = null;              // { repo, token } while unlocked
const listeners = new Set();   // called when the lock state changes
let pending = null;            // { resolve } of the unlock that requireUnlock() is waiting for

const bytes = s => new TextEncoder().encode(s);
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ---------- Key storage (IndexedDB holds the non-extractable key of a trusted device) ----------

function idb(mode, fn) {
  return new Promise((ok, fail) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(KEYS);
    open.onerror = () => fail(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(KEYS, mode), req = fn(tx.objectStore(KEYS));
      tx.oncomplete = () => { open.result.close(); ok(req?.result); };
      tx.onerror = () => { open.result.close(); fail(tx.error); };
    };
  });
}
const keyGet = () => idb('readonly', s => s.get(TRUSTED)).catch(() => null);
const keyPut = key => idb('readwrite', s => s.put(key, TRUSTED));
const keyDrop = () => idb('readwrite', s => s.delete(TRUSTED)).catch(() => {});

// ---------- Crypto ----------

async function derive(password, salt) {
  const base = await crypto.subtle.importKey('raw', bytes(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function decrypt(key, sealed) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.data));
  return new TextDecoder().decode(plain);
}

// ---------- State ----------

const sealed = () => store.get('lock', null);
export const isSetUp = () => !!sealed();
export const isUnlocked = () => !!creds;
export const isTrusted = async () => !!(await keyGet());
// The credentials for GitHub, or null while locked. Synchronous: callers that can wait use requireUnlock().
export const github = () => creds;
export const onLockChange = fn => listeners.add(fn);
const changed = () => listeners.forEach(fn => fn(!!creds));

function unlockWith(token) {
  creds = { repo: sealed()?.repo || DEFAULT_REPO, token };
  changed();
}

export function lockNow() {
  creds = null;
  changed();
}

// Removes the encrypted token and the trusted key: the device starts over with setup.
export async function forget() {
  store.set('lock', null);
  await keyDrop();
  lockNow();
}

// On start: a trusted device unlocks itself.
export async function restore() {
  const s = sealed(), key = s && await keyGet();
  if (!key) return;
  try { unlockWith(await decrypt(key, s)); } catch { await keyDrop(); }
}

// Resolves to the credentials, asking for the password (or setup) first if needed; null if the user gives up.
export function requireUnlock() {
  if (creds) return Promise.resolve(creds);
  return new Promise(resolve => { pending?.resolve(null); pending = { resolve }; openLock(); });
}

// Checks the token against GitHub before it is kept: it must be able to write into the repository.
async function checkToken(repo, token) {
  const r = await fetch(`https://api.github.com/repos/${repo}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r) return 'GitHub nu răspunde; verifică conexiunea.';
  if (r.status === 401) return 'Tokenul nu este valid sau a expirat.';
  if (r.status === 404) return `Depozitul ${repo} nu există sau tokenul nu are acces la el.`;
  if (!r.ok) return 'GitHub: ' + r.status;
  return (await r.json()).permissions?.push ? '' : 'Tokenul nu are dreptul de scriere (Contents: Read and write).';
}

async function setUp(repo, token, password, trusted) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes(token));
  store.set('lock', { v: 1, repo, salt: b64(salt), iv: b64(iv), data: b64(data) });
  store.set('github', null);   // the old plain-text token of the comments
  if (trusted) await keyPut(key); else await keyDrop();
  unlockWith(token);
}

async function unlock(password, trusted) {
  const s = sealed(), key = await derive(password, unb64(s.salt));
  const token = await decrypt(key, s);   // a wrong password fails here (OperationError)
  if (trusted) await keyPut(key); else await keyDrop();
  unlockWith(token);
}

// ---------- Dialog ----------

function status(html, kind = '') {
  $('lockStatus').innerHTML = html;
  $('lockStatus').className = 'edit-status ' + kind;
}

async function show() {
  const setup = !isSetUp(), open = isUnlocked(), legacy = store.get('github', null)?.token;
  $('lockSetup').hidden = !setup;
  $('lockUnlock').hidden = setup || open;
  $('lockOpen').hidden = !open;
  $('lockConfirmRow').hidden = !setup;
  $('lockPasswordRow').hidden = open;
  $('lockTrustedRow').hidden = open;
  $('lockGo').hidden = open;
  $('lockGo').textContent = setup ? 'Păstrează și deblochează' : 'Deblochează';
  $('lockForget').hidden = setup;
  $('lockNow').hidden = !open;
  $('lockPassword').value = $('lockConfirm').value = '';
  $('lockRepo').value = sealed()?.repo || store.get('github', null)?.repo || DEFAULT_REPO;
  $('lockToken').value = '';
  $('lockToken').placeholder = legacy ? 'Tokenul de la comentarii (va fi criptat)' : 'github_pat_…';
  const trusted = await isTrusted();
  $('lockTrusted').checked = trusted;
  $('lockState').textContent = open ? `Deblocat${trusted ? ' (dispozitiv de încredere)' : ' până la închiderea paginii'} · ${creds.repo}` : '';
}

export async function openLock() {
  status('');
  await show();
  if (!$('lockDialog').open) $('lockDialog').showModal();
  (isSetUp() ? $('lockPassword') : $('lockToken')).focus();
}

async function go() {
  const password = $('lockPassword').value, trusted = $('lockTrusted').checked;
  $('lockGo').disabled = true;
  try {
    if (!isSetUp()) {
      const repo = $('lockRepo').value.trim() || DEFAULT_REPO, token = $('lockToken').value.trim() || store.get('github', null)?.token || '';
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return status('Depozitul se scrie ca <code>utilizator/nume</code>.', 'error');
      if (!token) return status('Lipsește tokenul.', 'error');
      if (password.length < MIN_PASSWORD) return status(`Parola are cel puțin ${MIN_PASSWORD} caractere.`, 'error');
      if (password !== $('lockConfirm').value) return status('Cele două parole nu sunt la fel.', 'error');
      status('Se verifică tokenul pe GitHub…');
      const problem = await checkToken(repo, token);
      if (problem) return status(esc(problem), 'error');
      await setUp(repo, token, password, trusted);
    } else {
      if (!password) return status('Scrie parola.', 'error');
      status('Se deblochează…');
      try { await unlock(password, trusted); } catch { return status('Parola nu este corectă.', 'error'); }
    }
    $('lockDialog').close();
  } finally {
    $('lockGo').disabled = false;
  }
}

export function setupLock() {
  $('lockGo').addEventListener('click', go);
  for (const id of ['lockPassword', 'lockConfirm', 'lockToken']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  $('lockNow').addEventListener('click', async () => { lockNow(); await keyDrop(); await show(); status('Blocat. Dispozitivul nu mai este de încredere.', 'ok'); });
  $('lockForget').addEventListener('click', async () => {
    if (!confirm('Ștergi tokenul criptat de pe acest dispozitiv? Va trebui introdus din nou.')) return;
    await forget(); await show(); status('Tokenul a fost șters de pe acest dispozitiv.', 'ok');
  });
  // Whoever is waiting in requireUnlock() gets the result when the dialog closes, unlocked or not.
  $('lockDialog').addEventListener('close', () => { pending?.resolve(creds); pending = null; });
  restore();
}
