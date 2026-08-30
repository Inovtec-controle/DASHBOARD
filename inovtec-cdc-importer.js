(()=>{"use strict";
if((new URLSearchParams(location.search).get("mode")||"").toLowerCase()!=="infos")return;
const frame=document.getElementById("legacyFrame"),fb=window.firebase,db=fb?.firestore?.(),auth=fb?.auth?.();
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"],DL={lundi:"Lun",mardi:"Mar",mercredi:"Mer",jeudi:"Jeu",vendredi:"Ven",samedi:"Sam",dimanche:"Dim"};
let siteId="",siteName="",pending=null,resolving=null;
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(),txt=v=>String(v??"").replace(/\s+/g," ").trim();
const freq=(f,j=[])=>{f=norm(f);if(/semaine.*paire/.test(f)&&/impaire/.test(f))return"pair_impair";if(/mensuel|chaque mois/.test(f))return"mensuel";if(/quotidien|tous les jours|chaque jour/.test(f))return"quotidien";if(/hebdo|chaque semaine/.test(f))return"hebdomadaire";return j.length?"jours":f?"autre":"jours"};
const clean=r=>{const j=[...new Set((r.jours||[]).map(norm).filter(x=>DAYS.includes(x)))],f=txt(r.frequence);return{zone:txt(r.zone),prestation:txt(r.prestation),frequenceType:r.frequenceType||freq(f,j),frequence:f,jours:j,methodeConsigne:txt(r.methodeConsigne),controle:txt(r.controle),observations:txt(r.observations)}};
const key=r=>[r.zone,r.prestation,r.frequenceType,r.frequence,(r.jours||[]).join(","),r.methodeConsigne,r.controle,r.observations].map(norm).join("|");

function startsWithJoinWord(v){
 const s=norm(v);if(!s)return false;
 return /^(de|des|du|d|le|la|les|un|une|au|aux|a|et|ou|pour|sur|sous|avec|sans|dans|en|par|vers|chez|entre)(?: |$)/.test(s);
}
function startsWithPunctuation(v){
 return /^[,;:.!?()\/\-–—]/.test(txt(v));
}
function startsLower(v){
 const s=txt(v);return !!s&&/^[a-zà-öø-ÿ]/.test(s.charAt(0));
}
function standaloneActionHead(v){
 const s=norm(v),words=s.split(" ").filter(Boolean);
 if(words.length!==1)return false;
 return /^(desinfection|nettoyage|lavage|depoussierage|aspiration|balayage|balayagehumide|vidage|evacuation|essuyage|detartrage|degraissage|ramassage|reapprovisionnement|reassort)$/.test(words[0]);
}
function endsLikeContinuation(v){
 const s=norm(v);if(!s)return false;
 return /(?:^| )(de|des|du|d|et|ou|a|au|aux|pour|sur|sous|avec|sans|dans|en|par|vers|chez|entre)$/.test(s)||/[,:;\-/–—]$/.test(txt(v));
}
function sameOrBlankZone(a,b){
 const za=norm(a?.zone),zb=norm(b?.zone);
 return !za||!zb||za===zb;
}
function uniqueJoin(a,b){
 const vals=[];
 [a,b].forEach(v=>txt(v).split(/\s*[·|]\s*/).forEach(x=>{x=txt(x);if(x&&!vals.some(y=>norm(y)===norm(x)))vals.push(x)}));
 return vals.join(" · ");
}
function combineRows(a,b){
 const jours=[...new Set([...(a.jours||[]),...(b.jours||[])].map(norm).filter(x=>DAYS.includes(x)))];
 const frequence=uniqueJoin(a.frequence,b.frequence);
 return{
  ...a,
  zone:txt(a.zone)||txt(b.zone),
  prestation:txt([txt(a.prestation),txt(b.prestation)].filter(Boolean).join(" ")),
  jours,
  frequence,
  frequenceType:freq(frequence,jours),
  methodeConsigne:uniqueJoin(a.methodeConsigne,b.methodeConsigne),
  controle:uniqueJoin(a.controle,b.controle),
  observations:uniqueJoin(a.observations,b.observations)
 };
}
function rebuildWrappedRows(rows=[]){
 const src=(Array.isArray(rows)?rows:[]).map(x=>({...x,prestation:txt(x?.prestation),zone:txt(x?.zone)})).filter(x=>x.prestation);
 const out=[];let merged=0;
 for(const row of src){
  const prev=out.at(-1);
  if(!prev){out.push(row);continue}
  const continuation=sameOrBlankZone(prev,row)&&(
   endsLikeContinuation(prev.prestation)||
   startsWithJoinWord(row.prestation)||
   startsWithPunctuation(row.prestation)||
   (startsLower(row.prestation)&&standaloneActionHead(prev.prestation))
  );
  if(continuation){
   out[out.length-1]=combineRows(prev,row);
   merged++;
  }else out.push(row);
 }
 return{rows:out,merged};
}
function D(){try{return frame?.contentDocument}catch{return null}}
function hubSites(){try{return Array.from(window.InovtecDataHub?.chantiers||[])}catch{return[]}}
function visibleSite(d){const n=d?.getElementById("nom")?.value.trim()||"",a=d?.getElementById("adresse")?.value.trim()||"",L=hubSites();return L.find(c=>norm(c.nom)===norm(n)&&(!a||norm(c.adresse)===norm(a)))||L.find(c=>norm(c.nom)===norm(n))||L.find(c=>a&&norm(c.adresse)===norm(a))||null}
function setResolved(d,s){siteId=String(s?.id||"");siteName=String(s?.nom||d?.getElementById("nom")?.value||"");const f=d?.getElementById("siteForm");if(f&&siteId)f.dataset.ivChantierId=siteId;return siteId?{id:siteId,nom:siteName}:null}
async function resolveSite(d,force=false){
 if(!d?.body||!db)return null;
 if(resolving&&!force)return resolving;
 resolving=(async()=>{
  const form=d.getElementById("siteForm"),known=String(form?.dataset.ivChantierId||"").trim(),n=d.getElementById("nom")?.value.trim()||"",a=d.getElementById("adresse")?.value.trim()||"";
  if(known){
   const h=hubSites().find(x=>String(x.id)===known);if(h)return setResolved(d,h);
   try{const snap=await db.collection("chantiers").doc(known).get();if(snap.exists)return setResolved(d,{id:snap.id,...snap.data()})}catch{}
  }
  const h=visibleSite(d);if(h?.id)return setResolved(d,h);
  if(!n&&!a){siteId="";siteName="";return null}
  try{
   let found=[];
   if(n){const snap=await db.collection("chantiers").where("nom","==",n).limit(10).get();found=snap.docs.map(x=>({id:x.id,...x.data()}))}
   let s=found.find(x=>!a||norm(x.adresse)===norm(a))||found[0]||null;
   if(!s){const snap=await db.collection("chantiers").limit(500).get(),all=snap.docs.map(x=>({id:x.id,...x.data()}));s=all.find(x=>norm(x.nom)===norm(n)&&(!a||norm(x.adresse)===norm(a)))||all.find(x=>n&&norm(x.nom)===norm(n))||all.find(x=>a&&norm(x.adresse)===norm(a))||null}
   if(s)return setResolved(d,s)
  }catch(e){console.warn("Résolution chantier import",e)}
  siteId="";siteName=n;return null
 })();
 try{return await resolving}finally{resolving=null}
}
function likelySaved(d){const form=d?.getElementById("siteForm"),state=norm(d?.getElementById("recordState")?.textContent||""),active=!!d?.querySelector?.("#siteList .site-item.active");return !!(form&&!form.classList.contains("hidden")&&(form.dataset.ivChantierId||active||/enregistre|synchronise/.test(state)))}
function style(d){if(d.getElementById("ivCdcImpCss"))return;const s=d.createElement("style");s.id="ivCdcImpCss";s.textContent=`.ivImpOv{position:fixed;inset:0;z-index:100500;background:#03211988;display:grid;place-items:center;padding:14px}.ivImpOv[hidden]{display:none}.ivImp{width:min(1080px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 26px 70px #0004}.ivImpH{display:flex;justify-content:space-between;gap:12px}.ivImp h3{margin:0}.ivImp p{margin:4px 0;color:#718179;font-size:10px}.ivImpX{border:0;background:#edf6f1;border-radius:9px;width:34px;height:34px;font-size:18px}.ivImpS{margin:13px 0;padding:11px;border:1px solid #dce9e3;border-radius:11px;background:#f8fcfa;font-size:11px;color:#49675a}.ivImpS.ok{background:#f2fbf6;color:#17623f}.ivImpS.err{background:#fff6f6;color:#9b2c2c}.ivImpStats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.ivImpStat{border:1px solid #dfeae4;border-radius:10px;padding:9px}.ivImpStat small{display:block;font-size:8px;color:#74847c;text-transform:uppercase;font-weight:850}.ivImpStat strong{font-size:17px;color:#174735}.ivImpWrap{overflow:auto;max-height:420px;border:1px solid #dfeae4;border-radius:11px}.ivImpT{border-collapse:collapse;width:100%;min-width:930px}.ivImpT th{position:sticky;top:0;background:#f1f7f4;padding:8px;font-size:8px;text-align:left}.ivImpT td{padding:8px;border-top:1px solid #edf2ef;font-size:10px;vertical-align:top}.ivImpDay{display:inline-block;margin:1px;padding:2px 4px;border-radius:6px;background:#eaf6f0;font-size:8px;font-weight:850}.ivImpF{display:flex;justify-content:space-between;gap:10px;align-items:end;flex-wrap:wrap;margin-top:12px}.ivImpF label{font-size:9px;font-weight:850;color:#49675a}.ivImpF select{display:block;margin-top:4px;min-height:38px;border:1px solid #cfe0d7;border-radius:9px;padding:8px;background:#fff}.ivImpB{border:1px solid #cfe0d7;border-radius:10px;background:#fff;color:#174235;padding:10px 13px;font-weight:850;font-size:10px}.ivImpB.p{background:#0b6b43;color:#fff}.ivImpB:disabled{opacity:.45}.ivImpNote{font-size:9px;color:#7b6b43;margin-top:8px}@media(max-width:700px){.ivImpStats{grid-template-columns:repeat(2,1fr)}.ivImpF>div:first-child{width:100%}.ivImpF select{width:100%}}`;d.head.appendChild(s)}
function ui(d){style(d);let i=d.getElementById("ivCdcFile");if(!i){i=d.createElement("input");i.id="ivCdcFile";i.type="file";i.accept=".xlsx,.xls,.pdf";i.hidden=true;d.body.appendChild(i);i.onchange=()=>{const f=i.files?.[0];i.value="";if(f)read(d,f)}}let o=d.getElementById("ivCdcImp");if(!o){o=d.createElement("div");o.id="ivCdcImp";o.className="ivImpOv";o.hidden=true;o.innerHTML=`<div class="ivImp"><div class="ivImpH"><div><h3>Importer un cahier des charges</h3><p id="ivImpSub">Excel ou PDF · aperçu avant enregistrement</p></div><button class="ivImpX" id="ivImpX">×</button></div><div id="ivImpS" class="ivImpS">Sélectionne un fichier.</div><div id="ivImpP"></div><div class="ivImpF"><div><label>Que faire des données existantes ?</label><select id="ivImpMode"><option value="replace_imported">Remplacer les anciens imports, garder les lignes manuelles</option><option value="append">Ajouter sans doublons</option><option value="replace_all">Tout remplacer</option></select></div><div><button class="ivImpB" id="ivImpCancel">Annuler</button> <button class="ivImpB p" id="ivImpGo" disabled>Importer dans ce chantier</button></div></div><div class="ivImpNote">Aucune donnée n’est enregistrée avant ta confirmation.</div></div>`;d.body.appendChild(o);const close=()=>{o.hidden=true;pending=null};d.getElementById("ivImpX").onclick=close;d.getElementById("ivImpCancel").onclick=close;o.onclick=e=>{if(e.target===o)close()};d.getElementById("ivImpGo").onclick=()=>commit(d)}return{i,o}}
function status(d,m,k=""){const e=d.getElementById("ivImpS");e.className="ivImpS"+(k?` ${k}`:"");e.textContent=m}
function preview(d){const b=d.getElementById("ivImpP"),r=pending.rows,z=new Set(r.map(x=>norm(x.zone)).filter(Boolean)),f=new Set(r.map(x=>x.frequenceType).filter(Boolean));b.innerHTML=`<div class="ivImpStats"><div class="ivImpStat"><small>Format</small><strong>${pending.sourceType.toUpperCase()}</strong></div><div class="ivImpStat"><small>Prestations</small><strong>${r.length}</strong></div><div class="ivImpStat"><small>Zones</small><strong>${z.size}</strong></div><div class="ivImpStat"><small>Fréquences</small><strong>${f.size}</strong></div></div>`;const w=d.createElement("div");w.className="ivImpWrap";const t=d.createElement("table");t.className="ivImpT";t.innerHTML="<thead><tr><th>Zone</th><th>Prestation</th><th>Type</th><th>Jours</th><th>Détail fréquence</th><th>Consigne</th><th>Observations</th></tr></thead><tbody></tbody>";const tb=t.tBodies[0];r.slice(0,250).forEach(x=>{const tr=d.createElement("tr"),vals=[x.zone,x.prestation,x.frequenceType,null,x.frequence,x.methodeConsigne,x.observations];vals.forEach((v,n)=>{const td=d.createElement("td");if(n===3){(x.jours||[]).forEach(j=>{const s=d.createElement("span");s.className="ivImpDay";s.textContent=DL[j]||j;td.appendChild(s)});if(!x.jours?.length)td.textContent="—"}else td.textContent=v||"—";tr.appendChild(td)});tb.appendChild(tr)});w.appendChild(t);b.appendChild(w);d.getElementById("ivImpGo").disabled=false}
async function openPicker(d){const b=d.getElementById("ivCdcImport");if(b){b.disabled=true;b.textContent="▦ Préparation…"}try{const s=await resolveSite(d,true);if(!s){alert("Sélectionne un chantier déjà enregistré avant d’importer son cahier des charges.");return}ui(d).i.click()}finally{if(b){b.disabled=false;b.textContent="▦ Importer Excel / PDF"}}}
async function read(d,file){const target=await resolveSite(d,true);if(!target){alert("Le chantier sélectionné n’a pas pu être identifié. Resélectionne-le puis relance l’import.");return}const o=ui(d).o;o.hidden=false;pending=null;d.getElementById("ivImpP").innerHTML="";d.getElementById("ivImpGo").disabled=true;d.getElementById("ivImpSub").textContent=`${file.name} · analyse en cours…`;status(d,"Lecture et analyse du fichier…");try{const ext=(file.name.split(".").pop()||"").toLowerCase();if(!["xlsx","xls","pdf"].includes(ext))throw Error("Format non pris en charge. Utilise un fichier Excel (.xlsx/.xls) ou PDF.");const P=window.InovtecCdcImportParsers||{},res=ext==="pdf"?await P.pdf?.(file):await P.excel?.(file);if(!res)throw Error("Le module de lecture du fichier n’est pas disponible.");const rebuilt=rebuildWrappedRows(res.rows||[]),out=[],seen=new Set();for(const x of rebuilt.rows){const r=clean(x),k=key(r);if(r.prestation&&!seen.has(k)){seen.add(k);out.push(r)}}if(!out.length)throw Error(res.reason||"Aucune prestation exploitable détectée.");if(out.length>600)throw Error("Import limité à 600 prestations par fichier.");const importWarnings=[...(res.warnings||[])];if(rebuilt.merged)importWarnings.push(`${rebuilt.merged} morceau${rebuilt.merged>1?"x":""} de texte regroupé${rebuilt.merged>1?"s":""} en prestation${rebuilt.merged>1?"s":""} complète${rebuilt.merged>1?"s":""}.`);pending={rows:out,sourceType:res.sourceType,fileName:file.name,fileType:file.type||"",warnings:importWarnings,targetSiteId:target.id,targetSiteName:target.nom||siteName};d.getElementById("ivImpSub").textContent=`${file.name} · aperçu avant import dans ${pending.targetSiteName||"ce chantier"}`;status(d,`${out.length} prestation${out.length>1?"s":""} détectée${out.length>1?"s":""}. Vérifie puis confirme.`,"ok");preview(d);if(pending.warnings.length){const n=d.createElement("div");n.className="ivImpNote";n.textContent=pending.warnings.join(" · ");d.getElementById("ivImpP").appendChild(n)}}catch(e){console.error(e);status(d,e.message||"Impossible d’analyser ce fichier.","err")}}
async function commit(d){if(!pending)return;const targetId=String(pending.targetSiteId||siteId||"");if(!targetId){status(d,"Chantier introuvable. Ferme l’import, resélectionne le chantier et recommence.","err");return}const go=d.getElementById("ivImpGo"),mode=d.getElementById("ivImpMode").value,now=Date.now(),imp=`import_${now}_${Math.random().toString(16).slice(2)}`;go.disabled=true;status(d,"Enregistrement dans Firebase…");try{await db.runTransaction(async tx=>{const ref=db.collection("chantiers").doc(targetId),snap=await tx.get(ref);if(!snap.exists)throw Error("Chantier introuvable");const old=snap.data()?.cahierDesChargesV1?.rows||[];let base=mode==="replace_all"?[]:mode==="replace_imported"?old.filter(x=>!["excel","pdf"].includes(x.sourceType)):old.map(x=>({...x}));const seen=new Set(base.map(key));let ord=Math.max(0,...base.map(x=>+x.ordre||0)),added=[];for(const r of pending.rows){const k=key(r);if(mode==="append"&&seen.has(k))continue;seen.add(k);ord+=10;added.push({...r,ordre:ord,sourceType:pending.sourceType,sourceFileName:pending.fileName,sourceFileType:pending.fileType,importId:imp,importedAtMs:now,createdAtMs:now,updatedAtMs:now})}const next=base.concat(added);if(JSON.stringify(next).length>800000)throw Error("Cahier des charges trop volumineux pour ce chantier.");tx.update(ref,{"cahierDesChargesV1.schemaVersion":2,"cahierDesChargesV1.structuredSchedule":true,"cahierDesChargesV1.rows":next,"cahierDesChargesV1.updatedAtMs":now,"cahierDesChargesV1.updatedBy":auth?.currentUser?.uid||"","cahierDesChargesV1.lastImport":{id:imp,sourceType:pending.sourceType,fileName:pending.fileName,rowCount:added.length,importedAtMs:now}})});status(d,`Import terminé avec succès dans ${pending.targetSiteName||siteName||"ce chantier"}.`,"ok");go.textContent="Import terminé ✓";setTimeout(()=>{d.getElementById("ivCdcImp").hidden=true;go.textContent="Importer dans ce chantier";pending=null},1200)}catch(e){console.error(e);status(d,e.message||"Import impossible.","err");go.disabled=false}}
async function refreshButton(d){const b=d?.getElementById("ivCdcImport");if(!b)return;const known=String(d.getElementById("siteForm")?.dataset.ivChantierId||"").trim(),h=visibleSite(d);if(known||h?.id)setResolved(d,h?.id?h:{id:known,nom:d.getElementById("nom")?.value||""});const can=!!siteId||likelySaved(d);b.disabled=!can;b.textContent="▦ Importer Excel / PDF";b.title=can?"Importer un cahier des charges Excel ou PDF":"Sélectionne d’abord un chantier enregistré";if(!b.dataset.ivRealImport){b.dataset.ivRealImport="1";b.onclick=e=>{e.preventDefault();openPicker(d)}}}
function install(){const d=D();if(!d?.body)return;ui(d);refreshButton(d);if(d.body.dataset.ivImportSiteBound!=="1"){d.body.dataset.ivImportSiteBound="1";d.addEventListener("click",e=>{if(e.target.closest?.(".site-item,#newBtn,#deleteBtn"))setTimeout(()=>refreshButton(d),80)},true);["nom","adresse"].forEach(id=>d.getElementById(id)?.addEventListener("input",()=>setTimeout(()=>refreshButton(d),80)))}}
window.InovtecCdcImport={freq,clean,rebuildWrappedRows,resolveSite:()=>{const d=D();return d?resolveSite(d,true):Promise.resolve(null)}};if(frame){frame.addEventListener("load",()=>setTimeout(install,180));setInterval(install,650);setTimeout(install,450)}try{window.InovtecDataHub?.subscribe?.(install)}catch{}
})();
