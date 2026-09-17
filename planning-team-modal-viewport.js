/* Fenêtre des équipes : rester dans la partie visible de l'iframe Planning.
   N'agit que sur #ivTeamModal, sans modifier la hauteur du Planning ou le bureau. */
(()=>{
'use strict';
if(window.__IV_TEAM_MODAL_VIEWPORT__)return;
window.__IV_TEAM_MODAL_VIEWPORT__=true;
let bound=null;
function align(){
 const modal=document.getElementById('ivTeamModal');
 if(!modal?.classList.contains('open'))return;
 try{
  if(parent===window)return;
  const iframe=parent.document.getElementById('legacyFrame');
  if(iframe?.contentWindow!==window)return;
  const r=iframe.getBoundingClientRect();
  const top=Math.max(0,-r.top+8);
  const bottom=Math.min(window.innerHeight,parent.innerHeight-r.top-8);
  const height=Math.max(160,bottom-top);
  modal.style.inset='auto 0 auto 0';
  modal.style.top=top+'px';
  modal.style.height=height+'px';
  const panel=modal.querySelector('.iv-team-panel');
  if(panel)panel.style.maxHeight=Math.max(140,height-16)+'px';
 }catch{}
}
function bind(){
 const modal=document.getElementById('ivTeamModal');
 if(!modal||modal===bound)return;
 bound=modal;
 new MutationObserver(align).observe(modal,{attributes:true,attributeFilter:['class']});
 align();
}
new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
try{parent.addEventListener('scroll',align,{passive:true});parent.addEventListener('resize',align,{passive:true})}catch{}
})();
