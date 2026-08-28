(()=>{
"use strict";
if(window.__INOVTEC_SEARCH_HANDOFF_V1__)return;
window.__INOVTEC_SEARCH_HANDOFF_V1__=true;
const frame=document.getElementById("legacyFrame");
if(!frame)return;
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
function read(){
  try{
    const x=JSON.parse(sessionStorage.getItem("inovtec_global_search_handoff_v1")||"null");
    if(!x||Date.now()-Number(x.createdAt||0)>60000){sessionStorage.removeItem("inovtec_global_search_handoff_v1");return null}
    return x;
  }catch{return null}
}
function consume(){try{sessionStorage.removeItem("inovtec_global_search_handoff_v1")}catch{}}
function highlight(el){
  if(!el)return;
  const oldOutline=el.style.outline,oldOffset=el.style.outlineOffset;
  el.style.outline="3px solid #22c55e";el.style.outlineOffset="3px";
  el.scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>{el.style.outline=oldOutline;el.style.outlineOffset=oldOffset},3500);
}
function apply(){
  const h=read();if(!h||h.mode!==mode)return;
  let d;try{d=frame.contentDocument}catch{return}
  if(!d)return;
  if(mode==="agents"){
    const input=d.getElementById("search");
    if(input){input.value=h.label||"";input.dispatchEvent(new Event("input",{bubbles:true}));setTimeout(()=>{const items=[...d.querySelectorAll("#agentList .listItem")],exact=items.find(x=>(x.querySelector(".name")?.textContent||"").trim().toLowerCase()===(h.label||"").trim().toLowerCase())||items[0];if(exact){exact.click();highlight(exact)}consume()},120);return}
  }
  if(mode==="infos"){
    const input=d.getElementById("search");
    if(input){input.value=h.label||"";input.dispatchEvent(new Event("input",{bubbles:true}));setTimeout(()=>{const items=[...d.querySelectorAll("#siteList .site-item")],exact=items.find(x=>(x.querySelector("strong")?.textContent||"").trim().toLowerCase()===(h.label||"").trim().toLowerCase())||items[0];if(exact){exact.click();highlight(exact)}consume()},120);return}
  }
  if(mode==="organisation"){
    const find=()=>{const items=[...d.querySelectorAll(".task")],exact=items.find(x=>(x.querySelector(".task-title")?.textContent||"").trim().toLowerCase()===(h.label||"").trim().toLowerCase())||items.find(x=>(x.textContent||"").toLowerCase().includes((h.label||"").toLowerCase()));if(exact){highlight(exact);consume();return true}return false};
    if(find())return;setTimeout(find,400);setTimeout(find,1200);
  }
}
frame.addEventListener("load",()=>{setTimeout(apply,80);setTimeout(apply,500)});
setTimeout(apply,400);
})();