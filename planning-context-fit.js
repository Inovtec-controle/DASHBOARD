(()=>{
"use strict";
const MARGIN=8;
let raf=0;
function visibleBounds(){
  let left=MARGIN,top=MARGIN,right=Math.max(MARGIN,innerWidth-MARGIN),bottom=Math.max(MARGIN,innerHeight-MARGIN);
  try{
    if(parent&&parent!==window){
      const frame=window.frameElement||parent.document.getElementById("legacyFrame");
      if(frame){
        const fr=frame.getBoundingClientRect(),vv=parent.visualViewport;
        const vpLeft=vv?.offsetLeft||0,vpTop=vv?.offsetTop||0;
        const vpWidth=vv?.width||parent.innerWidth,vpHeight=vv?.height||parent.innerHeight;
        left=Math.max(left,vpLeft-fr.left+MARGIN);
        top=Math.max(top,vpTop-fr.top+MARGIN);
        right=Math.min(right,vpLeft+vpWidth-fr.left-MARGIN);
        bottom=Math.min(bottom,vpTop+vpHeight-fr.top-MARGIN);
      }
    }
  }catch{}
  if(right<=left){left=MARGIN;right=Math.max(left,innerWidth-MARGIN)}
  if(bottom<=top){top=MARGIN;bottom=Math.max(top,innerHeight-MARGIN)}
  return{left,top,right,bottom};
}
function fitContextMenu(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{
    const menu=document.getElementById("contextMenu");
    if(!menu?.classList.contains("open"))return;
    const bounds=visibleBounds();
    const availableWidth=Math.max(160,bounds.right-bounds.left);
    const availableHeight=Math.max(140,bounds.bottom-bounds.top);
    menu.style.maxWidth=Math.floor(availableWidth)+"px";
    menu.style.maxHeight=Math.floor(availableHeight)+"px";
    menu.style.overflowY="auto";
    menu.style.overscrollBehavior="contain";
    const rect=menu.getBoundingClientRect();
    const currentLeft=parseFloat(menu.style.left),currentTop=parseFloat(menu.style.top);
    const wantedLeft=Number.isFinite(currentLeft)?currentLeft:bounds.left;
    const wantedTop=Number.isFinite(currentTop)?currentTop:bounds.top;
    const maxLeft=Math.max(bounds.left,bounds.right-rect.width);
    const maxTop=Math.max(bounds.top,bounds.bottom-rect.height);
    menu.style.left=Math.max(bounds.left,Math.min(wantedLeft,maxLeft))+"px";
    menu.style.top=Math.max(bounds.top,Math.min(wantedTop,maxTop))+"px";
  });
}
function start(){
  const menu=document.getElementById("contextMenu");
  if(!menu)return;
  new MutationObserver(fitContextMenu).observe(menu,{attributes:true,attributeFilter:["class"],childList:true,subtree:true});
  if(window.ResizeObserver)new ResizeObserver(fitContextMenu).observe(menu);
  window.addEventListener("resize",fitContextMenu,{passive:true});
  document.addEventListener("scroll",fitContextMenu,true);
  try{
    if(parent&&parent!==window){
      parent.addEventListener("scroll",fitContextMenu,{passive:true});
      parent.addEventListener("resize",fitContextMenu,{passive:true});
      parent.visualViewport?.addEventListener("scroll",fitContextMenu,{passive:true});
      parent.visualViewport?.addEventListener("resize",fitContextMenu,{passive:true});
    }
  }catch{}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();

/* Report standard conservé, sans recalcul de tous les agents à chaque clic. */
(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_STANDARD_RECURRENCE_V2__)return;
window.__INOVTEC_PLANNING_STANDARD_RECURRENCE_V2__=true;
const KEY="inovtec_plannings_v2";
const pad=n=>String(n).padStart(2,"0");
const safe=v=>v==null?"":String(v);
const uid=p=>p+"_"+Date.now()+"_"+Math.random().toString(16).slice(2);
let syncTimer=0,syncing=false;
function parseState(){
  try{
    const raw=localStorage.getItem(KEY);
    const state=raw?JSON.parse(raw):null;
    if(!state||typeof state!=="object"||Array.isArray(state))return null;
    if(!state.weeks||typeof state.weeks!=="object"||Array.isArray(state.weeks))state.weeks={};
    if(!Array.isArray(state.agents))state.agents=[];
    if(!state.standardRecurrence||typeof state.standardRecurrence!=="object"||Array.isArray(state.standardRecurrence))state.standardRecurrence={};
    return state;
  }catch{return null}
}
function rows(state,week,agentId){
  const all=Array.isArray(state.weeks?.[week])?state.weeks[week]:[];
  return all.filter(e=>String(e?.agentId)===String(agentId));
}
function signature(list){
  return JSON.stringify((Array.isArray(list)?list:[]).map(e=>({
    day:Number(e?.day)||0,start:safe(e?.start),end:safe(e?.end),task:safe(e?.task),site:safe(e?.site),
    chantierId:safe(e?.chantierId),note:safe(e?.note)
  })).sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.task.localeCompare(b.task)));
}
function normalizeAgent(a){if(a&&typeof a==="object")a.parityMode=a.parityMode==="alternating"?"alternating":"standard"}
function recurrenceMeta(state,a){
  const id=safe(a?.id);
  let meta=state.standardRecurrence[id];
  if(!meta||typeof meta!=="object"||Array.isArray(meta))meta=state.standardRecurrence[id]={template:"",inheritedWeeks:{}};
  meta.template=safe(meta.template);
  if(!meta.inheritedWeeks||typeof meta.inheritedWeeks!=="object"||Array.isArray(meta.inheritedWeeks))meta.inheritedWeeks={};
  return meta;
}
function isManualWeek(state,week,a,meta){
  const mine=rows(state,week,a.id);
  if(!mine.length)return false;
  const marker=meta.inheritedWeeks?.[week];
  if(!marker)return true;
  const copiedSig=typeof marker==="object"?safe(marker.signature):"";
  return !!copiedSig&&signature(mine)!==copiedSig;
}
function promoteEditedInheritedWeek(state,week,a,meta){
  const marker=meta.inheritedWeeks?.[week];
  if(!marker)return false;
  const mine=rows(state,week,a.id);
  const copiedSig=typeof marker==="object"?safe(marker.signature):"";
  if(copiedSig&&signature(mine)===copiedSig)return false;
  delete meta.inheritedWeeks[week];
  mine.forEach(e=>{if(e&&typeof e==="object")delete e._standardInheritedFrom});
  meta.template=week;
  return true;
}
function latestManualSource(state,targetWeek,a,meta){
  const keys=Object.keys(state.weeks||{}).filter(w=>w<targetWeek&&rows(state,w,a.id).length).sort().reverse();
  return keys.find(w=>isManualWeek(state,w,a,meta))||"";
}
function ensureStandardWeek(state,week,a){
  normalizeAgent(a);
  if(a.parityMode!=="standard")return false;
  const meta=recurrenceMeta(state,a);
  let changed=promoteEditedInheritedWeek(state,week,a,meta);
  const mine=rows(state,week,a.id);
  if(mine.length&&!meta.inheritedWeeks[week]){
    if(meta.template!==week){meta.template=week;changed=true}
    return changed;
  }
  let source=safe(meta.template);
  if(!source||source>=week||!rows(state,source,a.id).length||!isManualWeek(state,source,a,meta)){
    source=latestManualSource(state,week,a,meta);
    if(source&&meta.template!==source){meta.template=source;changed=true}
  }
  if(!source||source>=week)return changed;
  const sourceRows=rows(state,source,a.id);
  if(!sourceRows.length)return changed;
  const sourceSig=signature(sourceRows);
  const marker=meta.inheritedWeeks[week];
  const markerSource=typeof marker==="string"?marker:safe(marker?.source);
  const markerSig=typeof marker==="object"?safe(marker?.sourceSignature):"";
  if(markerSource===source&&markerSig===sourceSig&&mine.length)return changed;
  if(mine.length&&!marker)return changed;
  const keep=(Array.isArray(state.weeks[week])?state.weeks[week]:[]).filter(e=>String(e?.agentId)!==String(a.id));
  const clones=sourceRows.map(src=>({...src,id:uid("e"),agentId:a.id,_standardInheritedFrom:source}));
  state.weeks[week]=keep.concat(clones);
  meta.inheritedWeeks[week]={source,sourceSignature:sourceSig,signature:signature(clones)};
  return true;
}
function currentWeek(){
  const value=document.getElementById("week")?.value;
  if(/^\d{4}-W\d{2}$/.test(value||""))return value;
  const d=new Date(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()+3-((x.getDay()+6)%7));
  const y=new Date(x.getFullYear(),0,4),w=1+Math.round(((x-y)/86400000-3+((y.getDay()+6)%7))/7);
  return x.getFullYear()+"-W"+pad(w);
}
function syncCurrentWeek(){
  if(syncing||document.hidden)return false;
  syncing=true;
  try{
    const state=parseState(),week=currentWeek();
    if(!state||!week)return false;
    let changed=false;
    for(const a of state.agents){
      if(a&&a.parityMode!=="alternating"&&ensureStandardWeek(state,week,a))changed=true;
    }
    if(!changed)return false;
    localStorage.setItem(KEY,JSON.stringify(state));
    window.dispatchEvent(new Event("inovtec:planning-cloud-updated"));
    return true;
  }catch(e){console.warn("Récurrence planning",e);return false}
  finally{syncing=false}
}
function scheduleSync(delay=100){clearTimeout(syncTimer);syncTimer=setTimeout(syncCurrentWeek,delay)}
function bind(){
  // Le calcul doit être déclenché uniquement par un changement de semaine,
  // la sélection d'un agent ou une véritable modification du planning.
  ["prevBtn","nextBtn","todayBtn"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>scheduleSync(100)));
  document.querySelectorAll(".view-tab").forEach(b=>b.addEventListener("click",()=>scheduleSync(100)));
  document.getElementById("agentList")?.addEventListener("click",e=>{if(e.target.closest(".agent-row"))scheduleSync(100)});
  document.getElementById("edDone")?.addEventListener("click",()=>scheduleSync(180));
  document.getElementById("edDelete")?.addEventListener("click",()=>scheduleSync(180));
  // Aucun écouteur global mouseup : il provoquait une analyse complète
  // de tous les agents et une potentielle réécriture Firebase à chaque clic.
  scheduleSync(220);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();