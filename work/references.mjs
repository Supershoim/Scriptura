// Keep the printed text intact and annotate only recognized Bible references.
const abbreviations = 'Gen|Exod|Lev|Num|Deut|Ios|Judc|Rut|1 Sam|2 Sam|1 Împ|2 Împ|1 Cron|2 Cron|Ezra|Neem|Est|Iov|Ps|Prov|Ecl|Cânt|Isa|Ier|Plân|Ezec|Dan|Osea|Ioel|Amos|Obad|Iona|Mica|Naum|Hab|Țef|Hag|Zah|Mal|Mat|Marc|Luca|Ioan|Fapt|Rom|1 Cor|2 Cor|Gal|Efes|Filp|Col|1 Tes|2 Tes|1 Tim|2 Tim|Tit|Film|Evr|Iac|1 Pet|2 Pet|1 Ioan|2 Ioan|3 Ioan|Iuda|Apoc'.split('|');
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f.\s]/g, '');
const quote = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const expand = s => s.split(',').flatMap(x => {const [a,b] = x.trim().split(/[-–]/).map(Number);return b ? Array.from({length: Math.max(0, Math.min(151,b-a+1))},(_,i)=>a+i) : [a];});

export function compileReferences(parsed, names, chapters) {
  const lookup = new Map();
  names.forEach((s,b)=>lookup.set(norm(s),b));
  abbreviations.forEach((s,b)=>lookup.set(norm(s),b));
  const extras={'Jud':6,'Filip':49,'Ieremia':23,'1Sam':8,'1Tim':53,'l Împ':10};
  for(const [s,b] of Object.entries(extras))lookup.set(norm(s),b);
  const named = [...new Set([...abbreviations,...names,...Object.keys(extras)])].sort((a,b)=>b.length-a.length)
    .map(s=>quote(s).replace(/ /g,'\\s*')+'[.,]?').join('|');
  const series = '\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?:\\s*,\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)*';
  const pattern = new RegExp('(?<![\\p{L}\\d])(?:(?<name>'+named+'|Cap\\.?|Vers\\.?)\\s*)?(?<first>'+series+')(?:\\.\\s*(?<verses>'+series+')(?![\\d]|\\s*\\p{L}))?(?![\\p{L}\\d])','giu');
  const result = {};
  const missing = [], suspicious = [];
  let total=0,anchored=0,endPlaced=0;
  for(const [key,row] of Object.entries(parsed[0].result)) {
    if(!row.refs.length)continue;
    let footnote=false;
    const printed=row.refs.filter(x=>{if(/^\d+\.\s+\p{L}/u.test(x.t))footnote=true;if(/^[*†‡]/.test(x.t))footnote=false;return !footnote&&!/^\(.*(?:Oprire|Capitolele|instrumente)/i.test(x.t);});
    const text=printed.map(x=>x.t).join('\n');if(!text)continue;
    let book=row.b,chapter=row.c,mode='chapter',lastEnd=0;
    const links=[];
    for(const match of text.matchAll(pattern)) {
      const {name,first,verses}=match.groups, nameKey=norm(name||'');
      // A note marker begins a new context. Cap./Vers. always refer to the source verse.
      if(/[*†‡]/.test(text.slice(lastEnd,match.index))){book=row.b;chapter=row.c;mode='chapter';}
      lastEnd=match.index+match[0].length;
      if(nameKey==='cap'){book=row.b;mode='chapter';}
      else if(nameKey==='vers'){book=row.b;chapter=row.c;mode='verse';}
      else if(nameKey){book=lookup.get(nameKey);mode=chapters[book]===1?'verse':'chapter';if(mode==='verse')chapter=1;}
      else if(!verses && mode!=='verse')continue;
      const firstNumbers=expand(first), targets=[];
      if(verses){chapter=firstNumbers[0];mode='chapter';targets.push({b:book,c:chapter,vs:expand(verses)});}
      else if(mode==='verse')targets.push({b:book,c:chapter,vs:firstNumbers});
      else for(const c of firstNumbers)targets.push({b:book,c,vs:[]});
      if(targets.some(t=>t.b===undefined||t.c<1||t.c>chapters[t.b]||t.vs.some(v=>v<1||v>176)))suspicious.push({key,label:match[0],targets});
      for(const target of targets) {
        const numbers=target.vs.length?target.vs:[1];
        for(const v of numbers)if(!parsed[0].result[target.b+':'+target.c+':'+v])missing.push({key,label:match[0],target:{...target,v}});
      }
      links.push({s:match.index,e:lastEnd,targets});total++;
    }
    // Standalone psalm performance directions are not cross references.
    if(links.length||/[\d*†‡]/.test(text)){
      const marked=row.marked||row.t;
      if(marked.replace(/[*†‡]/g,'').replace(/\s+/g,' ').trim()!==row.t)throw Error('Marker alignment differs from verse text: '+key);
      const anchors=[...marked.matchAll(/[*†‡]+/g)].map(m=>({marker:m[0],at:marked.slice(0,m.index).replace(/[*†‡]/g,'').replace(/\s+/g,' ').trimStart().length}));
      const markers=[...text.matchAll(/[*†‡]+/g)];
      const groups=markers.map((m,i)=>({s:m.index,e:markers[i+1]?.index??text.length,marker:m[0]}));
      if(!markers.length)groups.push({s:0,e:text.length,marker:''});
      else if(text.slice(0,markers[0].index).trim())groups.unshift({s:0,e:markers[0].index,marker:''});
      const placements=[];
      for(const group of groups){
        const matches=anchors.filter(a=>a.marker===group.marker);
        if(matches.length){for(const anchor of matches)placements.push({...group,at:anchor.at});anchored++;}
        else {placements.push({...group,at:row.t.length});endPlaced++;}
      }
      placements.sort((a,b)=>a.at-b.at||a.s-b.s);
      result[key]={text,links,placements,pages:[...new Set(printed.map(x=>x.p))]};
    }
  }
  return {result,stats:{verses:Object.keys(result).length,links:total,anchoredGroups:anchored,endPlacedGroups:endPlaced,missing:missing.length,suspicious:suspicious.length},missing,suspicious};
}
