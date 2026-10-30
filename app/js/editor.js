// Editing studies and visuals, and asking for a visual to be regenerated.
//
// A study part opens with its title, summary and label (from data/studies/<BOOK>/studies.json) above the text;
// a visual opens as JSON. Saving goes, in this order:
//  1. through the local server (node tools/serve.mjs): it writes the file into data/, rebuilds, and puts the
//     old file back if the build finds a problem;
//  2. through GitHub, once the lock is open (lock.js): one commit with the changed files; the Pages workflow
//     rebuilds the site and publishes it only if the build passes, which the editor follows to the end.
// "Regenerează" adds the study to data/studies/regenerate.json; Claude Code redoes the queued visuals with
// /regenerate-visuals.
import { $, esc, toast, copyText } from './util.js';
import { github, requireUnlock, openLock } from './lock.js';
import { readFile, commitFiles, buildOf } from './github.js';

let server = null;   // Promise<boolean>: is the local editing server available?
export const hasServer = () => (server ??= location.protocol.startsWith('http')
  ? fetch('api/status').then(r => r.ok && r.json()).then(s => !!s?.edit).catch(() => false)
  : Promise.resolve(false));

// The bar above a visual: out-of-date notice, edit and regenerate.
export function toolbar({ id, visual, label }) {
  return `<div class="vis-tools">` +
    (visual.stale ? `<p class="stale"><strong>Neactualizat.</strong> Textul studiului s-a schimbat după ce a fost făcută ${esc(label)}. Părțile calculate (trasee, trimiteri) sunt la zi; ideea, legăturile și rezumatele trebuie refăcute.</p>` : '') +
    `<span class="spacer"></span><button type="button" class="ghost small" data-edit="${esc(visual.src)}" data-edit-title="Editează ${esc(label)}">Editează</button>` +
    `<button type="button" class="ghost small${visual.stale ? ' primary' : ''}" data-regen="${esc(id)}">Regenerează</button></div>`;
}

// current: { src, original, where: 'local' | 'github', study?: { list: path of studies.json, chapter, file, meta } }
// where meta is { title, summary, label } as it was when the editor opened.
let current = null;
const META = { title: 'editStudyTitle', summary: 'editSummary', label: 'editLabel' };
class Conflict extends Error {}

function showStatus(html, kind = '') {
  $('editStatus').innerHTML = html;
  $('editStatus').className = 'edit-status ' + kind;
}

// Reads a project file from wherever this editor saves.
async function load(path) {
  if (current.where === 'local') {
    const r = await fetch('api/file?path=' + encodeURIComponent(path));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await r.text());
    return r.text();
  }
  return (await readFile(path))?.text ?? null;
}

const metaOf = (entry, file) => ({ title: entry.title, summary: entry.summary, label: entry.parts.find(p => p.file === file)?.label ?? '' });
const metaNow = () => Object.fromEntries(Object.entries(META).map(([k, id]) => [k, $(id).value.trim()]));
const metaChanged = () => current.study && Object.keys(META).some(k => metaNow()[k] !== current.study.meta[k]);

// study: "ROM:4" for a part of the study of Romans 4, empty for a visual.
async function openEditor(src, title, study) {
  current = { src, original: '' };
  $('editTitle').textContent = title || 'Editează';
  $('editPath').textContent = src;
  $('editWhere').textContent = '';
  $('editText').value = '';
  $('editPreview').hidden = true;
  $('editText').hidden = false;
  $('editMeta').hidden = true;
  $('editTabs').hidden = !src.endsWith('.md');
  $('editTabs').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(!i)));
  $('editSave').disabled = true;
  showStatus('');
  $('editDialog').showModal();
  if (await hasServer()) current.where = 'local';
  else if (github() || await requireUnlock()) current.where = 'github';
  else {
    $('editText').hidden = true;
    $('editTabs').hidden = true;
    showStatus(`<p>Salvarea are nevoie de deblocare (parola pentru GitHub, butonul de mai jos) sau de Scriptura pornită pe calculatorul tău:</p>` +
      `<pre>node tools/serve.mjs</pre><p>Apoi deschide <code>http://localhost:8080</code> și apasă din nou „Editează”. Fișierul este <code>${esc(src)}</code>.</p>`, 'info');
    return;
  }
  $('editWhere').textContent = current.where === 'local' ? 'se salvează pe acest calculator' : `se salvează pe GitHub (${github().repo})`;
  showStatus('Se încarcă…');
  try {
    const text = await load(src);
    if (text === null) throw new Error('nu există ' + src);
    current.original = text;
    if (study) {
      const [b, c] = study.split(':'), list = `data/studies/${b}/studies.json`, file = src.split('/').pop();
      const entry = JSON.parse(await load(list) ?? '[]').find(s => s.chapter === +c);
      if (entry) {
        current.study = { list, chapter: +c, file, meta: metaOf(entry, file) };
        for (const [k, id] of Object.entries(META)) $(id).value = current.study.meta[k];
        $('editMeta').hidden = false;
      }
    }
    $('editText').value = text;
    $('editSave').disabled = false;
    showStatus(src.endsWith('.json') ? 'JSON: verificat la salvare, împreună cu toate trimiterile și legăturile.' : 'Markdown. Trimiterile biblice devin automat ferestre cu versetul.');
    (current.study ? $('editStudyTitle') : $('editText')).focus();
  } catch (e) {
    showStatus('Fișierul nu s-a putut deschide: ' + esc(e.message), 'error');
  }
}

