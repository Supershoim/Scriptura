# Scriptura — Studiu și text

Aplicație web pentru citirea mai multor traduceri ale Bibliei alăturat, verset cu verset, cu căutare și cu trimiterile tipărite afișate ca ferestre mici (pop-up). Secțiunea **Studii** adaugă studiile biblice expozitive, câte unul pe capitol (scopul: toate cele 1.189 de capitole), prezentate în primul rând vizual: harta cărții, cronologia, harta fiecărui capitol, personaje și locuri, hărți și mărturii istorice, cu textul complet al studiului alături. Funcționează pe calculator, telefon și tabletă; instalată de pe site, merge și fără internet.

## Structură

| Folder | Conținut |
|---|---|
| `data/` | Textele canonice. `books.json` (cele 66 de cărți, coduri USFM, abrevieri) și câte un folder pentru fiecare traducere în `data/translations/<id>/`. |
| `data/studies/` | Studiile, câte un folder pe carte (`data/studies/ROM/`): `studies.json`, textele `.md` și vizualizările `.visual.json` (inclusiv `book.visual.json` pentru carte). |
| `data/atlas/` | Registrul comun al vizualizărilor: personaje, locuri, evenimente datate, imagini istorice și harta. |
| `data/comments/` | Comentariile la versete, câte un fișier pe carte (`ROM.json`), scrise din aplicație. |
| `app/` | Aplicația: HTML, CSS și module JavaScript simple, fără framework. |
| `tools/` | `build.mjs` (construiește `dist/`), `validate.mjs`, `studies.mjs` (verifică și construiește studiile), `visual-spec.mjs` (formatul și verificarea vizualizărilor), `atlas.mjs` (registrul), `routes.mjs` (trasee realiste), `visuals.mjs` (stare, ștampilare, coada de regenerare), `commons.mjs` (imagini), `make-map.mjs` (harta), `serve.mjs` (previzualizare locală și editare), `import-tsv.mjs` (traducere nouă), `import-kjv.mjs` (KJV și notele King James Study Bible din PDF), `study-notes.mjs` (verifică notele de studiu ale unei traduceri), `translate-notes.mjs` (memoria de traducere a notelor), `check-quotes.mjs` (citatele din notele traduse, verificate în VDCC), `english-books.mjs` (numele englezești ale cărților), `import-legacy.mjs` și `import-studies.mjs` (conversii unice din aplicațiile precedente), `vendor/marked.min.js` (Markdown → HTML). |
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
| Carte | `book-map`: mesajul cărții în 100–150 de cuvinte (`about`), cele două jumătăți (`sections`) și 4–8 secțiuni cheie (`parts`, o structură simplificată), capitolele cu stadiul studiului și un rezumat de 30–40 de cuvinte, legăturile dintre capitole cu etichetă vizibilă (≤ 5 cuvinte) și explicație în panou. `timeline`: verde = dată fixată de un izvor antic primar, portocaliu = aproximativă, sursa sub fiecare eveniment; pe lângă evenimentele cărții: profeții anterioare (`prophecy`, cu `fulfils`), împliniri ulterioare (`fulfilment`) și evenimente majore (`major`); golurile de peste 40 de ani se comprimă; vederi filtrate (`views[].kinds`). `network`: personaje și locuri; prorocii au culoare proprie (`kind: "proroc"`), personajele au portret (`image`). | `map`, `history` |
| Capitol | `chapter-map` (ideea principală, secțiunile capitolului, legăturile în carte și în restul Bibliei), `network` (personaje și locuri, cu alte cărți în care apar) | `map` (călătorii, evenimente legate de locuri; grupuri de trasee ca straturi, `layers`, de ex. valurile exilului și întoarcerile), `history` (imagini cu locuri și scrieri antice) |

Fiecare bloc are sub titlu un mesaj (`message`, 30–90 de cuvinte): ce arată diagrama despre text. Butonul „?” de lângă titlu deschide în panou cum se citește blocul (100–150 de cuvinte, din `data/atlas/visual-help.json` sau din `about` al blocului). Notele (`note`) și legendele apar sub diagramă, cu litere mici. Animațiile (zoom, schimbarea vederilor, panoul) se opresc când sistemul cere mișcare redusă.

Tot ce se poate da clic (personaje, locuri, evenimente, imagini, capitole, secțiuni) deschide un panou cu detalii, versete (ca ferestre pop-up) și locurile în care mai apare; elementele legate se evidențiază în toate diagramele. Diagramele se pot mări (butoanele +/−, Ctrl+rotiță, două degete).

