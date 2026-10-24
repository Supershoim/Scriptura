---
name: regenerate-visuals
description: Remake the study visuals that are queued for regeneration (data/studies/regenerate.json) or out of date because their study text changed. Use when the user asks to regenerate visuals, runs /regenerate-visuals, or after editing a study.
---

# Regenerating study visuals

A visual (`data/studies/<BOOK>/<name>.visual.json`, or `book.visual.json`) is made from the text of its study. When the text changes, the build reports the visual as out of date, and the app's **Regenerează** button adds it to `data/studies/regenerate.json`. This skill redoes those visuals. The format of every block type is documented at the top of `tools/visual-spec.mjs`; follow `CLAUDE.md` (content rules) strictly.

## Steps

1. See what is waiting: `node tools/visuals.mjs queue` and `node tools/visuals.mjs status`. An id is a study (`DAN-5`) or a whole book (`DAN`).
2. For each item, read the study text (every part listed for it in `studies.json`) and the current visual. Find what changed: compare with `git diff` on the `.md` files when possible.
3. Update only what the change affects:
   - `chapter-map`: main idea, sections (verse ranges from the study's structure), flow, links in the book and in the Bible (taken from the study's parallels).
   - `network`: people and places of the chapter; add new ones to `data/atlas/people.json` / `places.json` (names spelled as in VDCC).
   - `book-map` (book visual): the chapter's title and 30–40 word summary; remove `"status": "în lucru"` once the chapter has a study.
   - `timeline`: events in `data/atlas/events.json`. `certain: true` only when a primary ancient source (inscription, chronicle, astronomical diary, 1 Maccabees) fixes the date; otherwise `false`. Every event needs a `source`.
   - `map`: places and routes (`via` = place ids or `{lat, lon, t}`; the build computes realistic paths).
   - `history`: images from Wikimedia Commons with a free licence (`node tools/commons.mjs search …` / `fetch …`), then write `title`, `caption` and `refs` in `data/atlas/images.json`.
4. Check every Bible quotation you write against the data (VDCC text in `data/translations/vdcc/text.json`), never from memory. Every link and source must be real.
5. Run `node tools/build.mjs`. Fix every problem it reports (references, summaries outside 30–40 words, unknown ids).
6. Stamp the visual so it is no longer reported as out of date: `node tools/visuals.mjs stamp <BOOK> <chapter>` (or `book`).
7. Remove the item from the queue: `node tools/visuals.mjs queue done <id>`.
8. Open the study in the browser (`#/studii/<BOOK>/<chapter>`), check the Vizual tab, and tell the user what changed.
