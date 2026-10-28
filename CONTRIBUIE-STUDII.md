# Studii de la alți autori: formatul standard și importul

Acest document descrie cum trimite un autor din afară (în continuare: *autorul*) un studiu pentru Scriptura și cum ajunge studiul în aplicația publicată pe GitHub Pages. Formatul este cel pe care îl verifică `node tools/build.mjs`; ce nu verifică build-ul, verifică cel care acceptă studiul (*îngrijitorul*, Ovi).

## 1. Pe scurt

- Un studiu = **un capitol** al unei cărți (sau câteva capitole legate, cu `covers`), sau privirea de ansamblu a cărții (`chapter: 0`).
- Un capitol are **un singur studiu**. Un capitol deja studiat nu poate primi al doilea studiu (build-ul se oprește).
- Studiul se trimite ca **pachet**: un folder `data/studies/<COD>/` cu textele Markdown, vizualizarea și intrarea din `studies.json`, plus intrările noi din registrul comun `data/atlas/`.
- Site-ul publicat este static: **nu se încarcă studii în aplicație de pe site**. Un studiu nou intră în depozitul GitHub (pull request sau pachet trimis îngrijitorului), iar GitHub Actions reconstruiește și republică site-ul (secțiunea 7).

## 2. Structura pachetului

```
data/studies/ROM/                    ← <COD> din data/books.json (ROM, DAN, 1CO …)
  studies.json                       ← lista studiilor cărții (se adaugă o intrare)
  romani-04.md                       ← partea principală a studiului
  romani-04-intrebari.md             ← părți suplimentare (opțional)
  romani-04.visual.json              ← vizualizarea capitolului
  book.visual.json                   ← vizualizarea cărții (există deja sau se creează la o carte nouă)
data/atlas/
  people.json  places.json  events.json  images.json  images/<fișier>   ← doar intrările noi
```

Reguli pentru fișiere:
- Numele folderului este codul cărții din `data/books.json` (trei caractere, de ex. `1CO`).
- Numele fișierelor: doar litere fără diacritice, cifre, `.`, `-`, `_`. Convenția: `<carte>-<capitol pe două cifre>[-<parte>].md`, de ex. `daniel-01-daniel-1-1-2-detaliat.md`.
- Vizualizările se numesc `<nume>.visual.json`.
- **Orice fișier din folder trebuie folosit** de `studies.json` (ca parte, ca vizualizare sau `book.visual.json`). Fișierele în plus opresc build-ul.
- Codificare UTF-8, diacritice românești cu virgulă (ș, ț).

## 3. Intrarea din `studies.json`

`studies.json` este o listă JSON (`[ … ]`); la o carte nouă se creează fișierul. Câte o intrare pe studiu:

```json
{
  "chapter": 4,
  "date": "2026-11-02",
  "title": "Romani 4: Avraam, socotit neprihănit prin credință",
  "summary": "Avraam este socotit neprihănit înainte de tăiere împrejur (4:10), deci neprihănirea vine prin credință, nu prin lege.",
  "themes": ["neprihănire", "credință", "Avraam"],
  "parts": [
    { "label": "Studiu complet", "file": "romani-04.md" },
    { "label": "Întrebări punctuale", "file": "romani-04-intrebari.md" }
  ],
  "visual": "romani-04.visual.json",
  "author": "Nume Prenume",
  "license": "CC BY-NC 4.0",
  "contact": "nume@exemplu.ro"
}
```

| Proprietate | Obligatorie | Format și reguli | Verificată de |
|---|---|---|---|
| `chapter` | da | Număr întreg: `0` (privire de ansamblu) până la numărul de capitole al cărții. Capitolul nu are deja un studiu. | build |
| `date` | da | `AAAA-LL-ZZ`, data studiului. | build |
| `title` | da | Text nevid. Convenția: `<Carte> <capitol>: <ideea în câteva cuvinte>`. | build |
| `summary` | da | Text nevid; 1–3 propoziții, apare în catalog și în căutare. | build |
| `themes` | da | Listă de cuvinte sau expresii scurte (poate fi goală). Folosește temele existente unde se potrivesc (vezi catalogul din aplicație), ca filtrarea după temă să le grupeze. | build |
| `parts` | da | Cel puțin o parte: `{ "label", "file" }`, `file` = un fișier `.md` din același folder. Prima parte este cea principală. O parte cu „Întrebări” în etichetă își numără întrebările (rândurile care încep cu `> Întrebare`). | build |
| `visual` | da (standard) | Fișierul vizualizării capitolului (`<nume>.visual.json`). Build-ul acceptă și studii fără ea, dar standardul aplicației o cere (secțiunea 5). | build (formatul), îngrijitor (prezența) |
| `covers` | nu | Capitolele cuprinse de același studiu, de ex. `[9, 10]`; trebuie să includă `chapter` și nu se poate folosi la `chapter: 0`. | build |
| `author` | da (standard) | Numele autorului, cum va apărea. | îngrijitor |
| `license` | da (standard) | Permisiunea de publicare: de preferat CC BY 4.0 sau CC BY-NC 4.0; altfel o declarație scrisă că autorul permite publicarea în Scriptura. | îngrijitor |
| `contact` | nu | Adresa la care autorul poate fi întrebat despre studiu. Nu se afișează. | — |

