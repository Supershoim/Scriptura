# Plan: rafinarea vizualizărilor (pilot Daniel), înainte de celelalte cărți

Cerut de utilizator la 2026-10-24. Se aplică întâi la Daniel; aceleași reguli devin standard pentru toate cărțile (actualizează `CLAUDE.md`, `README.md`, `tools/visual-spec.mjs`, `.claude/skills/regenerate-visuals/SKILL.md`). Respectă regulile de conținut din `CLAUDE.md` (text biblic doar din `data/translations`, citatele verificate cu script, surse reale). Starea curentă: commit `ce0a1fa`.

Referință pentru structură: fotografia lui Ovi după Lennox, *Against the Flow*, Anexa C, convertită în
`C:\Users\OVIDIU~1\AppData\Local\Temp\claude\C--Users-Ovidiu-Pop--claude-spares-spare-tYgSNi\f3a5e9b4-99c4-4f24-8352-2acc232c1c72\scratchpad\daniel-structure.jpg`
(originalul HEIC: `C:\Users\Ovidiu Pop\Downloads\Daniel structure.jpg`; se deschide cu decodorul HEIF din Windows prin PowerShell).
Conținut: grupul 1 (cap. 1–5) în paralel cu grupul 2 (cap. 6–12): 1↔6 (credincioșie la curte, demnitari, restabilire), 2↔7 (patru imperii: om / fiare; piatra / Fiul omului), 3↔8 („nimeni nu poate scăpa din mâna lui”, închinare impusă, Dumnezeu dovedit), 4↔9 (gloria Babilonului / pustiirea Ierusalimului; disciplină de „șapte” → restaurare), 5↔10–12 (Belșațar se înalță cu zeii de piatră; regele se înalță mai presus de orice dumnezeu; „scrierea” de pe perete / „scrierea adevărului”; sfârșitul imperiului / vremea sfârșitului). Versiune simplificată, nu tabelul întreg.

## 1. Harta cărții (`book-map`)
- Sus: descriere a mesajului cărții, 100–150 de cuvinte (câmp nou `data.about`; verificat în build: 100–150 cuvinte). Din `daniel-00.md` (Idei principale, Context).
- Pe lângă cele două jumătăți: **secțiuni cheie** (câmp nou `data.parts`: `[{ id, t, from, to, sum }]`), de ex. pentru Daniel perechile din structura lui Lennox, simplificate: 1 + 6 (credincioșie la curte), 2 + 7 (cele patru împărății), 3 + 8 (închinare impusă / cornul mic), 4 + 9 (disciplină și restaurare), 5 + 10–12 (împăratul care se înalță și sfârșitul). Regula se aplică la toate cărțile: fiecare carte primește 4–8 secțiuni cheie.
- Legăturile rămân, dar cu **etichetă vizibilă** pe fiecare arc (eticheta scurtă din `links[2]`, ≤ 5 cuvinte; descrierea lungă în câmp nou opțional `links[3]`, în panou). Legături între capitole sau între secțiuni.

## 2. Cronologia (`timeline`)
- **Comprimarea perioadelor goale**: axă pe segmente; golurile mai mari de ~40 de ani se comprimă la o lățime fixă cu marcaj „⋯ 300 de ani ⋯” (scară pe bucăți în `vizbook.js`).
- **Context** (evenimente noi în `data/atlas/events.json`, cu `kind`): 
  - `prophecy`: profeții anterioare care se referă la faptele din carte (de verificat în VDCC): Isaia 39:6–7 (vistieriile și fiii duși în Babilon), Ieremia 25:11–12 și 29:10 (70 de ani), Isaia 44:28; 45:1 (Cir pe nume), Ieremia 51 / Isaia 13 (căderea Babilonului), Habacuc 1:6 (haldeii ridicați). Data profeției (aproximativă) + legătura cu evenimentul împlinit.
  - `fulfilment`: împliniri ulterioare ale profețiilor din Daniel: Alexandru (331/323), împărțirea în patru regate (după 301, Ipsos, aprox.), Antioh IV (167/164), după studiu Mesia „stârpit” (Daniel 9:26 → răstignirea, c. 30/33 d.Hr., aprox.), distrugerea templului în 70 d.Hr. (Daniel 9:26; sigur: Iosif Flavius), „urâciunea pustiirii” citată de Isus (Mat. 24:15). Axa trebuie să treacă de anul 0 (scara pe segmente rezolvă asta).
  - `major`: căderea Ninivei (612, Cronica babiloniană ABC 3 – verifică sursa), deportările (605, 597, 586/587, 582 – Ier. 52:30), întoarcerile (538 Zorobabel – Ezra 1–2; 458 Ezra – Ezra 7; 445/444 Neemia – Neem. 2), templul rezidit (516/515, Ezra 6:15), căderea Babilonului (539), a Persiei (331).
  - Legende: profeție (violet), împlinire (verde/portocaliu după certitudine), eveniment major (gri închis). Săgeți subțiri profeție → împlinire, vizibile la selecție.
