(()=>{
"use strict";

const FRAME_ID="kontrolFrame";
const STYLE_ID="ivKontrolUniformWidthStyle";

const CSS=`
/* KONTROL — toutes les cartes occupent exactement la même largeur */
html body main{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  margin:0!important;
  padding-left:12px!important;
  padding-right:12px!important;
  box-sizing:border-box!important;
}

html body main > section.card{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  margin-left:0!important;
  margin-right:0!important;
  box-sizing:border-box!important;
  grid-column:1 / -1!important;
  justify-self:stretch!important;
  align-self:stretch!important;
}

html body main > section.card + section.card{
  margin-top:12px!important;
}

html body #summaryCard.iv-quality-summary{
  width:100%!important;
  max-width:none!important;
  margin-left:0!important;
  margin-right:0!important;
  box-sizing:border-box!important;
}

html body .sticky-actions{
  width:calc(100% - 24px)!important;
  max-width:none!important;
  margin:12px 12px 0!important;
  box-sizing:border-box!important;
}

@media(max-width:600px){
  html body main{
    padding-left:8px!important;
    padding-right:8px!important;
  }

  html body main > section.card{
    width:100%!important;
    max-width:none!important;
    margin-left:0!important;
    margin-right:0!important;
  }

  html body .sticky-actions{
    width:calc(100% - 16px)!important;
    margin:10px 8px 0!important;
  }
}
`;

function getDoc(){
  try{return document.getElementById(FRAME_ID)?.contentDocument||null}
  catch(_){return null}
}

function apply(doc){
  if(!doc?.head)return;
  let style=doc.getElementById(STYLE_ID);
  if(!style){
    style=doc.createElement("style");
    style.id=STYLE_ID;
    doc.head.appendChild(style);
  }
  if(style.textContent!==CSS)style.textContent=CSS;
}

function hook(){
  const frame=document.getElementById(FRAME_ID);
  if(!frame)return;
  const sync=()=>{const doc=getDoc();if(doc)apply(doc)};
  if(!frame.dataset.ivUniformWidthHooked){
    frame.dataset.ivUniformWidthHooked="1";
    frame.addEventListener("load",()=>setTimeout(sync,50));
  }
  sync();
  setTimeout(sync,250);
  setTimeout(sync,900);
  setTimeout(sync,1800);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook,{once:true});
else hook();
})();
