// Prints verses from a translation, to check references and quotations in studies and visuals against the data.
//   node tools/verses.mjs [vdcc|ntr] "DAN 1:1" "ISA 39:6-7" ...
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
let [tr, ...refs] = process.argv.slice(2);
if (!['vdcc', 'ntr'].includes(tr)) { refs.unshift(tr); tr = 'vdcc'; }
const text = JSON.parse(fs.readFileSync(path.join(root, 'data/translations', tr, 'text.json'), 'utf8'));
for (const ref of refs) {
  const m = /^([1-3A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) { console.log(`? ${ref}`); continue; }
  const [b, c, from, to] = [m[1], +m[2], +m[3], +(m[4] || m[3])];
  for (let v = from; v <= to; v++) console.log(`${b} ${c}:${v}  ${text[b]?.[c - 1]?.[v - 1] ?? '— lipsește'}`);
}
