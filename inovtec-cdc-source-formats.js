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
 if(sub)sub.textContent="Prestations et exigences rattachées à ce chantier. Structure prête pour l’import de vos fichiers Excel ou PDF.";
 const btn=card.querySelector("#ivCdcImport");
 if(btn){btn.textContent="▦ Importer Excel / PDF";btn.title="L’import Excel et PDF sera connecté à cette structure à l’étape suivante";btn.dataset.supportedFormats="xlsx,xls,pdf";}
 const stats=[...card.querySelectorAll(".iv-cdc-stat")];
 const importStat=stats.find(x=>/Import Excel/i.test(x.textContent||""));
 if(importStat){const small=importStat.querySelector("small"),strong=importStat.querySelector("strong"),span=importStat.querySelector("span");if(small)small.textContent="Import fichiers";if(strong)strong.textContent="Excel + PDF";if(span)span.textContent="Structure compatible";}
 const empty=card.querySelector(".iv-cdc-empty");
 if(empty&&/fichier Excel/i.test(empty.textContent||""))empty.innerHTML='<strong>Aucune ligne pour ce chantier</strong>L’espace est prêt. Tu pourras remplir manuellement quelques lignes ou importer directement ton fichier Excel ou PDF à l’étape suivante.';
 card.dataset.supportedSources="manual,excel,pdf";
}
if(frame){frame.addEventListener("load",()=>{setTimeout(apply,200);setTimeout(apply,800)});setInterval(apply,900);setTimeout(apply,500)}
})();
