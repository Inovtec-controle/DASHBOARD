(()=>{
"use strict";
if(window.__INOVTEC_AGENTS_LIST_FIT_V1__)return;
window.__INOVTEC_AGENTS_LIST_FIT_V1__=true;

const list=document.getElementById("agentList");
const content=document.querySelector(".content");
if(!list||!content)return;

const style=document.createElement("style");
style.id="ivAgentsListFitStyle";
style.textContent=`
#agentList.iv-fit-list{
  display:grid!important;
  grid-auto-flow:column!important;
  grid-template-rows:repeat(var(--iv-agent-rows,1),minmax(0,1fr))!important;
  grid-template-columns:repeat(var(--iv-agent-cols,1),minmax(0,1fr))!important;
  gap:var(--iv-agent-gap,6px)!important;
  max-height:none!important;
  overflow:visible!important;
  align-content:start!important;
}
#agentList.iv-fit-list .listItem{
  min-width:0!important;
  min-height:0!important;
  height:var(--iv-agent-row-h,56px)!important;
  padding:var(--iv-agent-pad,8px)!important;
  border-radius:12px!important;
  gap:6px!important;
}
#agentList.iv-fit-list .liMain{gap:7px!important}
#agentList.iv-fit-list .avatar{
  width:var(--iv-agent-avatar,34px)!important;
  height:var(--iv-agent-avatar,34px)!important;
  min-width:var(--iv-agent-avatar,34px)!important;
  border-radius:11px!important;
  font-size:var(--iv-agent-avatar-font,12px)!important;
}
#agentList.iv-fit-list .liText .name{
  font-size:var(--iv-agent-name-font,12px)!important;
  line-height:1.1!important;
}
#agentList.iv-fit-list .liText .sub{
  font-size:var(--iv-agent-sub-font,9px)!important;
  margin-top:2px!important;
}
#agentList.iv-fit-list .badge{
  font-size:var(--iv-agent-badge-font,9px)!important;
  padding:4px 6px!important;
  white-space:nowrap!important;
}
#agentList.iv-fit-list.iv-fit-tight .liText .sub{display:none!important}
#agentList.iv-fit-list.iv-fit-tight .badge{display:none!important}
body.iv-agents-fit-active .content{
  grid-template-columns:minmax(300px,var(--iv-agent-panel-w,340px)) minmax(300px,1fr)!important;
  align-items:start!important;
}
@media(max-width:980px){
  body.iv-agents-fit-active .content{grid-template-columns:1fr!important}
  #agentList.iv-fit-list{
    grid-auto-flow:row!important;
    grid-template-rows:none!important;
    grid-template-columns:repeat(var(--iv-agent-mobile-cols,1),minmax(0,1fr))!important;
  }
  #agentList.iv-fit-list .listItem{height:auto!important;min-height:50px!important}
}
`;
document.head.appendChild(style);

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function fit(){
  const items=[...list.children].filter(el=>el.classList?.contains("listItem"));
  const count=items.length;
  if(!count){
    list.classList.remove("iv-fit-list","iv-fit-tight");
    document.body.classList.remove("iv-agents-fit-active");
    return;
  }

  const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
  const vh=Math.max(document.documentElement.clientHeight||0,window.innerHeight||0);

  document.body.classList.add("iv-agents-fit-active");
  list.classList.add("iv-fit-list");

  if(vw<=980){
    const mobileCols=vw>=720&&count>=8?2:1;
    list.style.setProperty("--iv-agent-mobile-cols",String(mobileCols));
    list.style.removeProperty("--iv-agent-rows");
    list.style.removeProperty("--iv-agent-cols");
    list.style.removeProperty("--iv-agent-row-h");
    content.style.removeProperty("--iv-agent-panel-w");
    list.classList.remove("iv-fit-tight");
    return;
  }

  const listTop=list.getBoundingClientRect().top;
  const available=Math.max(180,vh-listTop-12);
  const minDetails=clamp(vw*0.34,330,470);
  const maxPanel=Math.max(320,vw-minDetails-42);
  const minColWidth=155;
  const maxCols=clamp(Math.floor(maxPanel/minColWidth),1,4);
  const targetRow=48;
  const capacityPerCol=Math.max(1,Math.floor(available/targetRow));
  let cols=clamp(Math.ceil(count/capacityPerCol),1,maxCols);
  let rows=Math.ceil(count/cols);
  let rowH=available/rows;

  while(cols<maxCols&&rowH<36){
    cols++;
    rows=Math.ceil(count/cols);
    rowH=available/rows;
  }

  rowH=clamp(rowH,30,62);
  const panelW=clamp(cols*170+28,320,maxPanel);
  const tight=rowH<44||panelW/cols<165;

  content.style.setProperty("--iv-agent-panel-w",Math.round(panelW)+"px");
  list.style.setProperty("--iv-agent-cols",String(cols));
  list.style.setProperty("--iv-agent-rows",String(rows));
  list.style.setProperty("--iv-agent-row-h",Math.floor(rowH)+"px");
  list.style.setProperty("--iv-agent-gap",rowH<38?"4px":"6px");
  list.style.setProperty("--iv-agent-pad",rowH<38?"5px":rowH<48?"6px":"8px");
  list.style.setProperty("--iv-agent-avatar",rowH<38?"26px":rowH<48?"30px":"34px");
  list.style.setProperty("--iv-agent-avatar-font",rowH<38?"9px":"11px");
  list.style.setProperty("--iv-agent-name-font",rowH<38?"10px":rowH<48?"11px":"12px");
  list.style.setProperty("--iv-agent-sub-font","9px");
  list.style.setProperty("--iv-agent-badge-font","9px");
  list.classList.toggle("iv-fit-tight",tight);
}
let raf=0;
function schedule(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(fit);
}
const observer=new MutationObserver(schedule);
observer.observe(list,{childList:true,subtree:true,characterData:true});
window.addEventListener("resize",schedule);
window.addEventListener("orientationchange",schedule);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule()});
setTimeout(schedule,0);
setTimeout(schedule,250);
setTimeout(schedule,900);
})();