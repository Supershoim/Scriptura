# Scriptura — Biblia în paralel

Aplicație web pentru citirea mai multor traduceri ale Bibliei alăturat, verset cu verset, cu căutare și cu trimiterile tipărite afișate ca ferestre mici (pop-up). Secțiunea **Studii** adaugă studiile biblice expozitive, câte unul pe capitol (scopul: toate cele 1.189 de capitole), prezentate în primul rând vizual: harta cărții, cronologia, harta fiecărui capitol, personaje și locuri, hărți și mărturii istorice, cu textul complet al studiului alături. Funcționează pe calculator, telefon și tabletă; instalată de pe site, merge și fără internet.

## Structură

| Folder | Conținut |
|---|---|
| `data/` | Textele canonice. `books.json` (cele 66 de cărți, coduri USFM, abrevieri) și câte un folder pentru fiecare traducere în `data/translations/<id>/`. |
| `data/studies/` | Studiile, câte un folder pe carte (`data/studies/ROM/`): `studies.json`, textele `.md` și vizualizările `.visual.json` (inclusiv `book.visual.json` pentru carte). |
| `data/atlas/` | Registrul comun al vizualizărilor: personaje, locuri, evenimente datate, imagini istorice și harta. |
| `app/` | Aplicația: HTML, CSS și module JavaScript simple, fără framework. |
| `tools/` | `build.mjs` (construiește `dist/`), `validate.mjs`, `studies.mjs` (verifică și construiește studiile), `visual-spec.mjs` (formatul și verificarea vizualizărilor), `atlas.mjs` (registrul), `routes.mjs` (trasee realiste), `visuals.mjs` (stare, ștampilare, coada de regenerare), `commons.mjs` (imagini), `make-map.mjs` (harta), `serve.mjs` (previzualizare locală și editare), `import-tsv.mjs` (traducere nouă), `import-legacy.mjs` și `import-studies.mjs` (conversii unice din aplicațiile precedente), `vendor/marked.min.js` (Markdown → HTML). |
| `work/` | Aplicația precedentă și scripturile de extragere din PDF, păstrate ca referință. |
| `.github/workflows/pages.yml` | Publicare automată pe GitHub Pages la fiecare `git push`. |

## Construire și previzualizare

Necesită Node.js 20 sau mai nou. Nu există dependențe npm.

```bash
node tools/build.mjs
```

```bash
node tools/serve.mjs
```

Apoi deschide http://localhost:8080. `build.mjs` verifică datele, apoi scrie în `dist/`:
- site-ul instalabil (manifest, service worker pentru offline, textele ca fișiere JSON separate, încărcate doar pentru traducerile afișate);
- `Scriptura.html`, un singur fișier cu tot conținutul, care se poate copia pe orice dispozitiv și deschide fără internet.

Local, service worker-ul este oprit ca să nu rămână fișiere vechi în cache în timpul lucrului; adaugă `?sw` la adresă pentru a-l testa.

## Formatul unei traduceri

`data/translations/<id>/`:

- **`translation.json`**: `id`, `abbreviation`, `name`, `description`, `language`, `color` (pentru insignă), `order` (ordinea implicită a coloanelor), `source`, `copyright`, `notes` (opțional, descrierea trimiterilor) și `alignment`.
- **`text.json`**: `{ "GEN": [ [ "v1", "v2", … ], …capitole ], … }`. Versetul *n* este la poziția *n−1*; `null` marchează un verset lipsă. Cărțile absente sunt permise (de ex. doar Noul Testament).
- **`notes.json`** (opțional): trimiterile, pe verset: `{ "JHN 3:16": [ { "at": 7, "text": "*Rom. 5.8. 1 Ioan 4.9.", "links": [ { "s": 1, "e": 9, "to": [["ROM", 5, [8]]] } ] } ] }`. `at` este poziția din textul versetului unde apare grupul, `s`/`e` delimitează referința în `text`, iar `to` indică versetele (o listă goală de versete înseamnă tot capitolul).

### Numerotare diferită (`alignment`)

Fiecare traducere își păstrează numerotarea proprie. Rândurile afișate sunt aliniate pe conținut prin:

