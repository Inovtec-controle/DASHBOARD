(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame");
const PARENT_FB=window.firebase;
const DAYS={lundi:"Lu",mardi:"Ma",mercredi:"Me",jeudi:"Je",vendredi:"Ve",samedi:"Sa",dimanche:"Di"};
const DAY_KEYS=Object.keys(DAYS);
const FREQ_TYPES={jours:"Selon jours",quotidien:"Quotidien",hebdomadaire:"Hebdomadaire",bimensuel:"Bimensuel",mensuel:"Mensuel",trimestriel:"Trimestriel",semestriel:"Semestriel",biannuel:"Bi-annuel",annuel:"Annuel",autre:"Autre"};
const LEGACY_FREQ_TYPES={pair_impair:"Semaines paires / impaires",ponctuel:"Ponctuel"};
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const clean=v=>String(v??"").replace(/[–—]/g,"-").replace(/[’]/g,"'").replace(/œ/g,"oe").replace(/Œ/g,"OE").replace(/•/g,",").trim();
function D(){try{return frame?.contentDocument||null}catch{return null}}
function W(){try{return frame?.contentWindow||null}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function formValue(d,id){const e=d?.getElementById(id);return e&&"value" in e?String(e.value||"").trim():""}
function dbOf(w){try{return w?.firebase?.firestore?.()||PARENT_FB?.firestore?.()||null}catch{return null}}
async function resolveSite(d,w){
 const db=dbOf(w),form=d?.getElementById("siteForm"),known=String(form?.dataset.ivChantierId||"").trim();
 if(known&&db){try{const s=await db.collection("chantiers").doc(known).get();if(s.exists)return{id:s.id,...s.data()}}catch(e){console.warn("PDF chantier id",e)}}
 const nom=formValue(d,"nom"),adresse=formValue(d,"adresse"),list=hubSites();
 let site=list.find(s=>norm(s.nom)===norm(nom)&&adresse&&norm(s.adresse)===norm(adresse))||list.find(s=>nom&&norm(s.nom)===norm(nom))||list.find(s=>adresse&&norm(s.adresse)===norm(adresse))||null;
 if(site?.id&&db){try{const s=await db.collection("chantiers").doc(String(site.id)).get();if(s.exists)return{id:s.id,...s.data()}}catch{}}
 if(nom&&db){try{const q=await db.collection("chantiers").where("nom","==",nom).limit(10).get(),found=q.docs.map(x=>({id:x.id,...x.data()}));const hit=found.find(x=>!adresse||norm(x.adresse)===norm(adresse))||found[0];if(hit)return hit}catch(e){console.warn("PDF recherche chantier",e)}}
 return site||{};
}
function val(d,site,id,...aliases){const live=formValue(d,id);if(live)return live;for(const k of [id,...aliases]){const v=site?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim()}return""}
function rowsOf(site){const r=site?.cahierDesChargesV1?.rows;return Array.isArray(r)?r.slice().sort((a,b)=>(Number(a.ordre)||0)-(Number(b.ordre)||0)||String(a.zone||"").localeCompare(String(b.zone||""),"fr",{sensitivity:"base"})||String(a.prestation||"").localeCompare(String(b.prestation||""),"fr",{sensitivity:"base"})):[]}
function isAccordingDays(r){
 const type=String(r?.frequenceType||"").trim();
 if(type)return type==="jours";
 const raw=norm(r?.frequence);
 if(raw==="selon jours")return true;
 return !raw&&Array.isArray(r?.jours)&&r.jours.length>0;
}
function frequencyLabel(r){
 const type=String(r?.frequenceType||"").trim();
 const raw=clean(r?.frequence);
 if(type==="jours")return"";
 if(type==="autre")return raw&&norm(raw)!=="selon jours"?raw:FREQ_TYPES.autre;
 if(FREQ_TYPES[type])return FREQ_TYPES[type];
 if(LEGACY_FREQ_TYPES[type])return LEGACY_FREQ_TYPES[type];
 const f=norm(raw);
 if(/bimensuel|deux fois par mois|2 fois par mois/.test(f))return FREQ_TYPES.bimensuel;
 if(/trimestriel|chaque trimestre/.test(f))return FREQ_TYPES.trimestriel;
 if(/semestriel|chaque semestre/.test(f))return FREQ_TYPES.semestriel;
 if(/bi annuel|biannuel|deux fois par an|2 fois par an/.test(f))return FREQ_TYPES.biannuel;
 if(/annuel|chaque an|une fois par an|1 fois par an/.test(f))return FREQ_TYPES.annuel;
 if(/mensuel|mensuelle|chaque mois/.test(f))return FREQ_TYPES.mensuel;
 if(/quotidien|tous les jours|chaque jour/.test(f))return FREQ_TYPES.quotidien;
 if(/hebdo|chaque semaine|1 fois semaine|une fois semaine/.test(f))return FREQ_TYPES.hebdomadaire;
 return norm(raw)==="selon jours"?"":raw;
}
function interventionDays(r){
 const out=new Set();
 const source=Array.isArray(r?.jours)?r.jours:[];
 source.forEach(v=>{const n=norm(v);const key=DAY_KEYS.find(k=>n===k||n===k.slice(0,3)||n.startsWith(k));if(key)out.add(key)});
 const freq=norm(r?.frequence);
 if(/lundi au vendredi|du lundi au vendredi|lundi vendredi/.test(freq))DAY_KEYS.slice(0,5).forEach(k=>out.add(k));
 DAY_KEYS.forEach(k=>{if(freq.includes(k)||new RegExp(`(^| )${k.slice(0,3)}($| )`).test(freq))out.add(k)});
 return out;
}
function cleanFilename(v){return String(v||"chantier").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"chantier"}
async function ensureJsPdf(d,w){
 if(w?.jspdf?.jsPDF)return w.jspdf.jsPDF;
 let s=d.getElementById("ivJsPdfDirectLoader");
 if(!s){s=d.createElement("script");s.id="ivJsPdfDirectLoader";s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";d.head.appendChild(s)}
 await new Promise((resolve,reject)=>{if(w?.jspdf?.jsPDF)return resolve();const done=()=>w?.jspdf?.jsPDF?resolve():reject(new Error("jsPDF indisponible"));s.addEventListener("load",done,{once:true});s.addEventListener("error",()=>reject(new Error("Chargement jsPDF impossible")),{once:true});setTimeout(done,5000)});
 if(!w?.jspdf?.jsPDF)throw new Error("jsPDF indisponible");return w.jspdf.jsPDF;
}
function makeWriter(pdf,name,address){
 const pageW=210,pageH=297,left=12,right=12,contentW=pageW-left-right;let y=43;
 function header(){pdf.setFillColor(6,78,59);pdf.rect(0,0,pageW,34,"F");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("INOVTEC - FICHE AGENT",left,10);pdf.setFontSize(18);pdf.text(pdf.splitTextToSize(clean(name)||"Chantier",150),left,19);if(address){pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.text(pdf.splitTextToSize(clean(address),150),left,29)}pdf.setTextColor(23,53,43);y=43}
 function newPage(){pdf.addPage();header()}
 function need(h){if(y+h>pageH-13)newPage()}
 function title(t){need(13);pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.setTextColor(7,95,66);pdf.text(clean(t),left,y);pdf.setDrawColor(205,224,215);pdf.line(left,y+2,198,y+2);y+=8}
 function item(label,value){value=clean(value);if(!value)return;const lines=pdf.splitTextToSize(value,contentW-4);const h=6+lines.length*4.2;need(h+2);pdf.setFillColor(248,252,250);pdf.setDrawColor(220,233,227);pdf.roundedRect(left,y,contentW,h,2,2,"FD");pdf.setTextColor(106,125,116);pdf.setFont("helvetica","bold");pdf.setFontSize(7.5);pdf.text(clean(label).toUpperCase(),left+3,y+4);pdf.setTextColor(23,53,43);pdf.setFont("helvetica","normal");pdf.setFontSize(9.5);pdf.text(lines,left+3,y+9);y+=h+3}
 function section(t,items){const kept=items.filter(x=>clean(x[1]));if(!kept.length)return;title(t);kept.forEach(x=>item(x[0],x[1]));y+=2}
 function cdc(rows){
  if(!rows.length)return;
  title("Cahier des charges");
  const zoneW=34,taskW=95,daysW=contentW-zoneW-taskW,dayW=daysW/7;
  const cols=[{label:"Zone",w:zoneW},{label:"Prestation",w:taskW},...DAY_KEYS.map(k=>({label:DAYS[k],w:dayW,key:k}))];
  function tableHead(){
   need(10);let x=left;
   pdf.setFillColor(234,246,239);pdf.setDrawColor(212,229,220);pdf.setFont("helvetica","bold");pdf.setFontSize(7.2);pdf.setTextColor(21,90,64);
   cols.forEach((c,i)=>{pdf.rect(x,y,c.w,8,"FD");pdf.text(c.label,i<2?x+2:x+c.w/2,y+5,{align:i<2?"left":"center"});x+=c.w});
   y+=8;
  }
  tableHead();
  rows.forEach(r=>{
   const zone=clean(r.zone)||"-",task=clean(r.prestation)||"-",accordingDays=isAccordingDays(r),freq=frequencyLabel(r),days=interventionDays(r);
   const zoneLines=pdf.splitTextToSize(zone,zoneW-4),taskLines=pdf.splitTextToSize(task,taskW-4),freqLines=!accordingDays&&freq?pdf.splitTextToSize(clean(freq),daysW-6):[];
   const h=Math.max(9,5+Math.max(zoneLines.length,taskLines.length,freqLines.length)*3.6);
   if(y+h>pageH-13){newPage();title("Cahier des charges (suite)");tableHead()}
   pdf.setDrawColor(221,232,226);pdf.setTextColor(38,63,54);pdf.setFont("helvetica","normal");pdf.setFontSize(8.2);
   let x=left;
   pdf.rect(x,y,zoneW,h);pdf.text(zoneLines,x+2,y+5);x+=zoneW;
   pdf.rect(x,y,taskW,h);pdf.text(taskLines,x+2,y+5);x+=taskW;
   if(accordingDays){
    DAY_KEYS.forEach(k=>{pdf.setDrawColor(221,232,226);pdf.rect(x,y,dayW,h);if(days.has(k)){pdf.setTextColor(38,63,54);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text("X",x+dayW/2,y+h/2+1.8,{align:"center"});pdf.setFont("helvetica","normal");pdf.setFontSize(8.2)}x+=dayW});
   }else{
    pdf.setFillColor(248,252,250);pdf.setDrawColor(221,232,226);pdf.rect(x,y,daysW,h,"FD");pdf.setTextColor(7,95,66);pdf.setFont("helvetica","bold");pdf.setFontSize(9);if(freqLines.length)pdf.text(freqLines,x+daysW/2,y+h/2-(freqLines.length-1)*1.8+1.8,{align:"center"});
   }
   y+=h;
  });
  y+=4;
 }
 header();return{section,cdc,finish(){pdf.setTextColor(128,144,135);pdf.setFontSize(7.5);pdf.text("Fiche operationnelle generee depuis Inovtec Dashboard",198,pageH-7,{align:"right"})}}
}
async function generate(d,w,button){
 const name=formValue(d,"nom");if(!name){w.alert("Selectionne un chantier avant de generer la fiche agent PDF.");return}
 const old=button.textContent;button.disabled=true;button.textContent="Generation PDF...";
 try{
  const JsPDF=await ensureJsPdf(d,w),site=await resolveSite(d,w),pdf=new JsPDF({unit:"mm",format:"a4",orientation:"portrait"}),writer=makeWriter(pdf,val(d,site,"nom")||name,val(d,site,"adresse"));
  writer.section("Acces au chantier",[["Adresse",val(d,site,"adresse")],["GPS",val(d,site,"gps")],["Cle / badge",val(d,site,"cles")],["Code d'acces",val(d,site,"code")],["Acces / particularites du local nettoyage",val(d,site,"accesLocalNettoyage")]]);
  writer.section("Agent et planning",[["Agent",val(d,site,"agentNom")],["Telephone agent",val(d,site,"agentTel")],["Lundi",val(d,site,"lundi")],["Mardi",val(d,site,"mardi")],["Mercredi",val(d,site,"mercredi")],["Jeudi",val(d,site,"jeudi")],["Vendredi",val(d,site,"vendredi")],["Samedi",val(d,site,"samedi")],["Dimanche",val(d,site,"dimanche")],["Consignes specifiques",val(d,site,"consignesAgents")]]);
  writer.cdc(rowsOf(site));
  writer.section("Materiel et locaux",[["Franges / materiel specifique",val(d,site,"franges")],["Consommables",val(d,site,"consommables")],["Local nettoyage",val(d,site,"localnettoyage")],["Type d'ampoules",val(d,site,"ampoules")],["Prises electriques",val(d,site,"electricite","électricité")],["Point d'eau",val(d,site,"eau","Eau")]]);
  writer.section("Conteneurs",[["Local conteneurs",val(d,site,"locauxConteneurs")],["Sortie OM",val(d,site,"sortieOM")],["Rentree OM",val(d,site,"rentreeOM")],["Sortie TRI",val(d,site,"sortieTRI")],["Rentree TRI",val(d,site,"rentreeTRI")]]);
  writer.section("Informations complementaires",[["Informations",val(d,site,"infopropres")],["Observations techniques",val(d,site,"observationsTechniques")]]);
  writer.finish();
  pdf.save(`Fiche-agent-${cleanFilename(name)}.pdf`);
 }catch(e){console.error("Fiche agent PDF directe",e);w.alert("Impossible de generer la fiche PDF. Actualise Infos chantier puis reessaie.")}
 finally{button.disabled=false;button.textContent=old}
}
function bind(){
 const d=D(),w=W();if(!d?.body||!w||w.__ivAgentPdfDirectV7)return;w.__ivAgentPdfDirectV7=true;
 w.addEventListener("click",e=>{const b=e.target?.closest?.("#pdfBtn");if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();generate(d,w,b)},true);
 const b=d.getElementById("pdfBtn");if(b){b.title="Generer la fiche agent PDF avec frequence ou jours";b.dataset.ivPdfDirect="7"}
}
frame?.addEventListener("load",()=>{setTimeout(bind,100);setTimeout(bind,500);setTimeout(bind,1200)});
setTimeout(bind,300);setInterval(bind,1200);
})();
