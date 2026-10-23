# Scriptura — Biblia în paralel

Aplicație web pentru citirea mai multor traduceri ale Bibliei alăturat, verset cu verset, cu căutare și cu trimiterile tipărite afișate ca ferestre mici (pop-up). Funcționează pe calculator, telefon și tabletă; instalată de pe site, merge și fără internet.

## Structură

| Folder | Conținut |
|---|---|
| `data/` | Textele canonice. `books.json` (cele 66 de cărți, coduri USFM) și câte un folder pentru fiecare traducere în `data/translations/<id>/`. |
| `app/` | Aplicația: HTML, CSS și module JavaScript simple, fără framework. |
| `tools/` | `build.mjs` (construiește `dist/`), `validate.mjs`, `serve.mjs` (previzualizare locală), `import-tsv.mjs` (traducere nouă), `import-legacy.mjs` (conversia unică din vechea extragere PDF). |
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

## Publicare (GitHub Pages)

1. Creează un depozit pe GitHub și urcă proiectul (`git push`) pe ramura `main`.
2. În depozit: *Settings → Pages → Source: GitHub Actions*.
3. Fiecare `push` reconstruiește și publică site-ul. Pe telefon, deschide adresa și alege „Adaugă pe ecranul principal” / „Instalează aplicația”.

**Atenție la drepturi:** pe planul gratuit GitHub, depozitele publicate cu Pages sunt publice. VDCC și NTR sunt protejate de drepturi de autor. Cere permisiunea titularilor înainte de publicare sau folosește un depozit privat cu un plan care permite Pages private.

## Validare

Textele provin din aceeași extragere ca aplicația precedentă: 31.102 versete pentru fiecare traducere și 61.331 de trimiteri VDCC. Verificat în browser: lectura în paralel, alinierea pentru 2 Corinteni 13, 3 Ioan, Filipeni 1 și Apocalipsa 12, pop-up-urile la hover și la atingere, comutarea traducerii în pop-up, căutarea (cuvinte, expresii, referințe), copierea capitolului fără trimiteri, alegerea și ordonarea traducerilor, temele, afișarea pe telefon și fișierul `Scriptura.html` fără rețea.