`author`, `license` și `contact` sunt cerute de acest standard, dar aplicația nu le afișează încă și build-ul nu le verifică (câmpurile în plus sunt ignorate). Până la afișarea lor, autorul se trece și în prima parte a studiului (secțiunea 4).

## 4. Textele studiului (`.md`)

Markdown obișnuit. Build-ul îl transformă în HTML **fără să-i schimbe textul**: ce trimite autorul este ce se publică, cuvânt cu cuvânt.

- **Titluri:** nivelul care apare de cel puțin trei ori (de obicei `##`) devine cuprinsul părții. Titlurile scrise cu majuscule sunt afișate în cuprins cu literă mică.
- **Trimiteri biblice:** se scriu în forma românească obișnuită și devin automat ferestre cu versetul: „Romani 3:23”, „Fapte 17:31”, „3:21-26” (în capitolul studiat), „v. 4-5”. Numele cărților sunt cele din `data/books.json`.
- **Citate biblice:** doar din traducerile din aplicație (VDCC, NTR), cuvânt cu cuvânt, cu trimiterea alături. Îngrijitorul le verifică în `data/translations/` cu un script; un citat care nu se potrivește se întoarce autorului.
- **Legături spre alte studii:** `[Romani capitolul 1](Romani%20capitolul%201.md)` sau `[Romani: privire de ansamblu](Romani%20privire%20de%20ansamblu.md)`. Orice altă legătură spre un `.md` oprește build-ul.
- **Legături externe** (`https://…`): doar spre surse reale, care susțin afirmația de lângă ele. Se deschid în filă nouă.
- **Tabele:** Markdown; pe telefon se derulează în chenarul lor.
- **Autorul:** primul rând al părții principale, de ex. `*Studiu de Nume Prenume, 2026.*`
- Fără HTML cu stiluri proprii, fără imagini în text (imaginile istorice merg în vizualizare, prin registru).

Reguli de conținut (aceleași ca pentru studiile lui Ovi):
- studiu biblic baptist neoprotestant, ton „inginer către inginer”: direct, precis, fără umplutură;
- nicio afirmație atribuită fără sursă reală; deducțiile se marchează („lectură de lucru”, „deducție”);
- pozițiile disputate (date, autori, locuri) se prezintă cu alternative;
- datele din cronologie: aproximative, prezentate ca atare, cu excepția celor fixate de un izvor antic primar.

## 5. Vizualizarea capitolului (`<nume>.visual.json`)

Aplicația deschide studiul pe vizualizare; textul e în filele de lângă. O vizualizare este:

```json
{
  "blocks": [
    { "type": "chapter-map", "title": "Harta capitolului", "message": "…", "data": { … } },
    { "type": "network", "title": "Personaje și locuri", "message": "…", "data": { … } }
  ]
}
```

Proprietățile fiecărui bloc:

| Proprietate | Obligatorie | Reguli |
|---|---|---|
| `type` | da | `chapter-map`, `network`, `map`, `history` (pentru capitole). |
| `title` | da | Titlul afișat deasupra diagramei. |
| `data` | da | Datele tipului (mai jos). |
| `message` | da (standard) | 30–90 de cuvinte: ce arată diagrama despre text, scris din datele ei și din studiu. |
| `about` | nu | 100–150 de cuvinte: cum se citește blocul, dacă diferă de textul general din `data/atlas/visual-help.json`. |
| `note` | nu | Notă scurtă sub diagramă (litere mici). |

Nu se scrie `source`: îl adaugă îngrijitorul cu `node tools/visuals.mjs stamp`.

