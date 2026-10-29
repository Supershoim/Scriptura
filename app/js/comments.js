// Comments on verses: right click on a verse, or a long press on a touch screen, opens them.
//
// They live in data/comments/<BOOK>.json ({ "c:v": [{ date, text, t? }] }, canonical rows; see tools/comments.mjs).
// Without "t" a comment applies to all translations (shown after the leftmost column); with "t", to that one only.
// Saving goes, in this order:
//  1. through the local server (node tools/serve.mjs): the file is written into data/ and the app rebuilt;
//  2. through the GitHub API, with a fine-grained token entered once per device (only this repository,
//     Contents: read and write). Each save is a commit to data/comments/; GitHub Pages then rebuilds the site.
// With a token, comments are also read from GitHub, so a device sees the latest ones before the site is rebuilt.
import { $, esc, store } from './util.js';
import { parseKey, fetchJson, embeddedComments } from './data.js';
import { hasServer } from './editor.js';

const DEFAULT_REPO = 'Supershoim/Scriptura', BRANCH = 'main', MAX = 4000, PRESS_MS = 550;
const cache = new Map();   // book -> Promise<{ "c:v": [...] }>
let listed = null;         // Promise<Set>: books with comments in this build
let options = { verse: () => null, translations: () => [], onChange: () => {}, enabled: () => true };
let current = null;        // { canon, editing: index or -1 }

const today = () => new Date().toISOString().slice(0, 10);
const github = () => { const g = store.get('github', null); return g?.token ? { repo: g.repo || DEFAULT_REPO, token: g.token } : null; };
const fileOf = b => `data/comments/${b}.json`;
const sortVerses = data => Object.fromEntries(Object.entries(data).sort(([x], [y]) => {
  const [a, b] = x.split(':').map(Number), [c, d] = y.split(':').map(Number);
  return a - c || b - d;
}));
// The translation a comment applies to, as shown in the dialog.
export const scopeLabel = t => t ? (options.translations().find(m => m.id === t)?.abbreviation || t) : 'toate traducerile';
const json = data => JSON.stringify(sortVerses(data), null, 2) + '\n';

// ---------- GitHub ----------

const toBase64 = text => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

const GH_ERRORS = { 401: 'tokenul nu este valid sau a expirat', 403: 'tokenul nu are dreptul de scriere în acest depozit', 404: 'depozitul nu există sau tokenul nu are acces la el', 422: 'GitHub a refuzat fișierul' };

async function ghRequest(b, init = {}) {
  const { repo, token } = github();
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${fileOf(b)}${init.method ? '' : '?ref=' + BRANCH}`, {
    cache: 'no-store', ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  });
  return r;
}

// The file as it is now on GitHub: { data, sha } (sha null when the book has no comments yet).
async function ghRead(b) {
  const r = await ghRequest(b);
  if (r.status === 404) {
    // 404 also means "no access": the repository itself must be readable.
    const repo = await fetch(`https://api.github.com/repos/${github().repo}`, { headers: { Authorization: `Bearer ${github().token}` } });
    if (repo.ok) return { data: {}, sha: null };
  }
  if (!r.ok) throw new Error('GitHub: ' + (GH_ERRORS[r.status] || r.status));
  const file = await r.json();
  return { data: JSON.parse(fromBase64(file.content)), sha: file.sha };
}

async function ghWrite(b, edit, message) {
  for (let attempt = 0; ; attempt++) {
    const { data, sha } = await ghRead(b);
    const next = edit(data);
    const r = await ghRequest(b, { method: 'PUT', body: JSON.stringify({ message, content: toBase64(json(next)), branch: BRANCH, ...sha && { sha } }) });
    if (r.ok) return next;
    // 409: someone else saved in between (another device); read again and redo the change once.
    if (r.status !== 409 || attempt) throw new Error('GitHub: ' + (GH_ERRORS[r.status] || r.status));
  }
}

// ---------- Reading and saving ----------

function fromBuild(b) {
  const embedded = embeddedComments();
  if (embedded) return Promise.resolve(embedded[b] || {});
  listed ??= fetchJson('data/comments/index.json').then(list => new Set(list)).catch(() => new Set());
  return listed.then(set => set.has(b) ? fetchJson(fileOf(b)) : {});
}

export function forBook(b) {
  if (!cache.has(b)) {
    const p = github() ? ghRead(b).then(f => f.data).catch(() => fromBuild(b)) : fromBuild(b);
    cache.set(b, p);
    p.catch(() => cache.delete(b));
  }
  return cache.get(b);
}

export async function forVerse(canon) {
  const { b, c, v } = parseKey(canon);
  return (await forBook(b))[`${c}:${v}`] || [];
}

class NoStorage extends Error {}