- Bloc nou opțional: vederi (views) pentru „Profeții și împliniri”.

## 3. Personaje și locuri (`network`)
- Culori distincte pentru **proroci** (kind nou `proroc` în `people.json`: Daniel, Ieremia; eventual Isaia, Ezechiel dacă apar). Legenda actualizată.
- **Imagine pentru fiecare personaj**: de pe Wikimedia Commons (licență liberă, prin `node tools/commons.mjs`), câmp nou `image` în `people.json` (id din `images.json`, cu `kind: "portrait"` ca să nu apară în galeria istorică). De preferat: reprezentări istorice (reliefuri, monede, sigilii: ex. Nebucadnețar – camee/inscripție; Cir – relieful de la Pasargade; Alexandru – mozaic/monedă; Antioh IV – monedă) și, pentru personajele biblice fără portret istoric, picturi clasice în domeniul public (ex. Michelangelo – Daniel, Capela Sixtină; Rembrandt – Ospățul lui Belșațar). Afișare: imagine rotundă în nod (`<clipPath>`) și mare în panou; cu credit.

## 4. Hărți (`map`)
- **Straturi** (câmp nou `layers: [{ id, t, on }]` și `layer` pe fiecare traseu): utilizatorul le pornește/oprește (butoane deasupra hărții).
  - Valurile exilului: 605 (Daniel, 2 Împ. 24:1 / Dan. 1:1), 597 (Ioiachin, Ezechiel; 2 Împ. 24:10–16), 586/587 (Zedechia, templul ars; 2 Împ. 25), 582 (Ier. 52:30) – fiecare traseu cu dată, trimiteri, culoare proprie (nuanțe de portocaliu).
  - Întoarcerea: 538 Zorobabel (Ezra 1–2), 458 Ezra (Ezra 7–8), 445/444 Neemia (Neem. 2) – nuanțe de verde; traseele pe valea Eufratului, ca la exil (verifică pe ce drum, textul nu-l descrie: marchează „traseu probabil”).
- Aplică pe harta cărții Daniel și pe harta din Daniel 1.

## 5. General
- După titlul fiecărei secțiuni vizuale: **descriere de 100–150 de cuvinte** a ce reprezintă (folosește `note`, verificat în build la 100–150 cuvinte pentru tipurile noi; legendele scurte se mută în `legend`).
- **Legendele** (explicațiile, sursele hărții, notițele) jos, cu litere mici (`.fine-print`).
- **Fluiditate**: tranziții CSS pentru evidențiere, panou (slide-in), schimbarea vederilor cronologiei (animație între scări), zoom (animație viewBox cu requestAnimationFrame), straturile hărții (fade), hover pe noduri (scale ușor). Respectă `prefers-reduced-motion`.

## 6. Căutare aproximativă în textul Bibliei (cerut ulterior)
Căutarea din cititorul Bibliei (`app/js/search.js`, `runSearch` din `app/js/app.js`) găsește acum doar potriviri exacte (toate cuvintele / expresie / oricare). Cerință: **când nu există potrivire exactă, să arate cele mai apropiate versete** (fraze citate din memorie, cu alte cuvinte, ordine diferită sau forme flexionare diferite).
- Rămâne întâi căutarea exactă; dacă dă 0 rezultate (sau la cerere, buton „Caută și potriviri apropiate”), rulează o căutare aproximativă și afișează rezultatele separat, ordonate după scor, cu eticheta „Potriviri apropiate” și procentul de potrivire.
- Scor propus: cuvintele interogării comparate pe rădăcină (tăierea terminațiilor românești: -ul, -lui, -ilor, -ele, -ii, -le, -a, -ă etc.) și cu toleranță la greșeli (distanță de editare ≤ 1 pentru cuvinte de 5+ litere), ponderate după raritate (IDF calculat o dată pe traducere), plus bonus pentru cuvinte în aceeași ordine și apropiate (bigrame). Prag minim, maximum ~50 de rezultate.
- Fără diacritice, ca acum (`norm`). Performanță: index invers pe rădăcini construit leneș în `search.js` (31.102 versete × traducerile afișate), sub ~200 ms pe telefon; nu bloca interfața (eventual în bucăți cu `requestIdleCallback`).
- Evidențiază în rezultate cuvintele potrivite (și cele aproximative). Funcționează și în `Scriptura.html` offline.
- Verificare: căutări de test cu fraze inexacte (de ex. „Dumnezeu a iubit lumea atât de mult” → Ioan 3:16; „Domnul este păstorul meu nu voi duce lipsă” → Psalmul 23:1; o greșeală de tipar), în browser, desktop și telefon.