Registrul comun, pentru toată Biblia, este în `data/atlas/`: `people.json` (cu `kind`: om, proroc, înger, divin, grup; și `image`, portretul), `places.json` (cu coordonate), `events.json` (cu dată, siguranță, sursă și `kind`: evenimentul cărții, profeție, împlinire, eveniment major), `images.json` cu fișierele în `images/` (doar imagini cu licență liberă, cu autor, licență și pagina sursă; portretele au `kind: "portrait"` și nu apar în galeria istorică), `visual-help.json` (cum se citește fiecare tip de bloc) și `maps/near-east.json` (uscatul și râurile, Natural Earth). Traseele de pe hărți nu sunt linii drepte: build-ul le calculează (`tools/routes.mjs`) pe uscat de-a lungul văilor râurilor, cu traversări scurte de ape, și pe mare de-a lungul coastelor; aplicația le desenează ca linii curbe.

Unelte:
- `node tools/commons.mjs search "…"` / `fetch <id> "File:…"`: caută și descarcă imagini de pe Wikimedia Commons (doar licențe libere).
- `node tools/visuals.mjs status`: ce studii au vizualizare, care sunt neactualizate sau incomplete.
- `node tools/visuals.mjs stamp <COD> [capitol|book]`: notează textul din care s-a făcut vizualizarea.
- `node tools/make-map.mjs`: regenerează harta (o singură dată).

### Editare și regenerare

Fiecare parte a unui studiu și fiecare vizualizare are butonul **Editează**. La un studiu, deasupra textului apar titlul, rezumatul și eticheta părții (din `studies.json`). Salvarea merge:

- local, cu `node tools/serve.mjs`: fișierul se scrie în `data/`, aplicația se reconstruiește, iar dacă build-ul găsește o problemă fișierul revine la forma dinainte și problema este afișată;
- de oriunde, pe GitHub, după deblocare cu parola (`app/js/lock.js`): un singur commit cu fișierele schimbate; editorul urmărește build-ul GitHub Pages până la publicare (cu *Actions: Read* pe token) sau spune dacă a eșuat. Dacă fișierul a fost schimbat de pe alt dispozitiv după deschidere, salvarea se oprește în loc să-l suprascrie.

**Blocarea.** Tokenul GitHub (*fine-grained*, doar acest depozit, *Contents: Read and write*, opțional *Actions: Read*) se introduce o dată pe dispozitiv și se păstrează doar criptat: PBKDF2 (600.000 de runde) face din parolă o cheie AES-GCM. Parola nu se salvează. Pe un *dispozitiv de încredere* cheia rămâne în IndexedDB ca cheie nedetașabilă (pagina o poate folosi, dar nu o poate citi), deci deblocarea se păstrează după repornire; altfel, tokenul decriptat stă doar în memorie, până la închiderea sau reîncărcarea paginii. „Blochează acum” scoate dispozitivul din încredere; „Uită acest dispozitiv” șterge tokenul criptat. Aceeași blocare servește comentariile și importul de studii.

Fiecare vizualizare reține amprenta textului din care a fost făcută. Când textul studiului se schimbă, vizualizarea apare ca **neactualizată**. Părțile calculate (trasee, trimiteri, numărători) se refac singure; ideea principală, legăturile și rezumatele se refac cu **Regenerează**, care pune studiul în coada `data/studies/regenerate.json`, iar apoi în Claude Code cu comanda `/regenerate-visuals`.

### Adăugarea unui studiu

1. Pune fișierele `.md` și `.visual.json` în `data/studies/<COD>/`.
2. Adaugă intrarea în `studies.json` (creează fișierul, cu `[ … ]`, la prima carte nouă) și scoate `"status": "în lucru"` din rezumatul capitolului în `book.visual.json`.
3. Rulează `node tools/build.mjs`, apoi `node tools/visuals.mjs stamp <COD> <capitol>`. Build-ul se oprește la orice problemă: câmp lipsă, capitol inexistent sau deja studiat, fișier negăsit sau nefolosit, trimitere biblică inexistentă, rezumat în afara a 30–40 de cuvinte, personaj, loc, eveniment sau imagine care lipsește din registru, eveniment fără sursă.

Build-ul transformă textele în HTML, scrie catalogul (`data/studies/index.json`) și un index de cuvinte împărțit după primele două litere (`data/studies/search/`). Căutarea descarcă doar bucățile de care are nevoie, așa că rămâne rapidă și cu un studiu pe fiecare capitol.