// Applies edit(list) -> list to the verse's comments, on the freshest copy of the file. Returns where it was saved.
async function change(canon, edit, message) {
  const { b, c, v } = parseKey(canon), k = `${c}:${v}`;
  const apply = data => {
    const list = edit([...(data[k] || [])]);
    if (list.length) data[k] = list; else delete data[k];
    return sortVerses(data);
  };
  let saved, where;
  if (await hasServer()) {
    const url = 'api/file?path=' + encodeURIComponent(fileOf(b));
    const r = await fetch(url);
    saved = apply(r.ok ? JSON.parse(await r.text()) : {});
    const res = await (await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: json(saved) })).json();
    if (!res.ok) throw new Error(res.problems || res.error || 'build-ul a refuzat fișierul');
    where = 'local';
  } else if (github()) {
    saved = await ghWrite(b, apply, message);
    where = 'github';
  } else throw new NoStorage();
  cache.set(b, Promise.resolve(saved));
  options.onChange();
  return where;
}

// ---------- Dialog ----------

function status(html, kind = '') {
  $('commentStatus').innerHTML = html;
  $('commentStatus').className = 'edit-status ' + kind;
}

async function renderList() {
  const list = await forVerse(current.canon);
  $('commentList').innerHTML = list.map((c, i) =>
    `<li${i === current.editing ? ' class="editing"' : ''}><div class="comment-date">${esc(c.date)} · ${esc(scopeLabel(c.t))}</div><div class="comment-text">${esc(c.text)}</div>` +
    `<div class="comment-actions"><button type="button" class="ghost small" data-cedit="${i}">Editează</button><button type="button" class="ghost small" data-cdel="${i}">Șterge</button></div></li>`).join('');
  $('commentList').hidden = !list.length;
}

// The choices of "Se aplică la": all translations, or one of those shown (plus the comment's own, if hidden).
function fillScope(t = '') {
  const list = options.translations();
  const extra = t && !list.some(m => m.id === t) ? [{ id: t, abbreviation: t }] : [];
  $('commentScope').innerHTML = '<option value="">Toate traducerile</option>' +
    [...list, ...extra].map(m => `<option value="${esc(m.id)}">Doar ${esc(m.abbreviation)}</option>`).join('');
  $('commentScope').value = t;
}

function setEditing(i, text = '', t = '') {
  current.editing = i;
  fillScope(t);
  $('commentLabel').textContent = i < 0 ? 'Comentariu nou' : 'Editezi comentariul';
  $('commentText').value = text;
  $('commentSave').textContent = i < 0 ? 'Adaugă' : 'Salvează';
  $('commentCancel').hidden = i < 0;
  renderList();
}

function syncHint() {
  const g = store.get('github', null);
  $('ghRepo').value = g?.repo || DEFAULT_REPO;
  $('ghToken').value = '';
  $('ghToken').placeholder = g?.token ? 'Token păstrat pe acest dispozitiv' : 'github_pat_…';
  $('ghForget').hidden = !g?.token;
  $('commentWhere').textContent = g?.token ? `Se salvează în ${g.repo || DEFAULT_REPO} pe GitHub (sau local, cu node tools/serve.mjs).` : 'Se salvează local, cu node tools/serve.mjs, sau pe GitHub după ce adaugi un token (mai jos).';
}

export async function openComments(canon) {
  const verse = options.verse(canon);
  if (!verse) return;
  current = { canon, editing: -1 };
  $('commentTitle').textContent = verse.title;
  $('commentVerse').innerHTML = `${esc(verse.text)} <cite>${esc(verse.abbr)}</cite>`;
  status('');
  syncHint();
  setEditing(-1);
  $('commentDialog').showModal();
  // On phones the keyboard would cover the verse; focus the field only with a mouse or keyboard.
  if (matchMedia('(pointer: fine)').matches) $('commentText').focus();
}

async function save() {
  const text = $('commentText').value.replace(/\s+$/, '');
  if (!text.trim()) { status('Scrie comentariul înainte de a-l salva.', 'error'); return; }
  if (text.length > MAX) { status(`Comentariul are ${text.length} de caractere; cel mult ${MAX}.`, 'error'); return; }
  const i = current.editing, verse = options.verse(current.canon), t = $('commentScope').value;
  const scoped = ({ t: _, ...c }) => t ? { ...c, t } : c;
  $('commentSave').disabled = true;
  status('Se salvează…');
  try {
    const where = await change(current.canon, list => {
      if (i < 0) list.push(scoped({ date: today(), text }));
      else if (list[i]) list[i] = scoped({ ...list[i], text });
      return list;
    }, `${i < 0 ? 'Comentariu nou' : 'Comentariu modificat'}: ${verse?.title || current.canon}`);
    setEditing(-1);
    status(where === 'github' ? 'Salvat pe GitHub. Site-ul publicat îl arată după reconstruire (în jur de un minut).' : 'Salvat în data/comments.', 'ok');
  } catch (e) {
    if (e instanceof NoStorage) { $('commentSync').open = true; status('Comentariul nu s-a salvat: adaugă mai jos un token GitHub sau deschide aplicația cu <code>node tools/serve.mjs</code>. Textul a rămas în câmp.', 'error'); }
    else status('Nu s-a salvat: ' + esc(e.message), 'error');
  } finally {
    $('commentSave').disabled = false;
  }
}

