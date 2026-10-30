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

- `app/js/`: module ES fără framework. `app.js` (Biblia, rutare, comutatorul Biblia/Studii), `data.js` (traduceri și date încorporate), `search.js`, `render.js`, `notes.js` (pop-up-ul de versete, folosit și de studii și vizualizări), `tips.js` (tooltip-uri), `catalog.js` (catalogul și căutarea studiilor), `refs.js` (trimiteri din studii → pop-up), `vizcore.js` (registrul, panoul de detalii, evidențierea legată, zoom), `vizbook.js` (harta cărții, cronologia), `vizchapter.js` (harta capitolului, rețeaua de personaje și locuri, mărturiile istorice), `vizmap.js` (hărți), `visual.js` (alege desenul fiecărui bloc; tipurile vechi ale Faptelor), `editor.js` (editare și regenerare; la studii titlul, rezumatul și eticheta părții), `lock.js` (tokenul GitHub criptat cu parola, dispozitive de încredere), `github.js` (citire, commit-uri și starea build-ului Pages prin API-ul GitHub), `studies.js` (secțiunea Studii), `comments.js` (comentariile la versete: clic dreapta / apăsare lungă, salvare prin `serve.mjs` sau API-ul GitHub, după deblocare), `studynotes.js` (notele King James Study Bible: încărcare, desen, vizualizatorul de imagini), `footnotes.js` (notele de după verset: comentarii, notele KJV și studiile care îl menționează).
- `data/comments/<COD>.json`: comentariile utilizatorului, `{ "c:v": [{ date, text }] }`. Sunt ale lui: nu le modifica. `tools/mentions.mjs` calculează la build ce versete menționează fiecare studiu, cu `findReferences`/`findVerses` din `refs.js`.
- `data/translations/nkjv/`: NKJV și notele NKJV Study Bible (`study/<COD>.json` pe verset, `study/<COD>.book.json` cu introducerea, „Sumar”, și inserțiile pe capitol, „Informații suplimentare”, `study/images/`), generate de `tools/import-nkjv.mjs` din PDF (`node tools/import-nkjv.mjs <pdf> GEN` importă o carte); formatul și verificarea în `tools/study-notes.mjs`. `study/index.json` este indexul notelor și inserțiilor (id stabil, versete, trimiteri; `verses` → `own`/`covers`/`cited`), de folosit de alte unelte. KJV Study Bible de dinainte (Geneza, cu notele traduse în română) e păstrată în `archive/kjv-liberty/`, în afara build-ului. Se refac doar cu importul, nu de mână; sunt protejate (doar uz personal, nu se publică). Traducerea în română: memoria `study/ro/<COD>.json`, prin `tools/translate-notes.mjs`; cuvintele biblice comentate (îngroșate) și citatele biblice sunt textul VDCC al versetului, verificat cu `tools/check-quotes.mjs` (toate cuvintele îngroșate trebuie să treacă); cuvântul KJV apare cursiv, în paranteză, doar unde nota discută traducerea engleză.
- `data/atlas/`: registrul comun (personaje, locuri, evenimente, imagini, harta). Formatul vizualizărilor: începutul lui `tools/visual-spec.mjs`.
- Importurile între module se scriu pe un singur rând (`import { a } from './x.js';`): `tools/build.mjs` le transformă în `Scriptura.html`. Un modul nou se adaugă în `MODULES`, în ordinea dependențelor.
- `data/studies/<COD>/`: `studies.json`, textele `.md`, vizualizările `.visual.json` și fișierele folosite de ele (de ex. `harta-med.json`).
- Rute: `#/JHN/3/16` (Biblia), `#/studii`, `#/studii/ROM` (o carte), `#/studii/ROM/2` (un studiu), `#/studii/ROM/2/2` (a doua parte), `#/studii/ROM/2/vizual`.

## Reguli de conținut (nenegociabile)

Proiectul e un studiu biblic baptist neoprotestant, cu reguli stricte de verificabilitate:

- **Textul biblic** vine doar din `data/translations/` (extras din PDF-urile Biblia-VDCC, Biblia-NTR și The New King James Version Study Bible ale utilizatorului). Nu scrie niciodată text biblic din memorie. Orice citat nou dintr-un studiu sau dintr-o vizualizare se verifică în date, cu un script, înainte de a fi pus în aplicație.
- **Studiile** din `data/studies` sunt preluate cuvânt cu cuvânt din conversațiile utilizatorului. Nu le rescrie, nu le rezuma și nu le „corecta”. Build-ul le transformă în HTML fără să le modifice textul (doar legăturile spre alte studii devin rute în aplicație).
- **Surse și linkuri:** nu genera linkuri și nu atribui afirmații fără o sursă reală. Unde ceva e deducție, marchează explicit („lectură de lucru”, „deducție”). Pozițiile disputate (de exemplu data și locul Galatenilor) se prezintă cu alternative.
- **Vizualizări:** etichetele și tooltip-urile au trimiteri verificate în VDCC. Numele de locuri urmează VDCC (Neapolis, Siracusa, Puzole). Cronologia: singura ancoră fixă e Galion (51–52, inscripția de la Delfi); restul datelor sunt aproximative și se prezintă ca atare.
- **Drepturi:** VDCC, NTR și studiile nu se publică (GitHub Pages public) fără acordul utilizatorului.

