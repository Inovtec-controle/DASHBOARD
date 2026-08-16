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
    try{const snap=await db.collection("chantiers").doc(id).get();if(snap.exists)return{id:snap.id,...snap.data()}}catch(e){console.warn("Lecture Firebase indisponible pour la fiche agent, utilisation des données déjà chargées.",e)}
  }
  if(hub)return hub;
  const nom=d?.getElementById("nom")?.value.trim()||"";
  if(nom&&db){
    try{
      const snap=await db.collection("chantiers").where("nom","==",nom).limit(10).get();
      const adresse=d?.getElementById("adresse")?.value.trim()||"",found=snap.docs.map(x=>({id:x.id,...x.data()}));
      return found.find(x=>!adresse||norm(x.adresse)===norm(adresse))||found[0]||{};
    }catch(e){console.warn("Résolution Firebase indisponible pour la fiche agent.",e)}
  }
  return {};
}
function val(d,site,id,...aliases){
  const el=d?.getElementById(id);if(el&&"value" in el){const v=String(el.value||"").trim();if(v)return v}
  for(const k of [id,...aliases]){const v=site?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim()}
  return "";
}
function cleanFilename(v){return String(v||"chantier").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"chantier"}
function rowsOf(site){const list=site?.cahierDesChargesV1?.rows;return Array.isArray(list)?list.slice().sort((a,b)=>(Number(a.ordre)||0)-(Number(b.ordre)||0)||String(a.zone||"").localeCompare(String(b.zone||""),"fr",{sensitivity:"base"})||String(a.prestation||"").localeCompare(String(b.prestation||""),"fr",{sensitivity:"base"})):[]}
function daysText(row){const days=Array.isArray(row?.jours)?row.jours.filter(x=>DAY_LABELS[x]):[];if(days.length)return days.map(x=>DAY_LABELS[x]).join(" • ");if(String(row?.frequenceType||"")==="quotidien"||/quotidien|tous les jours|chaque jour/i.test(String(row?.frequence||"")))return "Tous les jours";return "—"}
function css(el,text){el.style.cssText=text;return el}
function textEl(d,tag,text,style=""){const el=d.createElement(tag);el.textContent=text;if(style)el.style.cssText=style;return el}
function addSection(d,root,title,items){
  const kept=items.filter(x=>String(x[1]||"").trim());if(!kept.length)return;
  const section=css(d.createElement("div"),"margin:0 0 18px;page-break-inside:avoid;");
  section.appendChild(textEl(d,"h2",title,"margin:0 0 9px;padding-bottom:6px;border-bottom:1px solid #d8e7df;color:#075f42;font-size:18px;"));
  kept.forEach(([label,value])=>{
    const box=css(d.createElement("div"),"margin:0 0 7px;padding:9px 11px;border:1px solid #dce9e3;border-radius:8px;background:#f8fcfa;page-break-inside:avoid;");
    box.appendChild(textEl(d,"div",label,"margin-bottom:3px;color:#6a7d74;font-size:10px;font-weight:700;text-transform:uppercase;"));
    box.appendChild(textEl(d,"div",value,"color:#17352b;font-size:13px;font-weight:600;white-space:pre-wrap;"));
    section.appendChild(box);
  });
  root.appendChild(section);
}
function addCdc(d,root,rows){
  const kept=rows.filter(r=>String(r?.zone||r?.prestation||"").trim());if(!kept.length)return;
  const section=css(d.createElement("div"),"margin:0 0 18px;");
  section.appendChild(textEl(d,"h2","Cahier des charges","margin:0 0 9px;padding-bottom:6px;border-bottom:1px solid #d8e7df;color:#075f42;font-size:18px;"));
  const table=css(d.createElement("table"),"width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;");
  const thead=d.createElement("thead"),hr=d.createElement("tr");
  [["Zone","25%"],["Prestation","53%"],["Jours","22%"]].forEach(([label,width])=>{const th=textEl(d,"th",label,"padding:7px;background:#eaf6ef;color:#155a40;text-align:left;border:1px solid #d4e5dc;font-size:11px;");th.style.width=width;hr.appendChild(th)});thead.appendChild(hr);table.appendChild(thead);
  const tbody=d.createElement("tbody");kept.forEach(row=>{const tr=css(d.createElement("tr"),"page-break-inside:avoid;");[row.zone||"—",row.prestation||"—",daysText(row)].forEach(value=>tr.appendChild(textEl(d,"td",value,"padding:8px;border:1px solid #dde8e2;vertical-align:top;white-space:pre-wrap;word-break:break-word;")));tbody.appendChild(tr)});table.appendChild(tbody);section.appendChild(table);root.appendChild(section);
}
function buildRoot(d,site){
  const root=css(d.createElement("div"),"font-family:Arial,sans-serif;padding:0;color:#17352b;background:#fff;width:100%;box-sizing:border-box;");
  const head=css(d.createElement("div"),"padding:22px 24px 18px;background:#064e3b;color:#fff;border-radius:0 0 16px 16px;margin-bottom:20px;");
  head.appendChild(textEl(d,"div","INOVTEC · FICHE AGENT","color:#9af0c5;font-size:11px;font-weight:700;letter-spacing:1.5px;"));
  head.appendChild(textEl(d,"h1",val(d,site,"nom")||"Chantier","margin:8px 0 4px;font-size:28px;line-height:1.1;color:#fff;"));
  const adresse=val(d,site,"adresse");if(adresse)head.appendChild(textEl(d,"div",adresse,"color:#d8f7e8;font-size:13px;white-space:pre-wrap;"));root.appendChild(head);
  const body=css(d.createElement("div"),"padding:0 18px 12px;");
  addSection(d,body,"Accès au chantier",[["Clé / badge",val(d,site,"cles")],["Code d’accès",val(d,site,"code")],["Accès / particularités du local nettoyage",val(d,site,"accesLocalNettoyage")]]);
  addCdc(d,body,rowsOf(site));
  addSection(d,body,"Matériel & locaux",[["Franges / matériel spécifique",val(d,site,"franges")],["Consommables",val(d,site,"consommables")],["Local nettoyage",val(d,site,"localnettoyage")],["Type d’ampoules",val(d,site,"ampoules")]]);
  addSection(d,body,"Conteneurs",[["Local conteneurs",val(d,site,"locauxConteneurs")],["Sortie OM",val(d,site,"sortieOM")],["Rentrée OM",val(d,site,"rentreeOM")],["Sortie TRI",val(d,site,"sortieTRI")],["Rentrée TRI",val(d,site,"rentreeTRI")]]);
  addSection(d,body,"Points techniques",[["Prises électriques",val(d,site,"electricite","électricité")],["Point d’eau",val(d,site,"eau","Eau")],["Observations techniques",val(d,site,"observationsTechniques")]]);
  addSection(d,body,"Consignes complémentaires",[["Informations complémentaires",val(d,site,"infopropres")]]);
  body.appendChild(textEl(d,"div","Fiche opérationnelle générée depuis Inovtec Dashboard","margin-top:12px;padding-top:8px;border-top:1px solid #e2ebe6;color:#809087;font-size:10px;text-align:right;"));root.appendChild(body);return root;
}
async function generate(d,button){
  const w=win();
  if(typeof w?.html2pdf!=="function"){w?.alert?.("Le générateur PDF n’est pas chargé. Actualise la page puis réessaie.");return}
  const nom=d?.getElementById("nom")?.value.trim()||"";if(!nom){w.alert("Sélectionne ou renseigne un chantier avant de générer la fiche agent.");return}
  const oldText=button.textContent;button.disabled=true;button.textContent="⏳ Génération…";
  try{
    const site=await resolveSite(d),root=buildRoot(d,site),filename=`Fiche-agent-${cleanFilename(nom)}.pdf`;
    await w.html2pdf().set({margin:8,filename,html2canvas:{scale:2},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(root).save();
  }catch(e){console.error("Génération Fiche agent PDF impossible",e);w?.alert?.("La génération de la Fiche agent PDF a échoué. Actualise la page et réessaie.")}
  finally{button.disabled=false;button.textContent=oldText}
}
function bind(){const d=doc();if(!d?.body||d.documentElement.dataset.ivAgentPdfBound==="1")return;d.documentElement.dataset.ivAgentPdfBound="1";d.addEventListener("click",e=>{const button=e.target?.closest?.("#pdfBtn");if(!button)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();generate(d,button)},true)}
frame?.addEventListener("load",()=>{setTimeout(bind,120);setTimeout(bind,600)});setTimeout(bind,450);
})();
