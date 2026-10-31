// Importing a study from any device: the .md files and the entry in data/studies/<BOOK>/studies.json go to
// GitHub in one commit (Git Data API), once the lock is open (lock.js); the Pages workflow then rebuilds the site.
// The visual and the atlas entries are made later, on the computer (/regenerate-visuals).
import { $, esc } from './util.js';
import { books } from './data.js';
import { github, requireUnlock } from './lock.js';
import { commitFiles } from './github.js';

const today = () => new Date().toISOString().slice(0, 10);
const safeName = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^\w.-]/g, '').toLowerCase();
let files = [];   // [{ name, text, label }]

// Adds the new study to the book's list. Returns the new list, or throws an Error whose message is shown.
// list: the current studies.json ([] for a book without studies); entry: { chapter, date, title, summary, themes, parts }.
// replace: the study of the same chapter is swapped for the new one (its visual and covers are kept; its old
// files stay in the folder). Without it, anything that would replace an existing study or file is refused.
function mergeEntry(list, entry, replace) {
  const taken = list.find(s => s.chapter === entry.chapter || s.covers?.includes(entry.chapter));
  if (taken && !(replace && taken.chapter === entry.chapter))
    throw new Error(taken.chapter === entry.chapter
      ? `capitolul ${entry.chapter} are deja studiul „${taken.title}”; bifează „Înlocuiește” ca să-l schimbi`
      : `capitolul ${entry.chapter} e acoperit de studiul „${taken.title}” (capitolul ${taken.chapter})`);
  if (taken) {
    list = list.filter(s => s !== taken);
    entry = { ...entry, ...taken.visual && { visual: taken.visual }, ...taken.covers && { covers: taken.covers } };
  }
  const used = new Set(list.flatMap(s => s.parts.map(p => p.file)));
  const clash = entry.parts.find(p => used.has(p.file));
  if (clash) throw new Error(`fișierul ${clash.file} există deja; redenumește-l`);
  return [...list, entry].sort((a, b) => a.chapter - b.chapter);
}

// One commit with the .md files and studies.json, merged into the list as it is on GitHub at that moment.
const commit = (b, entry, replace, message) => commitFiles(async read => {
  const list = JSON.parse(await read(`data/studies/${b}/studies.json`) ?? '[]');
  return [
    ...files.map(f => ({ path: `data/studies/${b}/${f.name}`, text: f.text })),
    { path: `data/studies/${b}/studies.json`, text: JSON.stringify(mergeEntry(list, entry, replace), null, 2) + '\n' }
  ];
}, message);

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
  $('importReplace').checked = false;
  renderFiles();
  chapterLimit();
  status(github() ? '' : 'La trimitere se cere parola pentru GitHub.');
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
  if (!await requireUnlock()) { status('Trimiterea are nevoie de deblocare (parola pentru GitHub).', 'error'); return; }
  $('importSave').disabled = true;
  status('Se trimite pe GitHub…');
  try {
    const replace = $('importReplace').checked;
    await commit(b, entry, replace, `Studiu ${replace ? 'înlocuit' : 'importat'}: ${b} ${chapter}, ${entry.title}`);
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
