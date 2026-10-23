function cell(r,edition){
  const text=r[edition?4:3],label=edition?(r[7]||String(r[2])):String(r[2]);
  const missing=r[edition?9:8]||'Versetul nu are o intrare distinctă în această ediție.';
  return '<div class="versecell"><span class="vnum">'+esc(label)+'</span><div class="vbody">'+(text?'<div class="vtext">'+verseText(r,edition)+'</div>':'<div class="missing">'+esc(missing)+'</div>')+'</div></div>';
}