## Vizualizările (accentul aplicației)

Aplicația pune prezentarea vizuală înaintea textului. Standardul, verificat de build:
- **Carte** (`book.visual.json`): `book-map` (sus mesajul cărții în 100–150 de cuvinte, `about`; cele două jumătăți și 4–8 secțiuni cheie, `parts`, o structură simplificată; legături între capitole cu etichetă vizibilă de cel mult 5 cuvinte și explicație în panou; acoperirea pe capitole, rezumat de 30–40 de cuvinte pentru fiecare capitol; capitolele fără studiu au rezumat marcat `"status": "în lucru"`), `timeline` (verde doar când un izvor antic primar fixează data, altfel portocaliu; fiecare dată are sursă; pe lângă evenimentele cărții: profeții anterioare `prophecy` cu `fulfils`, împliniri ulterioare `fulfilment`, evenimente majore `major`; golurile de peste 40 de ani se comprimă), `network` (personaje și locuri, cu legături spre alte cărți; prorocii au `kind: "proroc"`; fiecare personaj are, unde se poate, `image`, un portret cu licență liberă, `kind: "portrait"` în `images.json`).
- **Capitol** (`<nume>.visual.json`): `chapter-map` (ideea principală și cum se leagă în capitol, carte și Biblie), `network`.
- **Ocazional**: `map` oriunde sunt călătorii sau evenimente legate de locuri (traseele se calculează realist, nu ca linii drepte; grupuri de trasee ca straturi, `layers`, de ex. valurile exilului și întoarcerile), `history` (imagini cu licență liberă, prin `tools/commons.mjs`, cu sursă, autor și licență).

- **General**: sub titlul fiecărui bloc, mesajul a ceea ce arată diagrama despre text (`message`, 30–90 de cuvinte, scris din datele vizualizării și din studiu; la harta cărții ține locul lui `about`); cum se citește fiecare bloc (100–150 de cuvinte, în panou, la butonul „?” de lângă titlu; `data/atlas/visual-help.json` pe tip sau `about` pe bloc); `note` și legendele apar dedesubt, cu litere mici; tranzițiile respectă `prefers-reduced-motion`.

Textele vizualizărilor (rezumate, idei, legături, legende) se scriu în fișierele de date, nu în cod. Un tip nou de reprezentare se adaugă ca funcție de desen în `app/js/viz*.js` (întoarce `{ html, mount }`), în `RENDER` din `visual.js` și în `VISUAL_TYPES` (cu verificări) din `tools/visual-spec.mjs`.

## Cum adaugi un studiu

1. Pune fișierele în `data/studies/<COD>/`: partea principală `.md`, părțile suplimentare (`…-intrebari.md` etc.) și vizualizarea `.visual.json`.
2. Adaugă intrarea în `data/studies/<COD>/studies.json` (`chapter`, `date`, `title`, `summary`, `themes`, `parts`, `visual`, opțional `covers`). Actualizează rezumatul capitolului în `book.visual.json` și scoate `"status": "în lucru"`.
3. Adaugă în `data/atlas/` personajele, locurile, evenimentele și imaginile noi.
4. Rulează `node tools/build.mjs`, apoi `node tools/visuals.mjs stamp <COD> <capitol>` (și `book`), și deschide studiul în browser.

## Editare și regenerare

- Utilizatorul poate edita orice parte și orice vizualizare din aplicație (butonul „Editează”: local prin `node tools/serve.mjs`, de oriunde prin GitHub după deblocarea cu parola). Modificările lui manuale se respectă.
- Când textul unui studiu se schimbă, vizualizarea devine „neactualizată”. „Regenerează” o pune în `data/studies/regenerate.json`; comanda `/regenerate-visuals` (`.claude/skills/regenerate-visuals/`) le reface.

## Design

- Paleta, fonturile și componentele sunt cele ale Scriptura (tokenurile din `:root` în `app/styles.css`). Orice culoare nouă primește o variantă pentru modul întunecat, în ambele blocuri (`prefers-color-scheme` și `[data-theme="dark"]`).
- Fără derulare orizontală pe telefon; diagramele se derulează în interiorul chenarului `.visbox`.
- Focus vizibil la tastatură; tooltip-urile apar și la focus; elementele clicabile din SVG au `role="button"` și `tabindex="0"`.
