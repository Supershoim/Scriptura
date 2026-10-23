import fs from 'node:fs';import zlib from 'node:zlib';import path from 'node:path';
import {parsed,names,counts} from './parse.mjs';
import {compileReferences} from './references.mjs';
const references=compileReferences(parsed,names,counts);
fs.writeFileSync(new URL('./reference-report.json',import.meta.url),JSON.stringify({stats:references.stats,missing:references.missing,suspicious:references.suspicious},null,2));
const dest=path.resolve('bible-search/dist');fs.mkdirSync(dest,{recursive:true});
const vd=parsed[0].result,nt=parsed[1].result;
const keys=[...new Set([...Object.keys(vd),...Object.keys(nt)])].sort((a,b)=>{const x=a.split(':').map(Number),y=b.split(':').map(Number);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]});
const ntrMap={},rows=[];
for(const k of keys){
const [b,c,v]=k.split(':').map(Number);if(b===63&&v===15)continue;
const a=vd[k],n=nt[k];let text=n?.t||'',label='',np=n?.p||0,missingA='',missingN='';
if(b===46&&c===13){if(v===12){label='12–13';}if(v===13){text='';label='—';missingN='Textele VDCC 12–13 sunt cuprinse în NTR 12 (rândul anterior).';}if(v===14){text=nt['46:13:13'].t;np=nt['46:13:13'].p;label='13';}}
if(b===63&&v===14){text=nt['63:1:14'].t+' '+nt['63:1:15'].t;label='14–15';}
if(b===49&&c===1){if(v===29)label='29–30';if(v===30){text='';label='—';missingN='Cuprins în blocul NTR 29–30, afișat pe rândul anterior.';}}
if(b===65&&c===12&&v===18)missingA='Această propoziție este la începutul din VDCC 13:1.';
rows.push([b,c,v,a?.t||'',text,a?.p||0,np,label,missingA,missingN]);
}
for(const k of Object.keys(nt)){let a=k.split(':').map(Number);if(a[0]===46&&a[1]===13&&a[2]===13)a[2]=14;if(a[0]===63&&a[2]===15)a[2]=14;ntrMap[k]=a;}
ntrMap['49:1:30']=[49,1,29];
const payload={books:names,chapters:counts,rows,ntrMap,references:[references.result,{}],metadata:{sources:['Biblia-VDCC.pdf','Biblia-NTR.pdf'],date:'2026-10-17',chaptersPerTranslation:1189,verses:parsed.map(p=>Object.keys(p.result).length),crossReferences:references.stats}};
const packed=zlib.gzipSync(JSON.stringify(payload),{level:9}).toString('base64');
let html=fs.readFileSync(new URL('./app-template.html',import.meta.url),'utf8').replace('__DATA__',packed).replace('*{box-sizing:border-box}','[hidden]{display:none!important}*{box-sizing:border-box}');
fs.writeFileSync(path.join(dest,'index.html'),html);
fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync('outputs/Scriptura-VDCC-NTR.html',html);
const warnings=parsed.map(p=>p.issues.length+p.missing.length);if(warnings.some(Boolean))throw Error('Index failed validation');
for(let di=0;di<2;di++){const result=parsed[di].result;for(let b=0;b<66;b++)for(let c=1;c<=counts[b];c++){if(!result[b+':'+c+':1'])throw Error('Missing chapter');}}
console.log(JSON.stringify({htmlBytes:Buffer.byteLength(html),rows:rows.length,rawVerses:payload.metadata.verses,chapters:counts.reduce((a,b)=>a+b),gzBytes:packed.length*.75,crossReferences:references.stats,samples:rows.filter(r=>r[0]===42&&r[1]===3&&r[2]===16)},null,2));