## NKJV Study Bible (NKJV)

`data/translations/nkjv/` vine din PDF-ul *The NKJV Study Bible, Second Edition, Full-Color Edition* (Thomas Nelson, 2014), cu `tools/import-nkjv.mjs`. A înlocuit KJV Study Bible (Liberty University, doar Geneza), păstrată cu importul ei și cu traducerea în română a notelor în `archive/kjv-liberty/` (în afara build-ului și a git).

- `text.json`: versetele NKJV; `notes.json`: trimiterile din coloana centrală (litere) și notele de traducere (cifre), puse după cuvântul marcat, ca trimiterile VDCC.
- `study/<COD>.json`: pe verset, notele de studiu (o notă pe un interval e la primul verset, cu `to`) și studiile de cuvinte (`kind: "word"`).
- `study/<COD>.book.json`: introducerea cărții (pagina **Sumar**) și, pe capitol, inserțiile care nu țin de un verset: Bible Times & Culture Notes, articolele, tabelele, hărțile, imaginile (pagina **Informații suplimentare**).
- `study/index.json`: **indexul notelor și inserțiilor**, pentru alte unelte și aplicații. `items`: fiecare notă sau inserție după un id stabil (`GEN.12.6`, `GEN.12.1-9`, `GEN.1.1.word.heavens`, `GEN.c11.culture.ur`, `GEN.intro`), cu felul ei, versetele (`from`, `to`) sau capitolul, pagina din PDF (`pdf`) și cea tipărită (`page`), cuvintele-titlu găsite în verset (`lemmas`, cu poziția) și trimiterile din text (`refs`). `verses`: pentru fiecare verset, `own` (notele lui), `covers` (notele pe un interval care îl cuprinde) și `cited` (notele și inserțiile care îl citează). Textul unei intrări se ia din fișierul cărții după id. Build-ul îl copiază în `dist/` neschimbat.

Formatele sunt descrise la începutul lui `tools/study-notes.mjs`, care le verifică la build. Importul sortează textul paginii după font (versete Esprit, trimiteri Myriad 6 pt, note Myriad 7 pt cu eticheta albastră, antet Gotham), iar inserțiile după umplerile colorate și imagini. MuPDF nu este o dependență a proiectului; se instalează separat:

```bash
npm install --prefix "%TEMP%/mupdf" mupdf
```

```bash
MUPDF="$TEMP/mupdf/node_modules/mupdf/dist/mupdf.js" node tools/import-nkjv.mjs "D:/Biblia PDF/The New King James Version Study Bible.pdf" GEN
```

Cu coduri de carte importă doar acele cărți (celelalte rămân); fără ele, toată Biblia. Verificat pentru Geneza (pilot): 1.533 de versete, 846 de note, 10 studii de cuvinte, 20 de inserții pe capitole, introducerea cu schița și cronologia.

### Traducerea în română

Uneltele de mai jos au tradus notele KJV Study Bible (Geneza, acum în `archive/kjv-liberty/kjv/study/ro/`). Notele NKJV nu sunt încă traduse; comenzile primesc `nkjv` în loc de `kjv`.

Notele traduse sunt o memorie de traducere, `study/ro/<COD>.json`: un segment pe fiecare câmp de text (`"1:2|1|html"`), cu textul românesc și amprenta englezei din care a fost tradus. Build-ul scrie `study/<COD>.ro.json`; un segment lipsă sau a cărui engleză s-a schimbat la un import nou rămâne în engleză, marcat „netradus încă”.

- `node tools/translate-notes.mjs status kjv GEN ro`: cât e tradus.
- `node tools/translate-notes.mjs export kjv GEN ro segmente.json`: segmentele de tradus, cu trimiterile deja în prescurtările românești.
- `node tools/translate-notes.mjs apply kjv GEN ro traducere.json`: adaugă `{ "cheie": "text" }` după ce verifică paragrafele, eticheta notei („1:2.”), închiderea etichetelor `<strong>`/`<em>` și trimiterile `c:v`.
- `node tools/check-quotes.mjs kjv GEN ro`: cuvintele biblice îngroșate și citatele („…”) care nu sunt text VDCC cuvânt cu cuvânt. Cuvintele îngroșate trebuie să fie toate VDCC; citatele rămase sunt glosele notei (traduceri literale, texte nebiblice), de citit unul câte unul.