// Problems to show before anything is saved: [{ level: 'error' | 'warn', text }]. An error stops the save;
// warnings are shown and the save goes ahead. meta is null for a visual.
function checkEdit({ src, text, meta }) {
  const problems = [];
  if (src.endsWith('.md') && !text.trim()) problems.push({ level: 'error', text: 'Textul este gol.' });
  const names = { title: 'Titlul', summary: 'Rezumatul', label: 'Eticheta părții' };
  for (const [k, name] of Object.entries(names)) if (meta && !meta[k]) problems.push({ level: 'error', text: `${name} nu poate fi gol.` });
  return problems;
}

// studies.json with this study's title, summary and part label replaced; everything else as it is on disk.
function withMeta(listText, meta) {
  const list = JSON.parse(listText), entry = list.find(s => s.chapter === current.study.chapter);
  if (!entry) throw new Error('studiul nu mai există în ' + current.study.list);
  Object.assign(entry, { title: meta.title, summary: meta.summary });
  const part = entry.parts.find(p => p.file === current.study.file);
  if (part) part.label = meta.label;
  return JSON.stringify(list, null, 2) + '\n';
}

async function saveLocal(text, meta) {
  const put = async (path, body) => {
    const res = await (await fetch('api/file?path=' + encodeURIComponent(path), { method: 'PUT', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body })).json();
    if (!res.ok) throw Object.assign(new Error('build'), { res });
    return res;
  };
  let stale = false;
  if (meta) await put(current.study.list, withMeta(await load(current.study.list), meta));
  if (text !== current.original) stale = (await put(current.src, text)).stale;
  showStatus(stale ? 'Salvat. Vizualizarea acestui studiu este acum neactualizată: o poți regenera.' : 'Salvat.', 'ok');
  setTimeout(() => location.reload(), 900);
}

async function saveGitHub(text, meta) {
  const label = current.study ? `${current.study.list.split('/')[2]} ${current.study.chapter}` : current.src;
  const { commit } = await commitFiles(async read => {
    const files = [];
    if (text !== current.original) {
      // Someone saved this file from another device since it was opened: do not overwrite their text.
      if (await read(current.src) !== current.original) throw new Conflict();
      files.push({ path: current.src, text });
    }
    if (meta) files.push({ path: current.study.list, text: withMeta(await read(current.study.list), meta) });
    return files;
  }, `Editare: ${label}${meta ? ' (titlu, rezumat, etichetă)' : ''}`);
  current.original = text;
  if (current.study && meta) current.study.meta = meta;
  watchBuild(commit);
}

// Follows the Pages build of the commit until it is published or fails (at most ~6 minutes).
async function watchBuild(commit) {
  const short = commit.slice(0, 7), actions = `https://github.com/${github().repo}/actions`;
  showStatus(`Salvat pe GitHub (commit <code>${short}</code>). Site-ul se reconstruiește…`, 'ok');
  for (let i = 0, seen = false; i < 36; i++) {
    await new Promise(ok => setTimeout(ok, 10000));
    const state = await buildOf(commit);
    seen ||= !!state;
    if (state === 'success') {
      showStatus(`Publicat (commit <code>${short}</code>). <button type="button" class="small" data-reload>Reîncarcă pagina</button>`, 'ok');
      return;
    }
    if (state === 'failure') {
      showStatus(`Salvat pe GitHub, dar build-ul a găsit probleme, așa că site-ul a rămas la versiunea anterioară. Detaliile: <a href="${actions}" target="_blank" rel="noopener">GitHub Actions</a>.`, 'error');
      return;
    }
    // Without Actions: read the run is never visible; say what to expect and stop asking.
    if (!seen && i === 5) {
      showStatus(`Salvat pe GitHub (commit <code>${short}</code>). Site-ul publicat îl arată după reconstruire, în jur de un minut.`, 'ok');
      return;
    }
  }
}

