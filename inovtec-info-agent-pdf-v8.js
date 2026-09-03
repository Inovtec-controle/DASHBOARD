(()=>{
"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),PARENT_FB=window.firebase;
const DAYS={lundi:"Lun",mardi:"Mar",mercredi:"Mer",jeudi:"Jeu",vendredi:"Ven",samedi:"Sam",dimanche:"Dim"},DAY_KEYS=Object.keys(DAYS),PDF_DAY_LABELS={lundi:"L",mardi:"M",mercredi:"M",jeudi:"J",vendredi:"V",samedi:"S",dimanche:"D"};
const FREQ_TYPES={jours:"Selon jours",quotidien:"Quotidien",hebdomadaire:"Hebdomadaire",bimensuel:"Bimensuel",mensuel:"Mensuel",trimestriel:"Trimestriel",semestriel:"Semestriel",biannuel:"Bi-annuel",annuel:"Annuel",autre:"Autre"};
const LEGACY_FREQ_TYPES={pair_impair:"Semaines paires / impaires",ponctuel:"Ponctuel"};
const ZONE_PALETTE=[
  {fill:[6,78,59],light:[240,249,245],line:[188,221,205]},
  {fill:[4,120,87],light:[239,250,246],line:[181,226,208]},
  {fill:[15,118,110],light:[239,249,248],line:[184,222,219]},
  {fill:[22,101,52],light:[242,249,243],line:[194,222,199]},
  {fill:[77,124,15],light:[247,250,240],line:[213,226,190]},
  {fill:[17,94,89],light:[241,249,248],line:[190,221,218]}
];
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const clean=v=>String(v??"").replace(/[–—]/g,"-").replace(/[’]/g,"'").replace(/œ/g,"oe").replace(/Œ/g,"OE").replace(/•/g,",").trim();
function D(){try{return frame?.contentDocument||null}catch{return null}}function W(){try{return frame?.contentWindow||null}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function formValue(d,id){const e=d?.getElementById(id);return e&&"value" in e?String(e.value||"").trim():""}
function dbOf(w){try{return w?.firebase?.firestore?.()||PARENT_FB?.firestore?.()||null}catch{return null}}
async function resolveSite(d,w){const db=dbOf(w),form=d?.getElementById("siteForm"),known=String(form?.dataset.ivChantierId||"").trim();if(known&&db){try{const s=await db.collection("chantiers").doc(known).get();if(s.exists)return{id:s.id,...s.data()}}catch{}}const nom=formValue(d,"nom"),adresse=formValue(d,"adresse"),list=hubSites();let site=list.find(s=>norm(s.nom)===norm(nom)&&adresse&&norm(s.adresse)===norm(adresse))||list.find(s=>nom&&norm(s.nom)===norm(nom))||list.find(s=>adresse&&norm(s.adresse)===norm(adresse))||null;if(site?.id&&db){try{const s=await db.collection("chantiers").doc(String(site.id)).get();if(s.exists)return{id:s.id,...s.data()}}catch{}}if(nom&&db){try{const q=await db.collection("chantiers").where("nom","==",nom).limit(10).get(),found=q.docs.map(x=>({id:x.id,...x.data()}));return found.find(x=>!adresse||norm(x.adresse)===norm(adresse))||found[0]||site||{}}catch{}}return site||{}}
function val(d,site,id,...aliases){const live=formValue(d,id);if(live)return live;for(const k of [id,...aliases]){const v=site?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim()}return""}
function firstVal(d,site,ids){for(const id of ids){const v=val(d,site,id);if(v)return v}return""}
function rowsOf(site){const r=site?.cahierDesChargesV1?.rows;return Array.isArray(r)?r.slice().sort((a,b)=>(Number(a.ordre)||0)-(Number(b.ordre)||0)||String(a.zone||"").localeCompare(String(b.zone||""),"fr",{sensitivity:"base"})||String(a.prestation||"").localeCompare(String(b.prestation||""),"fr",{sensitivity:"base"})):[]}
function isAccordingDays(r){const days=interventionDays(r);if(days.size>0)return true;const type=String(r?.frequenceType||"").trim();if(type==="jours")return true;const raw=norm(r?.frequence);return raw==="selon jours"}
function frequencyLabel(r){const type=String(r?.frequenceType||"").trim(),raw=clean(r?.frequence);if(type==="jours")return"";if(type==="autre")return raw&&norm(raw)!=="selon jours"?raw:FREQ_TYPES.autre;if(FREQ_TYPES[type])return FREQ_TYPES[type];if(LEGACY_FREQ_TYPES[type])return LEGACY_FREQ_TYPES[type];const f=norm(raw);if(/bimensuel|deux fois par mois|2 fois par mois/.test(f))return FREQ_TYPES.bimensuel;if(/trimestriel|chaque trimestre/.test(f))return FREQ_TYPES.trimestriel;if(/semestriel|chaque semestre/.test(f))return FREQ_TYPES.semestriel;if(/bi annuel|biannuel|deux fois par an|2 fois par an/.test(f))return FREQ_TYPES.biannuel;if(/annuel|chaque an|une fois par an|1 fois par an/.test(f))return FREQ_TYPES.annuel;if(/mensuel|mensuelle|chaque mois/.test(f))return FREQ_TYPES.mensuel;if(/quotidien|tous les jours|chaque jour/.test(f))return FREQ_TYPES.quotidien;if(/hebdo|chaque semaine|1 fois semaine|une fois semaine/.test(f))return FREQ_TYPES.hebdomadaire;return norm(raw)==="selon jours"?"":raw}
function interventionDays(r){
  const out=new Set(),source=Array.isArray(r?.jours)?r.jours:[];
  source.forEach(v=>{
    const n=norm(v);
    const key=DAY_KEYS.find(k=>n===k||n===k.slice(0,3)||n.startsWith(k.slice(0,3)));
    if(key)out.add(key);
  });
  DAY_KEYS.forEach(k=>{
    const legacy=r?.[k];
    if(legacy===true||legacy===1||legacy==="1"||norm(legacy)==="oui"||norm(legacy)==="x")out.add(k);
  });
  const freq=norm(r?.frequence);
  if(/lundi au vendredi|du lundi au vendredi|lundi vendredi/.test(freq))DAY_KEYS.slice(0,5).forEach(k=>out.add(k));
  DAY_KEYS.forEach(k=>{if(freq.includes(k)||new RegExp(`(^| )${k.slice(0,3)}($| )`).test(freq))out.add(k)});
  return out
}
function containerInfo(d,site,id){const raw=val(d,site,id),structured=site?.conteneursPlanningV1?.[id],hasStructured=Array.isArray(structured)&&structured.length>0;if(!raw&&!hasStructured)return"";try{const f=window.InovtecContainerSchedule?.formatField;if(typeof f==="function")return f(site,id)}catch{}return raw}
function technicalExtra(site){for(const k of ["pointsTechniques","pointsTechnique","infosTechniques","informationsTechniques"]){const v=site?.[k];if(Array.isArray(v)&&v.length)return v.map(x=>typeof x==="string"?x:(x?.label&&x?.value?`${x.label} : ${x.value}`:JSON.stringify(x))).join("\n");if(v&&typeof v==="object")return Object.entries(v).filter(([,x])=>x!==null&&x!==undefined&&String(x).trim()).map(([a,b])=>`${a} : ${b}`).join("\n");if(typeof v==="string"&&v.trim())return v.trim()}return""}
function cleanFilename(v){return String(v||"chantier").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"chantier"}
async function ensureJsPdf(d,w){if(w?.jspdf?.jsPDF)return w.jspdf.jsPDF;let s=d.getElementById("ivJsPdfDirectLoader");if(!s){s=d.createElement("script");s.id="ivJsPdfDirectLoader";s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";d.head.appendChild(s)}await new Promise((resolve,reject)=>{if(w?.jspdf?.jsPDF)return resolve();const done=()=>w?.jspdf?.jsPDF?resolve():reject(new Error("jsPDF indisponible"));s.addEventListener("load",done,{once:true});s.addEventListener("error",()=>reject(new Error("Chargement jsPDF impossible")),{once:true});setTimeout(done,5000)});if(!w?.jspdf?.jsPDF)throw new Error("jsPDF indisponible");return w.jspdf.jsPDF}
function makeWriter(pdf,name,address){const pageW=210,pageH=297,left=12,right=12,contentW=pageW-left-right;let y=47;function header(){pdf.setFillColor(6,78,59);pdf.rect(0,0,pageW,39,"F");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text("INOVTEC - FICHE AGENT",left,10);pdf.setFontSize(18);pdf.text(pdf.splitTextToSize(clean(name)||"Chantier",155),left,20);if(address){pdf.setFont("helvetica","normal");pdf.setFontSize(12);pdf.text(pdf.splitTextToSize(clean(address),170),left,32)}pdf.setTextColor(23,53,43);y=47}function newPage(){pdf.addPage();pdf.setTextColor(23,53,43);y=12}function need(h){if(y+h>pageH-13)newPage()}function title(t){need(13);pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.setTextColor(7,95,66);pdf.text(clean(t),left,y);pdf.setDrawColor(205,224,215);pdf.line(left,y+2,198,y+2);y+=8}function item(label,value){value=clean(value);if(!value)return;const lines=pdf.splitTextToSize(value,contentW-4),h=6+lines.length*4.2;need(h+2);pdf.setFillColor(248,252,250);pdf.setDrawColor(220,233,227);pdf.roundedRect(left,y,contentW,h,2,2,"FD");pdf.setTextColor(106,125,116);pdf.setFont("helvetica","bold");pdf.setFontSize(7.5);pdf.text(clean(label).toUpperCase(),left+3,y+4);pdf.setTextColor(23,53,43);pdf.setFont("helvetica","normal");pdf.setFontSize(9.5);pdf.text(lines,left+3,y+9);y+=h+3}function items(list){list.forEach(x=>item(x[0],x[1]));y+=1}function cdcZones(rows){
  if(!rows.length)return;
  title("Cahier des charges");
  const taskW=102,daysW=contentW-taskW,dayW=daysW/7;
  const groups=[];
  rows.forEach(r=>{
    const zone=clean(r?.zone)||"Zone non renseignee";
    const key=norm(zone)||"zone-non-renseignee";
    let g=groups.find(x=>x.key===key);
    if(!g){g={key,zone,rows:[]};groups.push(g)}
    g.rows.push(r);
  });
  function tableHead(colors){
    need(9);
    let x=left;
    pdf.setDrawColor(...colors.line);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(7.2);

    // Colonne prestation : fond clair, texte couleur de zone.
    pdf.setFillColor(...colors.light);
    pdf.setTextColor(...colors.fill);
    pdf.rect(x,y,taskW,8,"FD");
    pdf.text("PRESTATION",x+3,y+5);
    x+=taskW;

    // Colonnes jours : fond de zone foncé + lettres blanches pour rester lisibles.
    DAY_KEYS.forEach(k=>{
      pdf.setFillColor(...colors.fill);
      pdf.setTextColor(255,255,255);
      pdf.setFont("helvetica","bold");
      pdf.setFontSize(7.8);
      pdf.rect(x,y,dayW,8,"FD");
      pdf.text(PDF_DAY_LABELS[k],x+dayW/2,y+5.1,{align:"center"});
      x+=dayW;
    });
    y+=8;
  }
  function zoneHead(group,index,suite=false){
    const colors=ZONE_PALETTE[index%ZONE_PALETTE.length];
    need(13);
    pdf.setFillColor(...colors.fill);
    pdf.setDrawColor(...colors.fill);
    pdf.roundedRect(left,y,contentW,9,2,2,"FD");
    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(10);
    const count=group.rows.length;
    const label=(suite?"ZONE - ":"ZONE ")+(index+1)+"  |  "+clean(group.zone)+(suite?" (suite)":"")+"  |  "+count+" tache"+(count>1?"s":"");
    pdf.text(pdf.splitTextToSize(label,contentW-6),left+3,y+5.8);
    y+=11;
    tableHead(colors);
    return colors;
  }
  groups.forEach((group,index)=>{
    if(index>0)y+=3;
    let colors=zoneHead(group,index,false);
    group.rows.forEach((r,rowIndex)=>{
      const task=clean(r.prestation)||"-",accordingDays=isAccordingDays(r),freq=frequencyLabel(r),days=interventionDays(r),
            taskLines=pdf.splitTextToSize(task,taskW-7),
            freqLines=!accordingDays&&freq?pdf.splitTextToSize(clean(freq),daysW-6):[],
            h=Math.max(9,5+Math.max(taskLines.length,freqLines.length)*3.6);
      if(y+h>pageH-13){
        newPage();
        title("Cahier des charges (suite)");
        colors=zoneHead(group,index,true);
      }
      let x=left;
      pdf.setFillColor(rowIndex%2===0?255:colors.light[0],rowIndex%2===0?255:colors.light[1],rowIndex%2===0?255:colors.light[2]);
      pdf.setDrawColor(...colors.line);
      pdf.rect(x,y,taskW,h,"FD");
      pdf.setFillColor(...colors.fill);
      pdf.rect(x,y,2,h,"F");
      pdf.setTextColor(38,63,54);
      pdf.setFont("helvetica","normal");
      pdf.setFontSize(8.3);
      pdf.text(taskLines,x+4,y+5);
      x+=taskW;
      if(accordingDays){
        DAY_KEYS.forEach(k=>{
          pdf.setFillColor(255,255,255);
          pdf.rect(x,y,dayW,h,"FD");
          if(days.has(k)){
            pdf.setTextColor(...colors.fill);
            pdf.setFont("helvetica","bold");
            pdf.setFontSize(9.2);
            pdf.text("X",x+dayW/2,y+h/2+1.6,{align:"center"});
            pdf.setFont("helvetica","normal");
            pdf.setFontSize(8.3);
          }
          x+=dayW;
        });
      }else{
        pdf.setFillColor(...colors.light);
        pdf.rect(x,y,daysW,h,"FD");
        pdf.setTextColor(...colors.fill);
        pdf.setFont("helvetica","bold");
        pdf.setFontSize(8.8);
        if(freqLines.length)pdf.text(freqLines,x+daysW/2,y+h/2-(freqLines.length-1)*1.8+1.8,{align:"center"});
      }
      y+=h;
    });
  });
  y+=4;
}
function cdc(rows){return cdcZones(rows)}
header();return{items,cdc,finish(){pdf.setTextColor(128,144,135);pdf.setFontSize(7.5);pdf.text("Fiche operationnelle generee depuis Inovtec Dashboard",198,pageH-7,{align:"right"})}}}
async function generate(d,w,button){const name=formValue(d,"nom");if(!name){w.alert("Selectionne un chantier avant de generer la fiche agent PDF.");return}const old=button.textContent;button.disabled=true;button.textContent="Generation PDF...";try{const JsPDF=await ensureJsPdf(d,w),site=await resolveSite(d,w),pdf=new JsPDF({unit:"mm",format:"a4",orientation:"portrait"}),writer=makeWriter(pdf,val(d,site,"nom")||name,val(d,site,"adresse"));writer.items([["Numero de clef / badge",val(d,site,"cles")],["Code d'acces",val(d,site,"code")],["Local nettoyage",val(d,site,"localnettoyage")],["Acces / particularites du local nettoyage",val(d,site,"accesLocalNettoyage")],["Local conteneurs",val(d,site,"locauxConteneurs")],["Aire de presentation",firstVal(d,site,["airePresentation","aireDePresentation","airePresentations","aireDePresentations","airepresentation"])],["Sortie OM",containerInfo(d,site,"sortieOM")],["Rentree OM",containerInfo(d,site,"rentreeOM")],["Sortie TRI",containerInfo(d,site,"sortieTRI")],["Rentree TRI",containerInfo(d,site,"rentreeTRI")],["Telephone agent",val(d,site,"agentTel")],["Lundi",val(d,site,"lundi")],["Mardi",val(d,site,"mardi")],["Mercredi",val(d,site,"mercredi")],["Jeudi",val(d,site,"jeudi")],["Vendredi",val(d,site,"vendredi")],["Samedi",val(d,site,"samedi")],["Dimanche",val(d,site,"dimanche")],["Consignes specifiques",val(d,site,"consignesAgents")],["Prises electriques",val(d,site,"electricite","électricité")],["Point d'eau / robinet",val(d,site,"eau","Eau")],["Franges / materiel specifique",val(d,site,"franges")],["Consommables",val(d,site,"consommables")],["Observations techniques",val(d,site,"observationsTechniques")],["Autres points techniques",technicalExtra(site)],["Informations complementaires",val(d,site,"infopropres")]]);writer.cdc(rowsOf(site));writer.finish();pdf.save(`Fiche-agent-${cleanFilename(name)}.pdf`)}catch(e){console.error("Fiche agent PDF V8",e);w.alert("Impossible de generer la fiche PDF. Actualise Infos chantier puis reessaie.")}finally{button.disabled=false;button.textContent=old}}
function bind(){const d=D(),w=W();if(!d?.body||!w)return;if(w.__ivAgentPdfDirectV8)return;w.__ivAgentPdfDirectV8=true;w.addEventListener("click",e=>{const b=e.target?.closest?.("#pdfBtn");if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();generate(d,w,b)},true);const b=d.getElementById("pdfBtn");if(b){b.title="Generer la fiche agent PDF";b.dataset.ivPdfDirect="12"}}
frame?.addEventListener("load",()=>{setTimeout(bind,100);setTimeout(bind,500);setTimeout(bind,1200)});setTimeout(bind,300);setInterval(bind,1200);
})();