- `map`: verset propriu → rândul pe care se afișează (`"2CO 13:13": "2CO 13:14"`). Mai multe versete pot fi pe același rând.
- `spans`: verset propriu → ultimul verset pe care îl cuprinde (`"PHP 1:29": "PHP 1:30"`). Rândurile cuprinse primesc automat o explicație.
- `gaps`: explicație pentru un rând fără text în această traducere (`"REV 12:18": "…"`).
- `notices`: mesaj afișat deasupra unui capitol (`"PHP 1": "…"`).

## Adăugarea unei traduceri

1. Pregătește un fișier text cu câte un verset pe rând, separat prin Tab: `JHN	3	16	Fiindcă atât de mult…` (codurile cărților sunt în `data/books.json`).
2. Rulează `node tools/import-tsv.mjs fisier.tsv kjv "KJV" "King James Version"`.
3. Completează `data/translations/kjv/translation.json` (sursă, drepturi, diferențe de numerotare).
4. Rulează `node tools/build.mjs`. Validatorul semnalează orice problemă. Noua traducere apare în fereastra „Traduceri”.

## Studiile

Fiecare carte are un folder `data/studies/<COD>/` (codurile din `data/books.json`). În `studies.json` e câte o intrare pe capitol; `chapter: 0` este privirea de ansamblu a cărții:

```json
{
  "chapter": 2,
  "date": "2026-10-17",
  "title": "Romani 2: judecătorul religios fără scuză",
  "summary": "…",
  "themes": ["judecată", "lege naturală"],
  "parts": [
    { "label": "Studiu complet", "file": "romani-02.md" },
    { "label": "Întrebări punctuale", "file": "romani-02-intrebari.md" }
  ],
  "visual": "romani-02.visual.json"
}
```

- `covers` (opțional): capitolele cuprinse de același studiu, de ex. `[9, 10]`.
- Părțile sunt Markdown. Trimiterile biblice din text („Fapte 17:31”, „2:16”, „v. 4-5”) devin automat pop-up-uri cu versetul. Legăturile spre alt studiu se scriu `[Romani capitolul 1](Romani%20capitolul%201.md)` sau `[…](Romani%20privire%20de%20ansamblu.md)`.
- `visual`: vizualizarea capitolului (vezi mai jos). Studiul se deschide pe ea; textul este în filele de lângă.

### Vizualizările

Aplicația pune accentul pe prezentarea vizuală. Fiecare carte are o vizualizare (`data/studies/<COD>/book.visual.json`), iar fiecare studiu de capitol pe a lui (`<nume>.visual.json`). O vizualizare este o listă de blocuri `{ "type", "title", "note", "data" }`; formatul fiecărui tip este descris la începutul lui `tools/visual-spec.mjs`. Exemplul complet este cartea Daniel.

| Nivel | Obligatoriu | Ocazional |
|---|---|---|
| Carte | `book-map` (secțiunile cărții, capitolele cu stadiul studiului și un rezumat de 30–40 de cuvinte, legăturile dintre capitole), `timeline` (verde: dată fixată de un izvor antic primar; portocaliu: aproximativă; sursa sub fiecare eveniment), `network` (personaje și locuri) | `map`, `history` |
| Capitol | `chapter-map` (ideea principală, secțiunile capitolului, legăturile în carte și în restul Bibliei), `network` (personaje și locuri, cu alte cărți în care apar) | `map` (călătorii, evenimente legate de locuri), `history` (imagini cu locuri și scrieri antice) |

Tot ce se poate da clic (personaje, locuri, evenimente, imagini, capitole, secțiuni) deschide un panou cu detalii, versete (ca ferestre pop-up) și locurile în care mai apare; elementele legate se evidențiază în toate diagramele. Diagramele se pot mări (butoanele +/−, Ctrl+rotiță, două degete).

Registrul comun, pentru toată Biblia, este în `data/atlas/`: `people.json`, `places.json` (cu coordonate), `events.json` (cu dată, siguranță și sursă), `images.json` cu fișierele în `images/` (doar imagini cu licență liberă, cu autor, licență și pagina sursă) și `maps/near-east.json` (uscatul și râurile, Natural Earth). Traseele de pe hărți nu sunt linii drepte: build-ul le calculează (`tools/routes.mjs`) pe uscat de-a lungul văilor râurilor, cu traversări scurte de ape, și pe mare de-a lungul coastelor; aplicația le desenează ca linii curbe.

