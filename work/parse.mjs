import fs from 'node:fs';
const pages=JSON.parse(fs.readFileSync('C:/Users/Ovidiu Pop/Documents/Codex/2026-10-17/new-chat/work/positioned-pages.json','utf8'));
export const names='Geneza|Exodul|Leviticul|Numeri|Deuteronomul|Iosua|Judecători|Rut|1 Samuel|2 Samuel|1 Împărați|2 Împărați|1 Cronici|2 Cronici|Ezra|Neemia|Estera|Iov|Psalmi|Proverbe|Eclesiastul|Cântarea cântărilor|Isaia|Ieremia|Plângerile lui Ieremia|Ezechiel|Daniel|Osea|Ioel|Amos|Obadia|Iona|Mica|Naum|Habacuc|Țefania|Hagai|Zaharia|Maleahi|Matei|Marcu|Luca|Ioan|Faptele Apostolilor|Romani|1 Corinteni|2 Corinteni|Galateni|Efeseni|Filipeni|Coloseni|1 Tesaloniceni|2 Tesaloniceni|1 Timotei|2 Timotei|Tit|Filimon|Evrei|Iacov|1 Petru|2 Petru|1 Ioan|2 Ioan|3 Ioan|Iuda|Apocalipsa'.split('|');
export const counts=[50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
const starts=[
[1,59,107,142,190,233,260,287,290,325,354,388,420,451,487,497,513,521,554,639,669,677,682,736,797,803,857,874,882,885,892,893,895,899,901,904,906,908,917,923,961,984,1025,1055,1093,1111,1128,1139,1144,1150,1154,1158,1162,1164,1168,1172,1174,1174,1187,1191,1196,1198,1203,1203,1204,1205].map(n=>n+8),
[9,56,96,125,165,199,222,245,249,279,304,333,362,391,424,434,448,456,481,542,563,571,575,621,672,677,724,739,746,749,755,756,758,762,764,766,769,771,779,783,815,835,869,894,927,941,954,963,968,973,977,980,983,985,989,992,994,995,1005,1009,1013,1016,1020,1021,1022,1023]];
const fix=s=>s.replace(/[ãÃºªþÞşŞţŢ]/g,c=>({'ã':'ă','Ã':'Ă','º':'ș','ª':'Ș','þ':'ț','Þ':'Ț','ş':'ș','Ş':'Ș','ţ':'ț','Ţ':'Ț'}[c]));
const bodyFonts=new Set(pages[0].flatMap(p=>p?p.items.filter(x=>x.h>8.8&&x.h<10.2&&/^\d{1,3}\./.test(x.t.trim())).map(x=>x.f):[]));
const join=(xs,markers=false)=>{xs.sort((a,b)=>a.x-b.x);let s='',prev=null;for(const x of xs){const gap=prev?x.x-prev.x-prev.w:0;s+=(prev&&gap>0.65&&!s.endsWith(' ')?' ':'')+x.t;prev=x;}s=fix(s);if(!markers)s=s.replace(/[*†‡]/g,'');return s.replace(/\s+/g,' ').trim();};
const append=(a,b)=>{if(a.endsWith('-')){const word=a.match(/([a-zăâîșț]+)-$/i)?.[1]?.toLowerCase();if(!new Set(['s','m','mi','i','ți','l','le','v','vă','ne','te','o','îl','într','dintr','printr','ce','și','să','li','nu','n','aș','de','după','pe']).has(word))a=a.slice(0,-1);return a+b;}return a+' '+b;};
function parse(di){
const result={},issues=[];let book=-1,c=1,current=null;
for(let pn=9;pn<pages[di].length;pn++){const page=pages[di][pn];if(!page||(!di&&pn>1231))continue;
const beginnings=starts[di].map((p,b)=>p===pn?b:-1).filter(b=>b>=0);const defaultBook=starts[di].findLastIndex(p=>p<=pn);
let regions;
if(di){regions=[{b:defaultBook,y:Infinity}];}
else if(!beginnings.length){regions=[{b:defaultBook,y:Infinity}];}
else {
 const ys=page.items.filter(x=>x.h>13.8&&x.h<14.2).map(x=>x.y).sort((a,b)=>b-a);const tops=[];for(const y of ys){if(!tops.length||tops[tops.length-1]-y>25)tops.push(y);}
 regions=beginnings.map((b,i)=>({b,y:tops[i]??600}));
 if(beginnings[0]>0)regions.unshift({b:beginnings[0]-1,y:Infinity});
}

for(let ri=0;ri<regions.length;ri++){const r=regions[ri],bottom=regions[ri+1]?.y??-Infinity;
if(book!==r.b){book=r.b;c=1;current=null;}
for(let col=0;col<2;col++){const split=di?306:(pn%2?217:208);const selected=page.items.filter(x=>(x.x<split?0:1)===col&&x.y<r.y&&x.y>bottom&&x.y<(di?736:610)&&x.y>(di?60:20)&&!(di&&(pn===369||(pn===370&&x.x<306&&x.y>503.9))));
const customChapter=x=>false;
const events=selected.filter(x=>(/^\d+$/.test(x.t)&&x.h>20)||customChapter(x)).map(x=>({type:'chapter',n:+x.t,y:x.y+(di?.1:15)}));
const body=selected.filter(x=>!customChapter(x)&&(di?(x.h>11.8&&x.h<12.2&&x.f!=='g_d3_f3'):(x.h>8.8&&x.h<10.2&&bodyFonts.has(x.f))));
const rows=[];for(const x of body){let row=rows.find(a=>Math.abs(a.y-x.y)<.7);if(!row){row={type:'line',y:x.y,xs:[]};rows.push(row);}row.xs.push(x);}
const refs=[];if(!di)for(const x of selected.filter(x=>x.h>6.9&&x.h<7.1)){let row=refs.find(a=>Math.abs(a.y-x.y)<.7);if(!row){row={type:'reference',y:x.y,xs:[]};refs.push(row);}row.xs.push(x);}
if(di&&pn===781&&col===0)events.push({type:'chapter',n:4,y:509});
events.push(...rows,...refs);events.sort((a,b)=>Math.abs(b.y-a.y)<.7?({chapter:0,line:1,reference:2}[a.type]-{chapter:0,line:1,reference:2}[b.type]):b.y-a.y);
for(const e of events){if(e.type==='chapter'){c=e.n;current=null;continue;}
if(e.type==='reference'){if(current)current.refs.push({p:pn,t:join(e.xs,true)});continue;}
const line=join(e.xs);if(!line)continue;const marked=di?'':join(e.xs,true);const m=di?line.match(/^(\d{1,3})(?:[–-](\d{1,3}))?\s+(.*)$/):line.match(/^(\d{1,3})(?:\.\s*|\s+)(.*)$/);
if(m){let v=+m[1];const text=di?m[3]:m[2]; if(!di){if(book===0&&c===41&&v===25&&text.startsWith('Spicele'))v=24;if(book===5&&c===24&&v===34)v=33;if(book===14&&c===2&&v===46&&text.startsWith('fiii lui Ghidel'))v=47;if(book===25&&c===14&&v===11&&text.startsWith('Cuvântul'))v=12;else if(book===25&&c===14&&v===12&&text.startsWith('„Fiul'))v=13;}const key=book+':'+c+':'+v;if(result[key])issues.push({type:'duplicate',key,pn,line});
current={b:book,c,v,t:text,p:pn,refs:[],marked:di?'':marked.replace(/^\d{1,3}(?:\.\s*|\s+)/,'')};result[key]=current;
}else if(current){current.t=append(current.t,line);if(!di)current.marked=append(current.marked,marked);}
}
}
}
}
for(const v of Object.values(result))v.t=v.t.replace(/\s+/g,' ').trim();
const actual=new Set(Object.values(result).map(v=>v.b+':'+v.c));
const missing=counts.flatMap((n,b)=>Array.from({length:n},(_,i)=>[b,i+1]).filter(([b,c])=>!actual.has(b+':'+c)));
return{result,issues,missing};
}
export const parsed=[parse(0),parse(1)];
fs.writeFileSync(new URL('./parsed.json',import.meta.url),JSON.stringify(parsed));
console.log(JSON.stringify(parsed.map((p,di)=>({di,verses:Object.keys(p.result).length,issues:p.issues.length,firstIssues:p.issues.slice(0,8),missing:p.missing})),null,2));
