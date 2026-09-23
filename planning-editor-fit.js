(()=>{
"use strict";
if(window.__INOVTEC_PLANNING_EDITOR_FIT_V5__)return;
window.__INOVTEC_PLANNING_EDITOR_FIT_V5__=true;

const pop=document.getElementById("editorPopover");
if(!pop)return;

const style=document.createElement("style");
style.id="ivPlanningEditorFitStyleV5";
style.textContent=`
#editorPopover{
  overflow-y:auto!important;
  overscroll-behavior:contain;
  scrollbar-gutter:stable;
}
#editorPopover .editor-actions{
  position:sticky!important;
  bottom:0!important;
  z-index:20!important;
  background:rgba(255,255,255,.99)!important;
  margin-left:-13px;
  margin-right:-13px;
  margin-bottom:-13px;
  padding:10px 13px 13px;
  box-shadow:0 -6px 12px rgba(15,23,42,.05);
}
@media (max-height:760px){
  #editorPopover{padding:9px!important}
  #editorPopover .editor-row{margin-bottom:5px!important}
  #editorPopover .editor-field,
  #editorPopover .editor-textarea,
  #editorPopover .editor-select{padding:5px 7px!important}
  #editorPopover .editor-textarea{min-height:38px!important;max-height:56px!important}
  #editorPopover .editor-actions{
    margin-top:5px!important;
    margin-left:-9px;
    margin-right:-9px;
    margin-bottom:-9px;
    padding:7px 9px 9px;
  }
}
@media (max-width:720px){
  #editorPopover.open{
    left:12px!important;
    right:12px!important;
    top:12px!important;
    bottom:auto!important;
    width:auto!important;
    max-width:none!important;
    max-height:calc(100dvh - 24px)!important;
    overflow-y:auto!important;
  }
}
`;
document.head.appendChild(style);

function bounds(){
  const margin=12;
  let top=margin,left=margin,right=window.innerWidth-margin,bottom=window.innerHeight-margin;
  try{
    if(parent!==window){
      const frame=parent.document.getElementById("legacyFrame");
      if(frame?.contentWindow===window){
        const fr=frame.getBoundingClientRect();
        const vv=parent.visualViewport;
        const pvTop=vv?.offsetTop||0;
        const pvLeft=vv?.offsetLeft||0;
        const pvHeight=vv?.height||parent.innerHeight;
        const pvWidth=vv?.width||parent.innerWidth;
        top=Math.max(margin,pvTop-fr.top+margin);
        left=Math.max(margin,pvLeft-fr.left+margin);
        bottom=Math.min(window.innerHeight-margin,pvTop+pvHeight-fr.top-margin);
        right=Math.min(window.innerWidth-margin,pvLeft+pvWidth-fr.left-margin);
      }
    }
  }catch{}
  if(bottom<=top+120){top=margin;bottom=window.innerHeight-margin}
  if(right<=left+180){left=margin;right=window.innerWidth-margin}
  return{top,left,right,bottom};
}

function fitOnce(){
  if(!pop.classList.contains("open"))return;
  /* Sur mobile, le CSS dédié gère déjà la fenêtre et le clavier virtuel. */
  if(window.matchMedia?.("(max-width:720px)")?.matches)return;

  const b=bounds();
  const h=Math.max(160,b.bottom-b.top);
  const w=Math.max(220,b.right-b.left);

  pop.style.setProperty("max-height",Math.floor(h)+"px","important");
  pop.style.setProperty("overflow-y","auto","important");

  let r=pop.getBoundingClientRect();
  if(r.width>w){
    pop.style.setProperty("width",Math.floor(w)+"px","important");
    r=pop.getBoundingClientRect();
  }

  let left=r.left;
  let top=r.top;
  if(r.right>b.right)left-=r.right-b.right;
  if(left<b.left)left=b.left;
  if(r.bottom>b.bottom)top-=r.bottom-b.bottom;
  if(top<b.top)top=b.top;

  pop.style.setProperty("right","auto","important");
  pop.style.setProperty("bottom","auto","important");
  pop.style.setProperty("left",Math.round(left)+"px","important");
  pop.style.setProperty("top",Math.round(top)+"px","important");

  /* Une alerte ou un contenu ajouté après l'ouverture ne doit jamais pousser
     les boutons hors écran. La hauteur maximale dépend donc de la position
     finale de la bulle, pas seulement de la hauteur totale du viewport. */
  const roomBelow=Math.max(160,b.bottom-top);
  pop.style.setProperty("max-height",Math.floor(roomBelow)+"px","important");
}

/* Important : aucune surveillance de scroll, pointer, focus ou redimensionnement du
   contenu pendant l'édition. La bulle ne bouge donc jamais entre mousedown/mouseup,
   ce qui garantit le clic sur Terminé/Supprimer. On l'ajuste uniquement à l'ouverture. */
let token=0;
function fitOnOpen(){
  const mine=++token;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(mine!==token)return;
    fitOnce();
  }));
}
new MutationObserver(mutations=>{
  if(!mutations.some(m=>m.attributeName==="class"))return;
  if(pop.classList.contains("open"))fitOnOpen();
  else token++;
}).observe(pop,{attributes:true,attributeFilter:["class"]});

if(pop.classList.contains("open"))fitOnOpen();
})();