## Ordine de lucru
1. Format + verificări (`tools/visual-spec.mjs`, `tools/atlas.mjs`): `about`, `parts`, etichete legături, `kind` evenimente, `proroc`, `image` la persoane, `layers` la hărți, limite de cuvinte.
2. Desenare (`app/js/vizbook.js`, `vizchapter.js`, `vizmap.js`, `vizcore.js`, `styles.css`).
3. Conținut Daniel (`data/studies/DAN/*.visual.json`, `data/atlas/*`), cu toate citatele verificate (`verses.mjs` din scratchpad sau un script nou în `tools/`).
4. `node tools/build.mjs`, `node tools/visuals.mjs stamp DAN`, verificare în browser (preview `scriptura-8090`), commit.
5. Documentație și standardul pentru celelalte cărți.

## Progres
- 2026-10-24, rularea 1 (întreruptă): formatul și verificările (`visual-spec.mjs`, `atlas.mjs`), conținutul Daniel (secțiuni cheie, etichete, 35 de evenimente cu profeții/împliniri/majore, straturi exil/întoarcere, portrete), `tools/verses.mjs`. Commit `9ba6702`.
- 2026-10-24, rularea 2: descrierile de 100–150 de cuvinte pe tip (`data/atlas/visual-help.json`), `note` jos cu litere mici (`.fine-print`).
- Harta cărții: `about` sus, cardurile secțiunilor cheie (clic → panou, evidențiază capitolele), etichete pe arce (arcele pe benzi, fără suprapuneri), explicația `links[3]` în panou.
- Cronologia: scară pe segmente (golurile > 40 de ani comprimate, marcaj „⋯ N ani”), axa trece de anul 0 (d.Hr.), culori pe tip (profeție violet, împlinire romb verde/portocaliu, major gri), arce profeție → împlinire la selecție, filtrul `kinds` al vederilor, animație FLIP între vederi; panoul arată „Se împlinește în” / „Anunțat de”.
- Rețeaua: culoare pentru proroci, portret rotund în nod (clipPath) și mare în panou cu credit; portretele nu apar printre mărturiile istorice.
- Hărțile: butoane de straturi (fade), nuanțe pe valuri (portocaliu) și întoarceri (verde). Zoom animat la butoane; panou cu slide-in; hover cu scalare; `prefers-reduced-motion` oprește tot. Commit `f914fd8`.
- B, căutarea aproximativă (`approximate` în `search.js`): rădăcini românești, prefix comun, o greșeală de tipar, ponderare IDF, bonus de ordine; automat la 0 rezultate exacte, altfel buton „Caută și potriviri apropiate”; procent pe fiecare rezultat. Teste în Node: Ioan 3:16 95%, Ps 23:1 80% (parafrază), Mat 5:3 91%, „Dumnezu a iubit lumea” → Ioan 3:16 89%. Commit `604f0d2`.
- `CLAUDE.md` actualizat cu standardul nou.

- 2026-10-24, rularea 3: utilizare săptămânală 95%, rulare scurtă. Build trece (avertisment așteptat: `ACT/book.visual.json` nu are încă blocurile cerute de standardul nou). Serverul de previzualizare a fost refuzat din nou, deci verificarea în browser rămâne pentru utilizator sau o rulare interactivă.

- Verificat în browser (preview `scriptura-8090`, desktop 1024 px și telefon 375 px): fără erori în consolă, fără derulare orizontală; harta cărții, toate vederile cronologiei, rețeaua (portrete, proroci), straturile hărții, hărțile capitolelor 1–12 fără suprapuneri; căutarea aproximativă și butoanele ei. Corectat: etichetele legăturilor dintre jumătăți (se suprapuneau peste titlul jumătății a doua) și secțiunile hărții capitolului care atingeau coloanele laterale (cap. 11).

### Rămâne
- `README.md` și `.claude/skills/regenerate-visuals/SKILL.md`: de descris câmpurile noi (acum documentate în `tools/visual-spec.mjs`, `tools/atlas.mjs`, `CLAUDE.md`).
- Căutarea aproximativă: indexul se construiește la prima căutare fără rezultat (~400 ms pe traducere pe calculator; pe telefon probabil mai mult); de mutat în `requestIdleCallback` sau pe bucăți. Sinonimele nu sunt prinse („a fost” ≠ „era”: „la început a fost Cuvântul” nu dă Ioan 1:1 primul).
- Celelalte hărți de capitol din Daniel nu au încă straturi; doar harta cărții și Daniel 1.
