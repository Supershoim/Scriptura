// Writers that keep the data files diff-friendly: one chapter (text) or one verse (notes) per line.
import fs from 'node:fs';

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function writeText(file, text) {
  const books = Object.entries(text).map(([id, chapters]) =>
    `  ${JSON.stringify(id)}: [\n` + chapters.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]');
  fs.writeFileSync(file, '{\n' + books.join(',\n') + '\n}\n');
}

export function writeNotes(file, notes) {
  const lines = Object.entries(notes).map(([key, groups]) => `  ${JSON.stringify(key)}: ${JSON.stringify(groups)}`);
  fs.writeFileSync(file, '{\n' + lines.join(',\n') + '\n}\n');
}
