# Scriptura

Aplicație web (PWA) cu traduceri ale Bibliei în paralel și secțiunea **Studii**: studiile biblice expozitive ale lui Ovi, câte unul pe capitol. Scopul este un studiu, cu reprezentarea lui vizuală, pentru fiecare dintre cele 1.189 de capitole; studiile se adaugă pe parcurs. Interfața și conținutul sunt în română. Tonul cerut: „inginer către inginer”, adică direct, precis, fără umplutură.

## Comenzi

```bash
node tools/build.mjs
```

```bash
node tools/serve.mjs
```

Build-ul verifică datele și se oprește la orice problemă. Rulează-l după orice modificare și verifică în browser (http://localhost:8080) ce se vede. Detaliile despre formate sunt în `README.md`.

## Structură

- `app/js/`: module ES fără framework. `app.js` (Biblia, rutare, comutatorul Biblia/Studii), `data.js` (traduceri și date încorporate), `search.js`, `render.js`, `notes.js` (pop-up-ul de versete, folosit și de studii și vizualizări), `tips.js` (tooltip-uri), `catalog.js` (catalogul și căutarea studiilor), `refs.js` (trimiteri din studii → pop-up), `vizcore.js` (registrul, panoul de detalii, evidențierea legată, zoom), `vizbook.js` (harta cărții, cronologia), `vizchapter.js` (harta capitolului, rețeaua de personaje și locuri, mărturiile istorice), `vizmap.js` (hărți), `visual.js` (alege desenul fiecărui bloc; tipurile vechi ale Faptelor), `editor.js` (editare și regenerare), `studies.js` (secțiunea Studii).
- `data/atlas/`: registrul comun (personaje, locuri, evenimente, imagini, harta). Formatul vizualizărilor: începutul lui `tools/visual-spec.mjs`.
- Importurile între module se scriu pe un singur rând (`import { a } from './x.js';`): `tools/build.mjs` le transformă în `Scriptura.html`. Un modul nou se adaugă în `MODULES`, în ordinea dependențelor.
- `data/studies/<COD>/`: `studies.json`, textele `.md`, vizualizările `.visual.json` și fișierele folosite de ele (de ex. `harta-med.json`).
- Rute: `#/JHN/3/16` (Biblia), `#/studii`, `#/studii/ROM` (o carte), `#/studii/ROM/2` (un studiu), `#/studii/ROM/2/2` (a doua parte), `#/studii/ROM/2/vizual`.

## Reguli de conținut (nenegociabile)

Proiectul e un studiu biblic baptist neoprotestant, cu reguli stricte de verificabilitate:

- **Textul biblic** vine doar din `data/translations/` (extras din PDF-urile Biblia-VDCC și Biblia-NTR ale utilizatorului). Nu scrie niciodată text biblic din memorie. Orice citat nou dintr-un studiu sau dintr-o vizualizare se verifică în date, cu un script, înainte de a fi pus în aplicație.
- **Studiile** din `data/studies` sunt preluate cuvânt cu cuvânt din conversațiile utilizatorului. Nu le rescrie, nu le rezuma și nu le „corecta”. Build-ul le transformă în HTML fără să le modifice textul (doar legăturile spre alte studii devin rute în aplicație).
- **Surse și linkuri:** nu genera linkuri și nu atribui afirmații fără o sursă reală. Unde ceva e deducție, marchează explicit („lectură de lucru”, „deducție”). Pozițiile disputate (de exemplu data și locul Galatenilor) se prezintă cu alternative.
- **Vizualizări:** etichetele și tooltip-urile au trimiteri verificate în VDCC. Numele de locuri urmează VDCC (Neapolis, Siracusa, Puzole). Cronologia: singura ancoră fixă e Galion (51–52, inscripția de la Delfi); restul datelor sunt aproximative și se prezintă ca atare.
- **Drepturi:** VDCC, NTR și studiile nu se publică (GitHub Pages public) fără acordul utilizatorului.

## Vizualizările (accentul aplicației)

Aplicația pune prezentarea vizuală înaintea textului. Standardul, verificat de build:
- **Carte** (`book.visual.json`): `book-map` (fluxul cărții, acoperirea pe capitole, rezumat de 30–40 de cuvinte pentru fiecare capitol; capitolele fără studiu au rezumat marcat `"status": "în lucru"`), `timeline` (verde doar când un izvor antic primar fixează data, altfel portocaliu; fiecare dată are sursă), `network` (personaje și locuri, cu legături spre alte cărți).
- **Capitol** (`<nume>.visual.json`): `chapter-map` (ideea principală și cum se leagă în capitol, carte și Biblie), `network`.
- **Ocazional**: `map` oriunde sunt călătorii sau evenimente legate de locuri (traseele se calculează realist, nu ca linii drepte), `history` (imagini cu licență liberă, prin `tools/commons.mjs`, cu sursă, autor și licență).

Textele vizualizărilor (rezumate, idei, legături, legende) se scriu în fișierele de date, nu în cod. Un tip nou de reprezentare se adaugă ca funcție de desen în `app/js/viz*.js` (întoarce `{ html, mount }`), în `RENDER` din `visual.js` și în `VISUAL_TYPES` (cu verificări) din `tools/visual-spec.mjs`.

## Cum adaugi un studiu

1. Pune fișierele în `data/studies/<COD>/`: partea principală `.md`, părțile suplimentare (`…-intrebari.md` etc.) și vizualizarea `.visual.json`.
2. Adaugă intrarea în `data/studies/<COD>/studies.json` (`chapter`, `date`, `title`, `summary`, `themes`, `parts`, `visual`, opțional `covers`). Actualizează rezumatul capitolului în `book.visual.json` și scoate `"status": "în lucru"`.
3. Adaugă în `data/atlas/` personajele, locurile, evenimentele și imaginile noi.
4. Rulează `node tools/build.mjs`, apoi `node tools/visuals.mjs stamp <COD> <capitol>` (și `book`), și deschide studiul în browser.

## Editare și regenerare

- Utilizatorul poate edita orice parte și orice vizualizare din aplicație (butonul „Editează”, prin `node tools/serve.mjs`). Modificările lui manuale se respectă.
- Când textul unui studiu se schimbă, vizualizarea devine „neactualizată”. „Regenerează” o pune în `data/studies/regenerate.json`; comanda `/regenerate-visuals` (`.claude/skills/regenerate-visuals/`) le reface.

## Design

- Paleta, fonturile și componentele sunt cele ale Scriptura (tokenurile din `:root` în `app/styles.css`). Orice culoare nouă primește o variantă pentru modul întunecat, în ambele blocuri (`prefers-color-scheme` și `[data-theme="dark"]`).
- Fără derulare orizontală pe telefon; diagramele se derulează în interiorul chenarului `.visbox`.
- Focus vizibil la tastatură; tooltip-urile apar și la focus; elementele clicabile din SVG au `role="button"` și `tabindex="0"`.
