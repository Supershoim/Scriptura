# Scriptura — Biblia în paralel

Aplicație web pentru citirea mai multor traduceri ale Bibliei alăturat, verset cu verset, cu căutare și cu trimiterile tipărite afișate ca ferestre mici (pop-up). Secțiunea **Studii** adaugă studiile biblice expozitive, câte unul pe capitol (scopul: toate cele 1.189 de capitole), fiecare cu părțile lui și cu o reprezentare vizuală. Funcționează pe calculator, telefon și tabletă; instalată de pe site, merge și fără internet.

## Structură

| Folder | Conținut |
|---|---|
| `data/` | Textele canonice. `books.json` (cele 66 de cărți, coduri USFM, abrevieri) și câte un folder pentru fiecare traducere în `data/translations/<id>/`. |
| `data/studies/` | Studiile, câte un folder pe carte (`data/studies/ROM/`): `studies.json`, textele `.md` și vizualizările `.visual.json`. |
| `app/` | Aplicația: HTML, CSS și module JavaScript simple, fără framework. |
| `tools/` | `build.mjs` (construiește `dist/`), `validate.mjs`, `studies.mjs` (verifică și construiește studiile), `serve.mjs` (previzualizare locală), `import-tsv.mjs` (traducere nouă), `import-legacy.mjs` și `import-studies.mjs` (conversii unice din aplicațiile precedente), `vendor/marked.min.js` (Markdown → HTML, folosit doar la build). |
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
- `visual` (opțional, dar fiecare studiu ar trebui să aibă unul): `{ "blocks": [ { "type", "title", "note", "data" } ] }`, afișat în fila „Vizual”. Tipuri: `chapters` (o coloană pe capitol), `flow` (firul cărții), `causal` (cauze și urmări), `journeys` (hartă, axa timpului, epistole). Exemplu complet: `data/studies/ACT/fapte-00.visual.json`. Un tip nou se adaugă în `app/js/visual.js` și în `VISUAL_TYPES` din `tools/studies.mjs`.

### Adăugarea unui studiu

1. Pune fișierele `.md` (și `.visual.json`) în `data/studies/<COD>/`.
2. Adaugă intrarea în `studies.json` (creează fișierul, cu `[ … ]`, la prima carte nouă).
3. Rulează `node tools/build.mjs`. Build-ul se oprește la orice problemă: câmp lipsă, capitol inexistent sau deja studiat, fișier negăsit, fișier nefolosit, legătură spre un studiu necunoscut, tip de vizualizare necunoscut.

Build-ul transformă textele în HTML, scrie catalogul (`data/studies/index.json`) și un index de cuvinte împărțit după primele două litere (`data/studies/search/`). Căutarea descarcă doar bucățile de care are nevoie, așa că rămâne rapidă și cu un studiu pe fiecare capitol.

## Publicare (GitHub Pages)

1. Creează un depozit pe GitHub și urcă proiectul (`git push`) pe ramura `main`.
2. În depozit: *Settings → Pages → Source: GitHub Actions*.
3. Fiecare `push` reconstruiește și publică site-ul. Pe telefon, deschide adresa și alege „Adaugă pe ecranul principal” / „Instalează aplicația”.

**Atenție la drepturi:** pe planul gratuit GitHub, depozitele publicate cu Pages sunt publice. VDCC și NTR sunt protejate de drepturi de autor, iar studiile ar deveni și ele publice. Cere permisiunea titularilor înainte de publicare sau folosește un depozit privat cu un plan care permite Pages private.

## Validare

Textele provin din aceeași extragere ca aplicația precedentă: 31.102 versete pentru fiecare traducere și 61.331 de trimiteri VDCC. Verificat în browser: lectura în paralel, alinierea pentru 2 Corinteni 13, 3 Ioan, Filipeni 1 și Apocalipsa 12, pop-up-urile la hover și la atingere, comutarea traducerii în pop-up, căutarea (cuvinte, expresii, referințe), copierea capitolului fără trimiteri, alegerea și ordonarea traducerilor, temele, afișarea pe telefon și fișierul `Scriptura.html` fără rețea.

Studiile (135, din 14 cărți) sunt copiate octet cu octet din Biblioteca Studiu Biblic. Verificat în browser: catalogul și progresul, căutarea după cuvânt, temă și trimitere (cu fragmente), cititorul cu părți și cuprins, pop-up-urile trimiterilor din studii, legăturile Biblie ↔ studiu, vizualizarea Faptelor Apostolilor, afișarea pe telefon și `Scriptura.html` fără nicio cerere de rețea. Service worker-ul nu a putut fi încercat în panoul de browser folosit (nu permite service workers, nici pentru versiunea anterioară); s-a verificat doar că toate fișierele din lista lui de precache există.
