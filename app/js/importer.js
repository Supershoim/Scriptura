// Importing a study from any device: the .md files and the entry in data/studies/<BOOK>/studies.json go to
// GitHub in one commit (Git Data API), with the token kept for comments; the host then rebuilds the site.
// The visual and the atlas entries are made later, on the computer (/regenerate-visuals).
import { $, esc } from './util.js';
import { books } from './data.js';
import { github, fromBase64, GH_ERRORS, BRANCH } from './comments.js';

const today = () => new Date().toISOString().slice(0, 10);
const safeName = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^\w.-]/g, '').toLowerCase();
let files = [];   // [{ name, text, label }]

async function gh(path, init = {}) {
  const { repo, token } = github();
  const r = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    cache: 'no-store', ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  });
  return r;
}
const fail = r => new Error('GitHub: ' + (GH_ERRORS[r.status] || r.status));

// Adds the new study to the book's list. Returns the new list, or throws an Error whose message is shown.
// list: the current studies.json ([] for a book without studies); entry: { chapter, date, title, summary, themes, parts }.
function mergeEntry(list, entry) {
  // Safe default: refuse anything that would replace an existing study or file.
  const taken = list.find(s => s.chapter === entry.chapter || s.covers?.includes(entry.chapter));
  if (taken) throw new Error(`capitolul ${entry.chapter} are deja studiul „${taken.title}”`);
  const used = new Set(list.flatMap(s => s.parts.map(p => p.file)));
  const clash = entry.parts.find(p => used.has(p.file));
  if (clash) throw new Error(`fișierul ${clash.file} există deja; redenumește-l`);
  return [...list, entry].sort((a, b) => a.chapter - b.chapter);
}

// One commit with the .md files and studies.json; a push from another device in between is retried once.
async function commit(b, entry, message) {
  for (let attempt = 0; ; attempt++) {
    let r = await gh(`git/ref/heads/${BRANCH}`);
    if (!r.ok) throw fail(r);
    const head = (await r.json()).object.sha;
    r = await gh(`git/commits/${head}`);
    if (!r.ok) throw fail(r);
    const base = (await r.json()).tree.sha;
    r = await gh(`contents/data/studies/${b}/studies.json?ref=${head}`);
    if (!r.ok && r.status !== 404) throw fail(r);
    const list = r.ok ? JSON.parse(fromBase64((await r.json()).content)) : [];
    const next = mergeEntry(list, entry);
    const tree = [
      ...files.map(f => ({ path: `data/studies/${b}/${f.name}`, mode: '100644', type: 'blob', content: f.text })),
      { path: `data/studies/${b}/studies.json`, mode: '100644', type: 'blob', content: JSON.stringify(next, null, 2) + '\n' }
    ];
    r = await gh('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base, tree }) });
    if (!r.ok) throw fail(r);
    const treeSha = (await r.json()).sha;
    r = await gh('git/commits', { method: 'POST', body: JSON.stringify({ message, tree: treeSha, parents: [head] }) });
    if (!r.ok) throw fail(r);
    const sha = (await r.json()).sha;
    r = await gh(`git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha }) });
    if (r.ok) return;
    // 422: the branch moved (a comment saved meanwhile); start again from the new head, once.
    if (r.status !== 422 || attempt) throw fail(r);
  }
}

function status(html, kind = '') {
  $('importStatus').innerHTML = html;
  $('importStatus').className = 'edit-status ' + kind;
}

function renderFiles() {
  $('importFiles').innerHTML = files.map((f, i) =>
    `<li><code>${esc(f.name)}</code> <label class="field">Eticheta <input type="text" data-label="${i}" value="${esc(f.label)}"></label></li>`).join('');
}

function chapterLimit() {
  const book = books.find(b => b.id === $('importBook').value);
  $('importChapter').max = book?.chapters || 150;
}

export function openImport() {
  $('importBook').innerHTML = books.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  $('importDate').value = today();
  files = [];
  renderFiles();
  chapterLimit();
  status(github() ? '' : 'Adaugă întâi un token GitHub (în fereastra unui comentariu, „Salvare pe GitHub”).', github() ? '' : 'error');
  $('importDialog').showModal();
}

async function pick(e) {
  files = await Promise.all([...e.target.files].map(async (f, i) => ({
    name: safeName(f.name), text: (await f.text()).replace(/\r\n/g, '\n'),
    label: i ? f.name.replace(/\.md$/i, '') : 'Studiu complet'
  })));
  renderFiles();
}

async function submit() {
  if (!github()) { status('Lipsește tokenul GitHub.', 'error'); return; }
  const b = $('importBook').value, chapter = +$('importChapter').value;
  const entry = {
    chapter, date: $('importDate').value, title: $('importTitle').value.trim(), summary: $('importSummary').value.trim(),
    themes: $('importThemes').value.split(',').map(t => t.trim()).filter(Boolean),
    parts: files.map(f => ({ label: f.label.trim() || f.name, file: f.name }))
  };
  if (!files.length) { status('Alege cel puțin un fișier .md.', 'error'); return; }
  if (files.some(f => !/^[\w.-]+\.md$/.test(f.name))) { status('Fișierele trebuie să fie .md.', 'error'); return; }
  if (!entry.title || !entry.summary) { status('Completează titlul și rezumatul.', 'error'); return; }
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > +$('importChapter').max) { status('Capitolul nu există în această carte (0 = privire de ansamblu).', 'error'); return; }
  $('importSave').disabled = true;
  status('Se trimite pe GitHub…');
  try {
    await commit(b, entry, `Studiu importat: ${b} ${chapter}, ${entry.title}`);
    status('Trimis pe GitHub. Apare în aplicație după reconstruire (în jur de un minut); vizualizarea se face apoi pe calculator.', 'ok');
  } catch (e) {
    status('Nu s-a trimis: ' + esc(e.message), 'error');
  } finally {
    $('importSave').disabled = false;
  }
}

export function setupImport() {
  $('importOpen').addEventListener('click', openImport);
  $('importBook').addEventListener('change', chapterLimit);
  $('importPick').addEventListener('change', pick);
  $('importFiles').addEventListener('input', e => { const i = e.target.dataset.label; if (i != null) files[+i].label = e.target.value; });
  $('importSave').addEventListener('click', submit);
}