async function save() {
  if (!current?.where || $('editSave').disabled) return;
  const text = $('editText').value, meta = current.study ? metaNow() : null;
  if (current.src.endsWith('.json')) {
    try { JSON.parse(text); } catch (e) { showStatus('JSON invalid: ' + esc(e.message), 'error'); return; }
  }
  if (text === current.original && !metaChanged()) { $('editDialog').close(); return; }
  const problems = checkEdit({ src: current.src, text, meta });
  const list = problems.map(p => `<li>${esc(p.text)}</li>`).join('');
  if (problems.some(p => p.level === 'error')) { showStatus(`<strong>Nu s-a salvat:</strong><ul>${list}</ul>`, 'error'); return; }
  $('editSave').disabled = true;
  showStatus((list ? `<ul>${list}</ul>` : '') + (current.where === 'local' ? 'Se salvează și se reconstruiește aplicația…' : 'Se trimite pe GitHub…'));
  try {
    if (current.where === 'local') await saveLocal(text, metaChanged() ? meta : null);
    else await saveGitHub(text, metaChanged() ? meta : null);
  } catch (e) {
    if (e.res) showStatus(`<strong>Nu s-a salvat:</strong> build-ul a găsit probleme (fișierul a rămas cum era).<pre>${esc(e.res.problems || e.res.error || '')}</pre>`, 'error');
    else if (e instanceof Conflict) showStatus('<strong>Nu s-a salvat:</strong> fișierul a fost modificat de pe alt dispozitiv după ce l-ai deschis. Copiază-ți textul, închide și deschide din nou editorul.', 'error');
    else showStatus('Salvarea a eșuat: ' + esc(e.message), 'error');
  } finally {
    $('editSave').disabled = false;
  }
}

let markedLoaded = null;
const loadMarked = () => (markedLoaded ??= window.marked ? Promise.resolve() : new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = 'js/marked.min.js';
  s.onload = ok; s.onerror = fail;
  document.head.append(s);
}));

async function preview(on) {
  $('editTabs').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(on ? i === 1 : i === 0)));
  $('editText').hidden = on;
  $('editPreview').hidden = !on;
  if (!on) return;
  try { await loadMarked(); $('editPreview').innerHTML = window.marked.parse($('editText').value); }
  catch { $('editPreview').textContent = 'Previzualizarea nu este disponibilă.'; }
}

async function regenerate(id) {
  const command = `node tools/visuals.mjs queue add ${id}`;
  if (await hasServer()) {
    const r = await fetch('api/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    if (r?.ok) { toast(`${id} a fost pus în coada de regenerare. În Claude Code: /regenerate-visuals`); return; }
  }
  copyText(command);
  toast(`Comanda pentru coada de regenerare a fost copiată: ${command}. Apoi, în Claude Code: /regenerate-visuals`);
}

const unsaved = () => current?.where && ($('editText').value !== current.original || metaChanged());

export function setupEditor() {
  document.addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { openEditor(ed.dataset.edit, ed.dataset.editTitle, ed.dataset.study); return; }
    const rg = e.target.closest('[data-regen]');
    if (rg) regenerate(rg.dataset.regen);
  });
  $('editSave').addEventListener('click', save);
  $('editLock').addEventListener('click', openLock);
  $('editStatus').addEventListener('click', e => { if (e.target.closest('[data-reload]')) location.reload(); });
  $('editTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) preview(b.dataset.tab === 'preview'); });
  $('editDialog').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
  $('editText').addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && current?.src.endsWith('.json')) { e.preventDefault(); document.execCommand('insertText', false, '  '); }
  });
  $('editDialog').addEventListener('cancel', e => { if (unsaved() && !confirm('Renunți la modificări?')) e.preventDefault(); });
}
