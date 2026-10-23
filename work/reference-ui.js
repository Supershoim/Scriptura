let referenceAnchor=null,referenceTimer=0,referenceTarget=null,referenceEdition=0;
function hideReference(){clearTimeout(referenceTimer);$('referencePopup').hidden=true;referenceAnchor?.setAttribute('aria-expanded','false');referenceAnchor=null;}
function scheduleReferenceClose(){clearTimeout(referenceTimer);referenceTimer=setTimeout(hideReference,220);}
function referenceGroup(key,edition,entry,group){
  let content='',cursor=group.s;
  entry.links.forEach((link,i)=>{if(link.s<group.s||link.e>group.e)return;content+=esc(entry.text.slice(cursor,link.s))+'<button class="ref-link" data-reference="'+key+'" data-reference-index="'+i+'" data-reference-edition="'+edition+'" aria-haspopup="dialog" aria-controls="referencePopup" aria-expanded="false">'+esc(entry.text.slice(link.s,link.e))+'</button>';cursor=link.e;});
  content+=esc(entry.text.slice(cursor,group.e));
  return '<span class="inline-references" data-no-copy="true" aria-label="Trimiteri din PDF">['+content.trim()+']</span>';
}
function verseText(r,edition){
  const text=r[edition?4:3],key=r.slice(0,3).join(':'),entry=DATA.references?.[edition]?.[key],ranges=highlightRanges(text);
  if(!entry?.placements?.length)return highlight(text,0,text.length,ranges);
  let content='',cursor=0;
  for(const placement of entry.placements){content+=highlight(text,cursor,placement.at,ranges)+referenceGroup(key,edition,entry,placement);cursor=placement.at;}
  return content+highlight(text,cursor,text.length,ranges);
}
function positionReference(){
  if(!referenceAnchor?.isConnected)return hideReference();
  const popup=$('referencePopup'),rect=referenceAnchor.getBoundingClientRect();
  if(rect.bottom<0||rect.top>window.innerHeight)return hideReference();
  const width=popup.offsetWidth,height=popup.offsetHeight;
  const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
  const below=window.innerHeight-rect.bottom-10,above=rect.top-10;
  const top=below>=Math.min(height,240)||below>=above?Math.min(rect.bottom+8,window.innerHeight-height-12):Math.max(12,rect.top-height-8);
  popup.style.left=left+'px';popup.style.top=Math.max(12,top)+'px';
}
function showReference(button){
  clearTimeout(referenceTimer);referenceAnchor?.setAttribute('aria-expanded','false');referenceAnchor=button;button.setAttribute('aria-expanded','true');
  const edition=+button.dataset.referenceEdition,entry=DATA.references[edition][button.dataset.reference],link=entry.links[+button.dataset.referenceIndex];
  referenceEdition=edition;referenceTarget=link.targets[0];
  $('referenceTitle').textContent=link.targets.map(t=>BOOKS[t.b]+' '+t.c+(t.vs.length?':'+t.vs.join(', '):'')).join('; ');
  $('referenceEdition').textContent=(edition?'NTR':'VDCC')+' · '+entry.text.slice(link.s,link.e).replace(/\s+/g,' ');
  let content='',firstResolved=null;
  for(const target of link.targets){
    const chapter=INDEX.get(target.b+':'+target.c)||[],numbers=target.vs.length?target.vs:chapter.map(r=>r[2]);
    if(!chapter.length){content+='<p class="ref-empty">Referința apare astfel în PDF, dar capitolul nu există în textul indexat.</p>';continue;}
    for(const v of numbers){
      let mapped=edition?DATA.ntrMap[target.b+':'+target.c+':'+v]:null;
      const row=mapped?(INDEX.get(mapped[0]+':'+mapped[1])||[]).find(r=>r[2]===mapped[2]):chapter.find(r=>r[2]===v);
      const text=row?.[edition?4:3];
      if(text&&!firstResolved)firstResolved={b:row[0],c:row[1],v:row[2]};
      content+='<p><sup>'+esc(v)+'</sup>'+(text?esc(text):'<span class="ref-empty">Referința apare astfel în PDF, dar acest verset nu are text în ediția indexată.</span>')+'</p>';
    }
  }
  referenceTarget=firstResolved;$('openReference').hidden=!firstResolved;
  $('referenceText').innerHTML=content;$('referencePopup').hidden=false;$('referencePopup').scrollTop=0;positionReference();
}
function chapterText(edition='both'){
  const rows=INDEX.get(state.b+':'+state.c)||[],header=BOOKS[state.b]+' '+state.c;
  const part=name=>name+'\n'+rows.filter(r=>r[name==='VDCC'?3:4]).map(r=>(name==='NTR'?(r[7]||r[2]):r[2])+'. '+r[name==='VDCC'?3:4]).join('\n');
  return header+'\n\n'+(edition==='both'?part('VDCC')+'\n\n'+part('NTR'):part(edition==='ntr'?'NTR':'VDCC'));
}
$('verses').addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const button=e.target.closest('[data-reference]');if(button&&button!==referenceAnchor)showReference(button);});
$('verses').addEventListener('pointerout',e=>{const button=e.target.closest('[data-reference]');if(button&&!button.contains(e.relatedTarget)&&!$('referencePopup').contains(e.relatedTarget))scheduleReferenceClose();});
$('verses').addEventListener('focusin',e=>{const button=e.target.closest('[data-reference]');if(button)showReference(button);});
$('verses').addEventListener('focusout',e=>{if(e.target.closest('[data-reference]')&&!$('referencePopup').contains(e.relatedTarget))scheduleReferenceClose();});
$('referencePopup').addEventListener('pointerenter',()=>clearTimeout(referenceTimer));
$('referencePopup').addEventListener('pointerleave',scheduleReferenceClose);
$('referencePopup').addEventListener('focusin',()=>clearTimeout(referenceTimer));
$('referencePopup').addEventListener('focusout',e=>{if(!$('referencePopup').contains(e.relatedTarget)&&e.relatedTarget!==referenceAnchor)scheduleReferenceClose();});
$('closeReference').onclick=()=>{const anchor=referenceAnchor;hideReference();anchor?.focus({preventScroll:true});hideReference();};
$('openReference').onclick=()=>{if(referenceTarget){const {b,c,v}=referenceTarget;hideReference();read(b,c,v);}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideReference();});
document.addEventListener('click',e=>{if(!e.target.closest('[data-reference]')&&!$('referencePopup').contains(e.target))hideReference();});
window.addEventListener('resize',()=>{if(!$('referencePopup').hidden)positionReference();});
window.addEventListener('scroll',()=>{if(!$('referencePopup').hidden)positionReference();},{passive:true});
document.querySelectorAll('[data-copy-edition]').forEach(button=>button.onclick=()=>state.ready&&!state.search&&clipboard(chapterText(button.dataset.copyEdition)));
