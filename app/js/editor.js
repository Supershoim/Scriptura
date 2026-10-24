// Editing studies and visuals, and asking for a visual to be regenerated.
//
// Saving needs the local server (node tools/serve.mjs): it writes the file into data/, rebuilds, and puts the
// old file back if the build finds a problem. On the published site and in the offline file the editor
// explains how to edit locally. "Regenerează" adds the study to data/studies/regenerate.json; Claude Code
// redoes the queued visuals with /regenerate-visuals.
import { $, esc, toast, copyText } from './util.js';

let server = null;   // Promise<boolean>: is the local editing server available?
const hasServer = () => (server ??= location.protocol.startsWith('http')
  ? fetch('api/status').then(r => r.ok && r.json()).then(s => !!s?.edit).catch(() => false)
  : Promise.resolve(false));

// The bar above a visual: out-of-date notice, edit and regenerate.
export function toolbar({ id, visual, label }) {
  return `<div class="vis-tools">` +
    (visual.stale ? `<p class="stale"><strong>Neactualizat.</strong> Textul studiului s-a schimbat după ce a fost făcută ${esc(label)}. Părțile calculate (trasee, trimiteri) sunt la zi; ideea, legăturile și rezumatele trebuie refăcute.</p>` : '') +
    `<span class="spacer"></span><button type="button" class="ghost small" data-edit="${esc(visual.src)}" data-edit-title="Editează ${esc(label)}">Editează</button>` +
    `<button type="button" class="ghost small${visual.stale ? ' primary' : ''}" data-regen="${esc(id)}">Regenerează</button></div>`;
}

let current = null;   // { src, original }

function showStatus(html, kind = '') {
  $('editStatus').innerHTML = html;
  $('editStatus').className = 'edit-status ' + kind;
}

async function openEditor(src, title) {
  current = { src, original: '' };
  $('editTitle').textContent = title || 'Editează';
  $('editPath').textContent = src;
  $('editText').value = '';
  $('editPreview').hidden = true;
  $('editText').hidden = false;
  $('editTabs').hidden = !src.endsWith('.md');
  $('editTabs').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(!i)));
  showStatus('');
  $('editDialog').showModal();
  if (!await hasServer()) {
    $('editText').hidden = true;
    $('editTabs').hidden = true;
    $('editSave').disabled = true;
    showStatus(`<p>Editarea scrie direct în fișierele proiectului, așa că funcționează doar când Scriptura rulează pe calculatorul tău:</p>` +
      `<pre>node tools/serve.mjs</pre><p>Apoi deschide <code>http://localhost:8080</code> și apasă din nou „Editează”. Fișierul este <code>${esc(src)}</code>.</p>`, 'info');
    return;
  }
  $('editSave').disabled = false;
  showStatus('Se încarcă…');
  try {
    const r = await fetch('api/file?path=' + encodeURIComponent(src));
    if (!r.ok) throw new Error(await r.text());
    current.original = await r.text();
    $('editText').value = current.original;
    showStatus(src.endsWith('.json') ? 'JSON: verificat la salvare, împreună cu toate trimiterile și legăturile.' : 'Markdown. Trimiterile biblice devin automat ferestre cu versetul.');
    $('editText').focus();
  } catch (e) {
    showStatus('Fișierul nu s-a putut deschide: ' + esc(e.message), 'error');
  }
}

async function save() {
  const text = $('editText').value;
  if (current.src.endsWith('.json')) {
    try { JSON.parse(text); } catch (e) { showStatus('JSON invalid: ' + esc(e.message), 'error'); return; }
  }
  if (text === current.original) { $('editDialog').close(); return; }
  $('editSave').disabled = true;
  showStatus('Se salvează și se reconstruiește aplicația…');
  try {
    const r = await fetch('api/file?path=' + encodeURIComponent(current.src), { method: 'PUT', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: text });
    const res = await r.json();
    if (!res.ok) {
      showStatus(`<strong>Nu s-a salvat:</strong> build-ul a găsit probleme (fișierul a rămas cum era).<pre>${esc(res.problems || res.error || '')}</pre>`, 'error');
      $('editSave').disabled = false;
      return;
    }
    showStatus(res.stale ? 'Salvat. Vizualizarea acestui studiu este acum neactualizată: o poți regenera.' : 'Salvat.', 'ok');
    setTimeout(() => location.reload(), 900);
  } catch (e) {
    showStatus('Salvarea a eșuat: ' + esc(e.message), 'error');
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

export function setupEditor() {
  document.addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { openEditor(ed.dataset.edit, ed.dataset.editTitle); return; }
    const rg = e.target.closest('[data-regen]');
    if (rg) regenerate(rg.dataset.regen);
  });
  $('editSave').addEventListener('click', save);
  $('editTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) preview(b.dataset.tab === 'preview'); });
  $('editText').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    if (e.key === 'Tab' && !e.shiftKey && current?.src.endsWith('.json')) { e.preventDefault(); document.execCommand('insertText', false, '  '); }
  });
  $('editDialog').addEventListener('cancel', e => { if ($('editText').value !== current?.original && !confirm('Renunți la modificări?')) e.preventDefault(); });
}