async function remove(i) {
  const list = await forVerse(current.canon);
  if (!list[i] || !confirm('Ștergi comentariul?')) return;
  const target = list[i], verse = options.verse(current.canon);
  status('Se șterge…');
  try {
    // By content, not by position: the list on disk may have changed since it was shown.
    await change(current.canon, all => all.filter(c => c.date !== target.date || c.text !== target.text), `Comentariu șters: ${verse?.title || current.canon}`);
    setEditing(-1);
    status('Șters.', 'ok');
  } catch (e) {
    status(e instanceof NoStorage ? 'Nu se poate șterge fără token GitHub sau server local.' : 'Nu s-a șters: ' + esc(e.message), 'error');
  }
}

function saveToken() {
  const repo = $('ghRepo').value.trim() || DEFAULT_REPO, token = $('ghToken').value.trim(), old = store.get('github', null);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { status('Depozitul se scrie ca <code>utilizator/nume</code>.', 'error'); return; }
  store.set('github', { repo, token: token || old?.token || '' });
  cache.clear();
  syncHint();
  options.onChange();
  status(token || old?.token ? 'Păstrat pe acest dispozitiv.' : 'Depozitul a fost păstrat; lipsește tokenul.', 'ok');
}

// ---------- Gestures ----------

// Right click (mouse), the context-menu key, or a long press (touch) on a verse row. With comments switched
// off (options.enabled), the browser keeps its own menu.
function gestures(container) {
  const rowOf = target => target.closest?.('.row[data-k]');
  let timer = 0, start = null, pressed = false;
  const cancel = () => { clearTimeout(timer); start = null; };
  container.addEventListener('pointerdown', e => {
    pressed = false;
    if (e.pointerType !== 'touch' || !options.enabled() || !rowOf(e.target) || e.target.closest('button, a')) return;
    start = { x: e.clientX, y: e.clientY, row: rowOf(e.target) };
    timer = setTimeout(() => {
      pressed = true;
      getSelection()?.removeAllRanges();
      navigator.vibrate?.(12);
      openComments(start.row.dataset.k);
      start = null;
    }, PRESS_MS);
  });
  container.addEventListener('pointermove', e => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); });
  for (const type of ['pointerup', 'pointercancel']) container.addEventListener(type, cancel);
  // The click that ends a long press must not also select the verse or open a reference.
  container.addEventListener('click', e => { if (pressed) { pressed = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  container.addEventListener('contextmenu', e => {
    const row = rowOf(e.target);
    if (!row || !options.enabled()) return;
    // Touch: the long press above handles it; the browser's own menu would compete with it.
    if (start || pressed) { e.preventDefault(); return; }
    // With text selected in the verse, the browser's menu stays (to copy it).
    const sel = getSelection();
    if (sel && !sel.isCollapsed && row.contains(sel.anchorNode)) return;
    e.preventDefault();
    openComments(row.dataset.k);
  });
}

export function setupComments(container, opts) {
  options = { ...options, ...opts };
  gestures(container);
  $('commentSave').addEventListener('click', save);
  $('commentCancel').addEventListener('click', () => { setEditing(-1); status(''); });
  $('commentText').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) { e.preventDefault(); save(); } });
  $('commentList').addEventListener('click', async e => {
    const ed = e.target.closest('[data-cedit]'), del = e.target.closest('[data-cdel]');
    if (ed) { const i = +ed.dataset.cedit, c = (await forVerse(current.canon))[i]; setEditing(i, c?.text || '', c?.t || ''); $('commentText').focus(); }
    if (del) remove(+del.dataset.cdel);
  });
  $('ghSave').addEventListener('click', saveToken);
  $('ghForget').addEventListener('click', () => { store.set('github', { repo: $('ghRepo').value.trim() || DEFAULT_REPO, token: '' }); cache.clear(); syncHint(); options.onChange(); status('Tokenul a fost șters de pe acest dispozitiv.', 'ok'); });
  $('commentDialog').addEventListener('cancel', e => {
    const text = $('commentText').value.trim();
    if (text && !confirm('Renunți la comentariul nescris?')) e.preventDefault();
  });
}
