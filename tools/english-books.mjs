// English Bible book names and abbreviations as printed by Thomas Nelson (King James / NKJV Study Bible):
// used to read references in the imported notes and to turn them into the Romanian abbreviations of data/books.json.
export const ENGLISH = {
  GEN: ['Genesis', 'Gen'], EXO: ['Exodus', 'Ex', 'Exod'], LEV: ['Leviticus', 'Lev'], NUM: ['Numbers', 'Num'], DEU: ['Deuteronomy', 'Deut'],
  JOS: ['Joshua', 'Josh'], JDG: ['Judges', 'Judg'], RUT: ['Ruth'], '1SA': ['1 Samuel', '1 Sam'], '2SA': ['2 Samuel', '2 Sam'],
  '1KI': ['1 Kings', '1 Kin'], '2KI': ['2 Kings', '2 Kin'], '1CH': ['1 Chronicles', '1 Chr'], '2CH': ['2 Chronicles', '2 Chr'],
  EZR: ['Ezra'], NEH: ['Nehemiah', 'Neh'], EST: ['Esther', 'Esth'], JOB: ['Job'], PSA: ['Psalms', 'Psalm', 'Ps', 'Pss'],
  PRO: ['Proverbs', 'Prov'], ECC: ['Ecclesiastes', 'Eccl'], SNG: ['Song of Solomon', 'Song'], ISA: ['Isaiah', 'Is', 'Isa'],
  JER: ['Jeremiah', 'Jer'], LAM: ['Lamentations', 'Lam'], EZK: ['Ezekiel', 'Ezek'], DAN: ['Daniel', 'Dan'], HOS: ['Hosea', 'Hos'],
  JOL: ['Joel'], AMO: ['Amos'], OBA: ['Obadiah', 'Obad'], JON: ['Jonah', 'Jon'], MIC: ['Micah', 'Mic'], NAM: ['Nahum', 'Nah'],
  HAB: ['Habakkuk', 'Hab'], ZEP: ['Zephaniah', 'Zeph'], HAG: ['Haggai', 'Hag'], ZEC: ['Zechariah', 'Zech'], MAL: ['Malachi', 'Mal'],
  MAT: ['Matthew', 'Matt'], MRK: ['Mark'], LUK: ['Luke'], JHN: ['John'], ACT: ['Acts'], ROM: ['Romans', 'Rom'],
  '1CO': ['1 Corinthians', '1 Cor'], '2CO': ['2 Corinthians', '2 Cor'], GAL: ['Galatians', 'Gal'], EPH: ['Ephesians', 'Eph'],
  PHP: ['Philippians', 'Phil'], COL: ['Colossians', 'Col'], '1TH': ['1 Thessalonians', '1 Thess'], '2TH': ['2 Thessalonians', '2 Thess'],
  '1TI': ['1 Timothy', '1 Tim'], '2TI': ['2 Timothy', '2 Tim'], TIT: ['Titus'], PHM: ['Philemon', 'Philem'], HEB: ['Hebrews', 'Heb'],
  JAS: ['James'], '1PE': ['1 Peter', '1 Pet'], '2PE': ['2 Peter', '2 Pet'], '1JN': ['1 John'], '2JN': ['2 John'], '3JN': ['3 John'],
  JUD: ['Jude'], REV: ['Revelation', 'Rev']
};
export const byName = new Map();
for (const [id, names] of Object.entries(ENGLISH)) for (const n of names) byName.set(n.toUpperCase(), id);
export const BOOK_RE = [...byName.keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/ /g, '\\s')).join('|');

// "Ps. 33:6, 9" (a book followed by chapter:verse) anywhere in a text.
export const BOOK_REF = new RegExp(String.raw`\b(${BOOK_RE})\.?(?=\s+\d{1,3}:\d)`, 'gi');