**Trimiterile** din vizualizări au forma `"COD c:v"` sau `"COD c:v-v"` (`"ROM 3:23"`, `"ROM 3:21-26"`) și trebuie să existe în texte; build-ul le verifică pe toate.

### Obligatoriu: `chapter-map`

```json
{
  "idea": { "t": "Titlul ideii (2–5 cuvinte)", "text": "Ideea principală a capitolului, 1–3 propoziții.", "refs": ["ROM 4:3"] },
  "parts": [
    { "id": "a", "t": "Avraam înainte de lege", "refs": ["ROM 4:1-12"], "text": "Ce spune secțiunea, o propoziție." },
    { "id": "b", "t": "Moștenitorii făgăduinței", "refs": ["ROM 4:13-25"], "text": "…" }
  ],
  "flow": [["a", "b", "de aceea"]],
  "book":  [{ "ch": 1, "from": "a", "t": "Procesul deschis", "why": "De ce se leagă de capitolul 1.", "refs": ["ROM 1:18"] }],
  "bible": [{ "ref": "GEN 15:6", "from": "a", "t": "Citatul din Geneza", "why": "De ce se leagă." }]
}
```

- `idea`: `t` și `text` obligatorii, `refs` listă (poate fi goală).
- `parts`: secțiunile capitolului, cel puțin două; `id` unic, `t`, `text`, `refs` obligatorii.
- `flow` (opțional): `[id, id, etichetă]`, cum curge argumentul între secțiuni.
- `book` (opțional, recomandat): legături spre alte capitole ale cărții; `ch`, `from` (id de secțiune) și `why` obligatorii.
- `bible` (opțional, recomandat): legături spre restul Bibliei; `ref`, `from`, `t`, `why` obligatorii.

### Obligatoriu: `network`

```json
{
  "nodes": ["pavel", "roma"],
  "links": [["pavel", "roma", "scrie bisericii din", "ROM 1:7"]]
}
```

- `nodes`: id-uri din `data/atlas/people.json` sau `places.json`, cel puțin unul.
- `links`: `[id, id, etichetă, trimitere opțională]`; ambele capete în `nodes`, eticheta obligatorie.

### Ocazional: `map`, `history`

- `map` (călătorii, evenimente legate de locuri): `places` (id-uri de locuri), `routes` opțional `[{ t, via: [loc | {lat, lon}], mode?: "land"|"sea", kind?: "exile"|"return"|"journey", layer?, refs? }]`, `layers` opțional `[{ id, t }]`. Traseele se dau prin puncte; build-ul le calculează realist (pe văi, de-a lungul coastelor), nu ca linii drepte.
- `history`: `items`, id-uri din `data/atlas/images.json`.

Formatul complet, cu toate verificările, este la începutul lui `tools/visual-spec.mjs`. Exemple complete: `data/studies/DAN/`.

## 6. Registrul comun (`data/atlas/`)

Vizualizările folosesc personaje, locuri, evenimente și imagini **după id**, dintr-un registru comun pentru toată Biblia. Înainte de a adăuga o intrare, autorul caută dacă există deja (de ex. `pavel`, `ierusalim`) și o refolosește. Intrările noi se trimit în pachet; id-urile sunt litere mici fără diacritice, cifre și cratime (`ioan-botezatorul`).

| Fișier | Obligatorii | Opționale |
|---|---|---|
| `people.json` | `name`, `kind` (`om`, `proroc`, `înger`, `divin`, `grup`), `about`, `refs` | `aka` (alte nume), `image` (portret din `images.json`, `kind: "portrait"`), `books` (`{ "MAT": ["MAT 24:15"] }`, apariții în alte cărți), `note`, `sources` |
| `places.json` | `name` (forma din VDCC), `kind` (cetate, regiune, râu …), `lat`, `lon`, `about`, `refs` | `approx: true` (locație nesigură), `books`, `sources` |
| `events.json` | `name`, `year` (întreg, negativ î.Hr.), `date` (textul afișat, „c. 605 î.Hr.”), `certain` (`true` doar dacă un izvor antic primar fixează data), `about`, `refs`, `source: { t, url? }` | `end`, `kind` (`book`, `prophecy` cu `fulfils`, `fulfilment`, `major`), `people`, `places` |
| `images.json` | `title`, `caption`, `refs`, `file` (în `images/`), `source` (pagina sursă), `author`, `license` (doar licențe libere) | `places`, `people`, `kind: "portrait"` |