Unelte:
- `node tools/commons.mjs search "…"` / `fetch <id> "File:…"`: caută și descarcă imagini de pe Wikimedia Commons (doar licențe libere).
- `node tools/visuals.mjs status`: ce studii au vizualizare, care sunt neactualizate sau incomplete.
- `node tools/visuals.mjs stamp <COD> [capitol|book]`: notează textul din care s-a făcut vizualizarea.
- `node tools/make-map.mjs`: regenerează harta (o singură dată).

### Editare și regenerare

Fiecare parte a unui studiu și fiecare vizualizare are butonul **Editează**. Salvarea funcționează când aplicația rulează local cu `node tools/serve.mjs`: fișierul se scrie în `data/`, aplicația se reconstruiește, iar dacă build-ul găsește o problemă fișierul revine la forma dinainte și problema este afișată. Pe site-ul publicat și în fișierul offline butonul explică pașii.

Fiecare vizualizare reține amprenta textului din care a fost făcută. Când textul studiului se schimbă, vizualizarea apare ca **neactualizată**. Părțile calculate (trasee, trimiteri, numărători) se refac singure; ideea principală, legăturile și rezumatele se refac cu **Regenerează**, care pune studiul în coada `data/studies/regenerate.json`, iar apoi în Claude Code cu comanda `/regenerate-visuals`.

### Adăugarea unui studiu

1. Pune fișierele `.md` și `.visual.json` în `data/studies/<COD>/`.
2. Adaugă intrarea în `studies.json` (creează fișierul, cu `[ … ]`, la prima carte nouă) și scoate `"status": "în lucru"` din rezumatul capitolului în `book.visual.json`.
3. Rulează `node tools/build.mjs`, apoi `node tools/visuals.mjs stamp <COD> <capitol>`. Build-ul se oprește la orice problemă: câmp lipsă, capitol inexistent sau deja studiat, fișier negăsit sau nefolosit, trimitere biblică inexistentă, rezumat în afara a 30–40 de cuvinte, personaj, loc, eveniment sau imagine care lipsește din registru, eveniment fără sursă.

Build-ul transformă textele în HTML, scrie catalogul (`data/studies/index.json`) și un index de cuvinte împărțit după primele două litere (`data/studies/search/`). Căutarea descarcă doar bucățile de care are nevoie, așa că rămâne rapidă și cu un studiu pe fiecare capitol.

## Publicare (GitHub Pages)

1. Creează un depozit pe GitHub și urcă proiectul (`git push`) pe ramura `main`.
2. În depozit: *Settings → Pages → Source: GitHub Actions*.
3. Fiecare `push` reconstruiește și publică site-ul. Pe telefon, deschide adresa și alege „Adaugă pe ecranul principal” / „Instalează aplicația”.

**Atenție la drepturi:** pe planul gratuit GitHub, depozitele publicate cu Pages sunt publice. VDCC și NTR sunt protejate de drepturi de autor, iar studiile ar deveni și ele publice. Cere permisiunea titularilor înainte de publicare sau folosește un depozit privat cu un plan care permite Pages private.

## Validare

Textele provin din aceeași extragere ca aplicația precedentă: 31.102 versete pentru fiecare traducere și 61.331 de trimiteri VDCC. Verificat în browser: lectura în paralel, alinierea pentru 2 Corinteni 13, 3 Ioan, Filipeni 1 și Apocalipsa 12, pop-up-urile la hover și la atingere, comutarea traducerii în pop-up, căutarea (cuvinte, expresii, referințe), copierea capitolului fără trimiteri, alegerea și ordonarea traducerilor, temele, afișarea pe telefon și fișierul `Scriptura.html` fără rețea.

Studiile (135, din 14 cărți) sunt copiate octet cu octet din Biblioteca Studiu Biblic. Verificat în browser: catalogul și progresul, căutarea după cuvânt, temă și trimitere (cu fragmente), cititorul cu părți și cuprins, pop-up-urile trimiterilor din studii, legăturile Biblie ↔ studiu, vizualizarea Faptelor Apostolilor, afișarea pe telefon și `Scriptura.html` fără nicio cerere de rețea. Service worker-ul nu a putut fi încercat în panoul de browser folosit (nu permite service workers, nici pentru versiunea anterioară); s-a verificat doar că toate fișierele din lista lui de precache există.
