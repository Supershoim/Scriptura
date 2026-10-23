// Checks the data files before a build. Returns a list of human-readable problems (empty when valid).
const KEY = /^([1-3A-Z]{3}) (\d+):(\d+)$/;

export function validate(books, translations) {
  const problems = [];
  const byId = new Map(books.map(b => [b.id, b]));
  const ids = new Set();
  for (const { meta, text, notes } of translations) {
    const where = `[${meta.id}]`;
    for (const field of ['id', 'abbreviation', 'name'])
      if (!meta[field]) problems.push(`${where} translation.json: missing "${field}"`);
    if (ids.has(meta.id)) problems.push(`${where} duplicate translation id`);
    ids.add(meta.id);

    for (const [b, chapters] of Object.entries(text)) {
      const book = byId.get(b);
      if (!book) { problems.push(`${where} text.json: unknown book "${b}"`); continue; }
      if (!Array.isArray(chapters) || chapters.length > book.chapters)
        problems.push(`${where} ${b}: expected at most ${book.chapters} chapters, found ${chapters?.length}`);
      chapters.forEach((verses, ci) => {
        if (!Array.isArray(verses)) problems.push(`${where} ${b} ${ci + 1}: chapter must be an array of verses`);
        else verses.forEach((v, vi) => { if (v !== null && typeof v !== 'string') problems.push(`${where} ${b} ${ci + 1}:${vi + 1}: verse must be text or null`); });
      });
    }
    const exists = k => { const m = k.match(KEY); return m && typeof text[m[1]]?.[m[2] - 1]?.[m[3] - 1] === 'string'; };
    const valid = k => { const m = k.match(KEY); return m && byId.has(m[1]) && +m[2] >= 1 && +m[2] <= byId.get(m[1]).chapters; };

    const { map = {}, spans = {}, gaps = {}, notices = {} } = meta.alignment || {};
    for (const [own, canon] of Object.entries(map)) {
      if (!exists(own)) problems.push(`${where} alignment.map: "${own}" is not a verse in text.json`);
      if (!valid(canon)) problems.push(`${where} alignment.map: invalid target "${canon}"`);
    }
    for (const [own, last] of Object.entries(spans)) {
      if (!exists(own)) problems.push(`${where} alignment.spans: "${own}" is not a verse in text.json`);
      if (!valid(last)) problems.push(`${where} alignment.spans: invalid end "${last}"`);
    }
    for (const k of Object.keys(gaps)) if (!valid(k)) problems.push(`${where} alignment.gaps: invalid verse "${k}"`);
    for (const k of Object.keys(notices)) if (!/^[1-3A-Z]{3} \d+$/.test(k)) problems.push(`${where} alignment.notices: key must look like "JHN 3", got "${k}"`);

    for (const [k, groups] of Object.entries(notes || {})) {
      if (!exists(k)) { problems.push(`${where} notes.json: "${k}" is not a verse in text.json`); continue; }
      const verse = text[k.match(KEY)[1]][k.match(KEY)[2] - 1][k.match(KEY)[3] - 1];
      for (const g of groups) {
        if (typeof g.text !== 'string' || !(g.at >= 0 && g.at <= verse.length)) problems.push(`${where} notes.json ${k}: each note needs "text" and an "at" offset inside the verse`);
        for (const l of g.links || []) {
          if (!(l.s >= 0 && l.e <= g.text.length && l.s < l.e)) problems.push(`${where} notes.json ${k}: link offsets outside the note text`);
          for (const [b] of l.to || []) if (!byId.has(b)) problems.push(`${where} notes.json ${k}: unknown book "${b}" in link`);
        }
      }
    }
  }
  if (!translations.length) problems.push('No translations found in data/translations/');
  return problems;
}
