function highlightRanges(text){
  if(!state.search||!state.terms.length)return [];
  const normalized=norm(text),ranges=[];
  for(const term of state.terms){let p=0;while((p=normalized.indexOf(term,p))>=0){if(!$('whole').checked||((p===0||!/[a-z0-9]/.test(normalized[p-1]))&&(p+term.length===normalized.length||!/[a-z0-9]/.test(normalized[p+term.length]))))ranges.push([p,p+term.length]);p+=Math.max(term.length,1);}}
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push(range.slice());}
  return merged;
}
function highlight(text,start=0,end=text.length,ranges=highlightRanges(text)){
  let content='',cursor=start;
  for(const [from,to] of ranges){const a=Math.max(start,from),b=Math.min(end,to);if(a>=b)continue;content+=esc(text.slice(cursor,a))+'<mark>'+esc(text.slice(a,b))+'</mark>';cursor=b;}
  return content+esc(text.slice(cursor,end));
}
