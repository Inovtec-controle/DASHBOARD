(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="infos")return;
const frame=document.getElementById("legacyFrame");
const fb=window.firebase;
const db=fb?.firestore?.();
const DAY_LABELS={lundi:"Lun",mardi:"Mar",mercredi:"Mer",jeudi:"Jeu",vendredi:"Ven",samedi:"Sam",dimanche:"Dim"};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function doc(){try{return frame?.contentDocument||null}catch{return null}}
function win(){try{return frame?.contentWindow||null}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function activeHubSite(d){
  const nom=d?.getElementById("nom")?.value.trim()||"",adresse=d?.getElementById("adresse")?.value.trim()||"";
  if(!nom&&!adresse)return null;
  const list=hubSites();
  return list.find(s=>norm(s.nom)===norm(nom)&&adresse&&norm(s.adresse)===norm(adresse))
    ||list.find(s=>norm(s.nom)===norm(nom))
    ||list.find(s=>adresse&&norm(s.adresse)===norm(adresse))
    ||null;
}
async function resolveSite(d){
  const hub=activeHubSite(d),id=String(hub?.id||hub?.refId||"");
  if(id&&db){
    try{const snap=await db.collection("chantiers").doc(id).get();if(snap.exists)return{id:snap.id,...snap.data()}}catch(e){console.warn("Lecture fiche agent PDF",e)}
  }
  if(hub)return hub;
  const nom=d?.getElementById("nom")?.value.trim()||"";if(!nom||!db)return null;
  try{
    const snap=await db.collection("chantiers").where("nom","==",nom).limit(10).get();
    const adresse=d?.getElementById("adresse")?.value.trim()||"",rows=snap.docs.map(x=>({id:x.id,...x.data()}));
    return rows.find(x=>!adresse||norm(x.adresse)===norm(adresse))||rows[0]||null;
  }catch(e){console.warn("Résolution chantier pour PDF",e);return null}
}
function val(d,site,id,...aliases){
  const el=d?.getElementById(id);if(el&&"value" in el){const v=String(el.value||"").trim();if(v)return v}
  const keys=[id,...aliases];for(const k of keys){const v=site?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim()}
  return "";
}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function cleanFilename(v){return String(v||"chantier").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"chantier"}
function rowsOf(site){const rows=site?.cahierDesChargesV1?.rows;return Array.isArray(rows)?rows.slice().sort((a,b)=>(Number(a.ordre)||0)-(Number(b.ordre)||0)||String(a.zone||"").localeCompare(String(b.zone||""),"fr",{sensitivity:"base"})||String(a.prestation||"").localeCompare(String(b.prestation||""),"fr",{sensitivity:"base"})):[]}
function daysText(row){
  const days=Array.isArray(row?.jours)?row.jours.filter(x=>DAY_LABELS[x]):[];
  if(days.length)return days.map(x=>DAY_LABELS[x]).join(" • ");
  if(String(row?.frequenceType||"")==="quotidien"||/quotidien|tous les jours|chaque jour/i.test(String(row?.frequence||"")))return "Tous les jours";
  return "—";
}
function infoSection(title,items){
  const kept=items.filter(x=>String(x[1]||"").trim());if(!kept.length)return "";
  return `<section class="ivpdf-section"><h2>${esc(title)}</h2><div class="ivpdf-grid">${kept.map(([label,value,full])=>`<div class="ivpdf-item${full?" full":""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div></section>`;
}
function cdcSection(rows){
  const kept=rows.filter(r=>String(r?.zone||r?.prestation||"").trim());if(!kept.length)return "";
  return `<section class="ivpdf-section ivpdf-cdc"><h2>Cahier des charges</h2><table><thead><tr><th>Zone</th><th>Prestation</th><th>Jours</th></tr></thead><tbody>${kept.map(r=>`<tr><td>${esc(r.zone||"—")}</td><td>${esc(r.prestation||"—")}</td><td>${esc(daysText(r))}</td></tr>`).join("")}</tbody></table></section>`;
}
function buildHtml(d,site){
  const nom=val(d,site,"nom")||"Chantier",adresse=val(d,site,"adresse");
  const access=infoSection("Accès au chantier",[
    ["Clé / badge",val(d,site,"cles")],
    ["Code d’accès",val(d,site,"code")],
    ["Accès / particularités du local nettoyage",val(d,site,"accesLocalNettoyage"),true]
  ]);
  const material=infoSection("Matériel & locaux",[
    ["Franges / matériel spécifique",val(d,site,"franges")],
    ["Consommables",val(d,site,"consommables")],
    ["Local nettoyage",val(d,site,"localnettoyage")],
    ["Type d’ampoules",val(d,site,"ampoules")]
  ]);
  const bins=infoSection("Conteneurs",[
    ["Local conteneurs",val(d,site,"locauxConteneurs"),true],
    ["Sortie OM",val(d,site,"sortieOM")],
    ["Rentrée OM",val(d,site,"rentreeOM")],
    ["Sortie TRI",val(d,site,"sortieTRI")],
    ["Rentrée TRI",val(d,site,"rentreeTRI")]
  ]);
  const technical=infoSection("Points techniques",[
    ["Prises électriques",val(d,site,"electricite","électricité")],
    ["Point d’eau",val(d,site,"eau","Eau")],
    ["Observations techniques",val(d,site,"observationsTechniques"),true]
  ]);
  const extra=infoSection("Consignes complémentaires",[["Informations complémentaires",val(d,site,"infopropres"),true]]);
  const cdc=cdcSection(rowsOf(site));
  return `<div class="ivpdf-root"><style>
    .ivpdf-root{width:190mm;box-sizing:border-box;background:#fff;color:#17352b;font-family:Inter,Arial,sans-serif;font-size:10.5pt;line-height:1.4;padding:0;margin:0}.ivpdf-head{padding:14mm 13mm 10mm;background:linear-gradient(135deg,#064e3b,#087654);color:#fff;border-radius:0 0 7mm 7mm}.ivpdf-brand{font-size:8.5pt;font-weight:800;letter-spacing:.16em;color:#9af0c5}.ivpdf-head h1{margin:3mm 0 1mm;font-size:23pt;line-height:1.08}.ivpdf-address{font-size:10.5pt;color:#d8f7e8;white-space:pre-wrap}.ivpdf-body{padding:8mm 10mm 10mm}.ivpdf-section{margin:0 0 6mm;break-inside:avoid-page}.ivpdf-section h2{margin:0 0 3mm;padding-bottom:2mm;border-bottom:1px solid #d8e7df;color:#075f42;font-size:13pt}.ivpdf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2.7mm}.ivpdf-item{padding:3mm;border:1px solid #dce9e3;border-radius:3mm;background:#f8fcfa;break-inside:avoid}.ivpdf-item.full{grid-column:1/-1}.ivpdf-item span{display:block;color:#6a7d74;font-size:7.8pt;font-weight:800;text-transform:uppercase;letter-spacing:.035em;margin-bottom:1mm}.ivpdf-item strong{display:block;color:#17352b;font-size:10pt;font-weight:650;white-space:pre-wrap}.ivpdf-cdc{break-inside:auto}.ivpdf-cdc table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt}.ivpdf-cdc th{padding:2.5mm;background:#eaf6ef;color:#155a40;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.035em;border:1px solid #d4e5dc}.ivpdf-cdc td{padding:2.6mm;border:1px solid #dde8e2;vertical-align:top;white-space:pre-wrap;word-break:break-word}.ivpdf-cdc th:nth-child(1),.ivpdf-cdc td:nth-child(1){width:25%}.ivpdf-cdc th:nth-child(2),.ivpdf-cdc td:nth-child(2){width:53%}.ivpdf-cdc th:nth-child(3),.ivpdf-cdc td:nth-child(3){width:22%}.ivpdf-cdc tbody tr{break-inside:avoid}.ivpdf-foot{margin-top:3mm;padding-top:3mm;border-top:1px solid #e2ebe6;color:#809087;font-size:7.5pt;text-align:right}@media print{.ivpdf-root{width:auto}.ivpdf-section{break-inside:avoid-page}.ivpdf-cdc{break-inside:auto}}
  </style><header class="ivpdf-head"><div class="ivpdf-brand">INOVTEC · FICHE AGENT</div><h1>${esc(nom)}</h1>${adresse?`<div class="ivpdf-address">${esc(adresse)}</div>`:""}</header><main class="ivpdf-body">${access}${cdc}${material}${bins}${technical}${extra}<div class="ivpdf-foot">Fiche opérationnelle générée depuis Inovtec Dashboard</div></main></div>`;
}
async function generate(d,button){
  const w=win();if(!w?.html2pdf){w?.alert?.("Le générateur PDF n’est pas encore chargé. Réessaie dans quelques secondes.");return}
  const nom=d?.getElementById("nom")?.value.trim()||"";if(!nom){w.alert("Sélectionne ou renseigne un chantier avant de générer la fiche agent.");return}
  const oldText=button.textContent;button.disabled=true;button.textContent="⏳ Génération…";
  let host=null;
  try{
    const site=await resolveSite(d);if(!site){w.alert("Enregistre d’abord le chantier pour générer sa fiche agent complète.");return}
    host=d.createElement("div");host.style.cssText="position:absolute;left:-12000px;top:0;width:190mm;background:#fff;z-index:-1";host.innerHTML=buildHtml(d,site);d.body.appendChild(host);
    const root=host.firstElementChild,filename=`Fiche-agent-${cleanFilename(nom)}.pdf`;
    await w.html2pdf().set({margin:[5,5,7,5],filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,logging:false},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:[".ivpdf-item","tr"]}}).from(root).save();
  }catch(e){console.error("Génération Fiche agent PDF impossible",e);w?.alert?.("La génération de la Fiche agent PDF a échoué. Réessaie après avoir enregistré le chantier.")}
  finally{try{host?.remove()}catch{}button.disabled=false;button.textContent=oldText}
}
function bind(){
  const d=doc();if(!d?.body||d.documentElement.dataset.ivAgentPdfBound==="1")return;
  d.documentElement.dataset.ivAgentPdfBound="1";
  d.addEventListener("click",e=>{
    const button=e.target?.closest?.("#pdfBtn");if(!button)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    generate(d,button);
  },true);
}
frame?.addEventListener("load",()=>{setTimeout(bind,120);setTimeout(bind,600);setTimeout(bind,1300)});
setInterval(bind,900);setTimeout(bind,450);
})();
