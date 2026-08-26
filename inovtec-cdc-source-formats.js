(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
function apply(){
 let d;try{d=frame?.contentDocument}catch{return}
 if(!d?.body)return;
 const card=d.getElementById("ivCdcCard");if(!card)return;
 const sub=card.querySelector(".iv-cdc-sub");
 if(sub)sub.textContent="Prestations et exigences rattachées à ce chantier. Saisie manuelle et import PDF / Excel enregistrés dans Firebase.";
 const btn=card.querySelector("#ivCdcImport");
 if(btn){btn.textContent="📄 Importer PDF / Excel";btn.title="Importer un cahier des charges PDF ou Excel";btn.dataset.supportedFormats="xlsx,xls,pdf";}
 const stats=[...card.querySelectorAll(".iv-cdc-stat")];
 const importStat=stats.find(x=>/Import Excel|Import fichiers/i.test(x.textContent||""));
 if(importStat){const small=importStat.querySelector("small"),strong=importStat.querySelector("strong"),span=importStat.querySelector("span");if(small)small.textContent="Import fichiers";if(strong)strong.textContent="PDF + Excel";if(span)span.textContent="Opérationnel";}
 const empty=card.querySelector(".iv-cdc-empty");
 if(empty&&/fichier Excel|étape suivante/i.test(empty.textContent||""))empty.innerHTML='<strong>Aucune ligne pour ce chantier</strong>Ajoute une prestation manuellement ou importe directement un PDF / Excel.';
 card.dataset.supportedSources="manual,excel,pdf";
}
if(frame){frame.addEventListener("load",()=>{setTimeout(apply,200);setTimeout(apply,800)});setTimeout(apply,500)}
})();