Reguli de traducere: accentul este pe mesaj, deci totul este în română. Cuvintele biblice comentate (îngroșate) și citatele biblice sunt textul VDCC al versetului, verificat cu `check-quotes.mjs`, nu traduse din engleză; unde nota discută traducerea engleză însăși, cuvântul KJV apare în paranteză, cursiv („KJV are <em>replenish</em>, care se traduce mai bine…”); numele urmează VDCC; trimiterile folosesc prescurtările din `data/books.json`; unitățile de măsură se păstrează, cu echivalentul metric în paranteză. Geneza este tradusă integral (238 de segmente, 26.536 de cuvinte englezești; 490 din 490 de cuvinte biblice îngroșate sunt text VDCC).

**Drepturi:** textul NKJV (© 1982 Thomas Nelson), notele, articolele, hărțile și imaginile sunt protejate (Thomas Nelson, Zondervan, sursele fotografiilor). Sunt doar pentru uz personal și nu se publică pe GitHub Pages.

## Comentarii și trimiteri spre studii

Clic dreapta pe un verset (pe telefon: apăsare lungă) deschide comentariile lui. Un verset cu comentarii are după text un balon mic; versetele menționate în studii au, cu litere mici, studiul („Romani 2”) sau numărul de studii. Atinse, se deschid într-o fereastră; din ea se ajunge în studiu, derulat la locul unde apare versetul.

- **Comentariile** sunt în `data/comments/<COD>.json`: `{ "3:16": [ { "date": "2026-10-25", "text": "…" } ] }`, cu numerotarea rândurilor din cititor. Build-ul verifică versetul, data și textul (cel mult 4.000 de caractere). Salvarea merge prin `node tools/serve.mjs` (fișierul se scrie local; îl urci cu `git push`) sau, pe site-ul publicat, direct în depozitul GitHub, după deblocarea cu parola (vezi „Editare și regenerare”). Fiecare salvare devine un commit în `data/comments/`, iar GitHub Pages reconstruiește site-ul în jur de un minut. Deblocată, aplicația citește comentariile direct din depozit, deci le vede imediat. Înainte de un `git push` local, `git pull` aduce comentariile scrise de pe alte dispozitive.
- **Trimiterile spre studii** se calculează la build (`tools/mentions.mjs`) cu aceeași recunoaștere a referințelor ca pop-up-urile din studii (`app/js/refs.js`): `data/studies/mentions/<COD>.json`, pe verset, studiul, partea, de câte ori apare și un fragment din jur. Un pasaj de peste 30 de versete marchează doar primul verset.

## Publicare (GitHub Pages)

1. Creează un depozit pe GitHub și urcă proiectul (`git push`) pe ramura `main`.
2. În depozit: *Settings → Pages → Source: GitHub Actions*.
3. Fiecare `push` reconstruiește și publică site-ul. Pe telefon, deschide adresa și alege „Adaugă pe ecranul principal” / „Instalează aplicația”.

**Atenție la drepturi:** pe planul gratuit GitHub, depozitele publicate cu Pages sunt publice. VDCC și NTR sunt protejate de drepturi de autor, iar studiile ar deveni și ele publice. Cere permisiunea titularilor înainte de publicare sau folosește un depozit privat cu un plan care permite Pages private.

## Validare

Textele provin din aceeași extragere ca aplicația precedentă: 31.102 versete pentru fiecare traducere și 61.331 de trimiteri VDCC. Verificat în browser: lectura în paralel, alinierea pentru 2 Corinteni 13, 3 Ioan, Filipeni 1 și Apocalipsa 12, pop-up-urile la hover și la atingere, comutarea traducerii în pop-up, căutarea (cuvinte, expresii, referințe), copierea capitolului fără trimiteri, alegerea și ordonarea traducerilor, temele, afișarea pe telefon și fișierul `Scriptura.html` fără rețea.

Studiile (135, din 14 cărți) sunt copiate octet cu octet din Biblioteca Studiu Biblic. Verificat în browser: catalogul și progresul, căutarea după cuvânt, temă și trimitere (cu fragmente), cititorul cu părți și cuprins, pop-up-urile trimiterilor din studii, legăturile Biblie ↔ studiu, vizualizarea Faptelor Apostolilor, afișarea pe telefon și `Scriptura.html` fără nicio cerere de rețea. Service worker-ul nu a putut fi încercat în panoul de browser folosit (nu permite service workers, nici pentru versiunea anterioară); s-a verificat doar că toate fișierele din lista lui de precache există.