Imaginile se iau de pe Wikimedia Commons cu `node tools/commons.mjs search "…"` și `fetch <id> "File:…"`, care rețin autorul și licența.

## 7. Cum ajunge un studiu în aplicația publicată

Aplicația de pe GitHub Pages este construită de workflow-ul `.github/workflows/pages.yml` la fiecare `push` pe `main`: rulează `node tools/build.mjs` și publică `dist/`. Build-ul transformă Markdown-ul în HTML, calculează traseele, indexul de căutare și trimiterile spre studii. De aceea un studiu nou nu se poate „încărca” în site-ul deja publicat: intră în depozit, iar site-ul se reconstruiește în jur de un minut.

### Calea A: pull request (pentru autori cu cont GitHub)

1. Autorul face un *fork* al depozitului `Supershoim/Scriptura` și clonează fork-ul.
2. Adaugă pachetul (secțiunile 2–6) pe o ramură nouă, de ex. `studiu/rom-04`.
3. Rulează local, cu Node.js 20+ (fără alte dependențe):
   ```bash
   node tools/build.mjs
   ```
   ```bash
   node tools/serve.mjs
   ```
   Build-ul trebuie să treacă fără probleme; studiul se verifică în browser la `http://localhost:8080/#/studii/ROM/4` și `#/studii/ROM/4/vizual`, inclusiv pe lățime de telefon.
4. Deschide un pull request spre `main`, cu: cartea și capitolul, autorul, licența, lista intrărilor noi din registru.
5. Îngrijitorul verifică (secțiunea 8), ștampilează vizualizarea și face *merge*. Merge-ul pe `main` pornește publicarea; studiul apare pe site după aproximativ un minut. Pe telefon, aplicația instalată îl preia la următoarea deschidere cu internet (service worker-ul aduce fișierele noi).

### Calea B: pachet trimis îngrijitorului (fără GitHub)

1. Autorul trimite o arhivă `.zip` cu folderul `data/studies/<COD>/` (doar fișierele noi și `studies.json` cu intrarea adăugată) și un fișier `atlas-nou.json` cu intrările de registru `{ "people": {…}, "places": {…}, "events": {…}, "images": {…} }`.
2. Îngrijitorul copiază fișierele în proiect, adaugă intrările în `data/atlas/`, rulează build-ul și verificările din secțiunea 8, apoi:
   ```bash
   git add data/studies data/atlas
   ```
   ```bash
   git commit -m "Adaugă studiul Romani 4 (Nume Prenume)"
   ```
   ```bash
   git push
   ```
3. `git push` pornește publicarea, ca la calea A.

Varianta fără Node.js: autorul poate trimite doar textul studiului și datele în formă liberă; îngrijitorul (sau Claude Code, cu regulile din `CLAUDE.md`) construiește vizualizarea și intrările de registru. Textul studiului rămâne neschimbat.

## 8. Lista de verificare a îngrijitorului

Înainte de merge sau push:

- [ ] `node tools/build.mjs` trece fără probleme (avertismentele se citesc: vizualizare lipsă, neștampilată).
- [ ] Capitolul nu avea studiu; `book.visual.json` are rezumatul capitolului (30–40 de cuvinte) actualizat și fără `"status": "în lucru"`.
- [ ] Vizualizarea are `chapter-map` și `network`, fiecare bloc cu `message` de 30–90 de cuvinte.
- [ ] Citatele biblice din studiu și din vizualizare sunt verificate în `data/translations/` cu un script.
- [ ] Afirmațiile atribuite au sursă reală; deducțiile sunt marcate; pozițiile disputate au alternative.
- [ ] Imaginile noi au licență liberă, autor și pagină sursă.
- [ ] `author` și `license` sunt completate; licența permite publicarea pe un site public.
- [ ] `node tools/visuals.mjs stamp <COD> <capitol>` (și `book` dacă s-a schimbat `book.visual.json`), apoi din nou `node tools/build.mjs`.
- [ ] Studiul arată corect în browser: textul, cuprinsul, ferestrele cu versete, vizualizarea, telefonul.

## 9. Drepturi

Site-ul GitHub Pages al depozitului este public. Un studiu trimis spre publicare devine public, sub licența declarată de autor. Autorul confirmă că textul este al lui (sau că are dreptul să-l publice) și că citatele biblice provin din traducerile din aplicație. Publicarea depozitului cu VDCC, NTR și studiile lui Ovi rămâne condiționată de acordul titularilor (vezi `README.md`, „Publicare”).
