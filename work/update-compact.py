from pathlib import Path

p=Path('work/app-template.html')
s=p.read_text(encoding='utf8')
a=s.index('function cell(r,edition){')
b=s.index('function rowsHtml(',a)
s=s[:a]+Path('work/cell.js').read_text(encoding='utf8')+'\n'+s[b:]
a=s.index("$('verses').onclick=")
b=s.index('\n',a)
s=s[:a]+"$('verses').onclick=e=>{const reference=e.target.closest('[data-reference]');if(reference){showReference(reference);return;}const open=e.target.closest('[data-open]');if(open)read(...open.dataset.open.split(':').map(Number));};"+s[b:]
a=s.index('function fontChange(delta){')
b=s.index("$('theme').onclick=",a)
s=s[:a]+'''function setFont(size){
  const value=Number(size);state.font=Number.isFinite(value)?Math.max(14,Math.min(30,Math.round(value))):19;
  document.documentElement.style.setProperty('--font',state.font+'px');
  $('fontSize').value=state.font;$('fontValue').value=state.font+' px';$('fontSize').setAttribute('aria-valuetext',state.font+' pixeli');
  $('fontDown').disabled=state.font===14;$('fontUp').disabled=state.font===30;$('fontReset').disabled=state.font===19;
  safeSet('scriptura-font',state.font);if(!$('referencePopup').hidden)positionReference();
}
function fontChange(delta){setFont(state.font+delta);}
$('fontDown').onclick=()=>fontChange(-1);$('fontUp').onclick=()=>fontChange(1);
$('fontSize').oninput=()=>setFont($('fontSize').value);$('fontReset').onclick=()=>setFont(19);
'''+s[b:]
s=s.replace('<div id="navigation">','<div class="text-size-control" role="group" aria-label="Dimensiunea textului"><label for="fontSize">Dimensiune text</label><input id="fontSize" type="range" min="14" max="30" step="1" value="19"><output id="fontValue" for="fontSize">19 px</output><button id="fontReset" title="Revino la dimensiunea implicită de 19 pixeli">Implicit</button></div>\n<div id="navigation">',1)
css='''
/* Compact reading layout and persistent text-size controls. */
.shell{max-width:1800px}.topbar{height:68px;padding:0 25px}.layout{grid-template-columns:215px minmax(0,1fr)}aside{padding:20px 12px}.booklist button{padding:6px 9px}main{padding:20px 28px}.intro{margin-bottom:14px}.intro h2{font-size:28px;margin:4px 0}.introbadge{padding:7px 12px}.searchbox{padding:4px}.searchbox input{padding:8px}.searchoptions{margin-top:6px}.shortcuts{margin-top:7px}.divider{margin:16px 0}.readerbar h2{font-size:26px}.readermeta{margin-top:3px}.jumpline{margin:10px 0;gap:8px}.jumpline select{padding:6px 9px}.jumpline button{padding:6px 10px}.translationhead{padding:9px 14px}.versecell{padding:7px 14px;gap:8px}.vtext{font-size:var(--font);line-height:1.45}.vnum{line-height:1.6;padding-top:1px}.inline-references{font-size:max(10px,calc(var(--font) * .58));line-height:1.4;margin:0 .15em}.popup-text{font-size:max(14px,calc(var(--font) - 3px));line-height:1.55}.footer{margin-top:15px}
.text-size-control{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--paper);width:fit-content;max-width:100%;font-size:11px}.text-size-control label{font-weight:600}.text-size-control input{width:160px;max-width:38vw;padding:0;accent-color:var(--green);cursor:pointer}.text-size-control output{min-width:34px;font-variant-numeric:tabular-nums;color:var(--muted)}.text-size-control button{padding:3px 7px;font-size:10px}
@media(max-width:760px){.topbar{height:62px;padding:0 12px}.layout{display:block}main{padding:16px 10px}.intro h2{font-size:25px}.intro{margin-bottom:12px}.divider{margin:13px 0}.translationhead{padding:8px}.versecell{padding:6px 7px;gap:4px}.vtext{font-size:var(--font);line-height:1.42}.text-size-control{gap:7px;padding:6px 8px;width:100%}.text-size-control input{flex:1;min-width:80px;max-width:none;width:100px}.text-size-control label{font-size:10px}.popup-text{font-size:max(14px,calc(var(--font) - 3px))}.jumpline select#book{min-width:130px}.jumpline select{padding:6px}.jumpline button{padding:5px 8px}}
@media print{.text-size-control{display:none!important}}
'''
s=s.replace('</style>',css+'</style>',1)
s=s.replace('Poți copia un verset din fiecare traducere sau întregul capitol.','Poți copia întregul capitol în VDCC, NTR sau ambele traduceri.')
s=s.replace('Copierea unui verset sau a capitolului în clipboard include exclusiv textul biblic, fără trimiteri sau marcaje.','Copierea capitolului în clipboard include exclusiv textul biblic, fără trimiteri sau marcaje.')
s=s.replace(' Pagina PDF este indicată sub fiecare verset.','')
s=s.replace('<h3>Offline și confidențialitate</h3>','<h3>Dimensiunea textului</h3><p>Folosește glisorul „Dimensiune text” de deasupra capitolului pentru a alege între 14 și 30 px. Butoanele A− și A+ ajustează aceeași valoare. „Implicit” revine la 19 px. Alegerea este salvată pe dispozitivul tău și se aplică ambelor traduceri și previzualizărilor.</p>\n<h3>Offline și confidențialitate</h3>')
assert 'data-copy="' not in s
assert 'class="sourcepage"' not in s
p.write_text(s,encoding='utf8')
print('Compact layout and text size control integrated')
