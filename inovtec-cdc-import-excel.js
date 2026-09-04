(()=>{
"use strict";
window.InovtecCdcImportParsers=window.InovtecCdcImportParsers||{};
const N=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const T=v=>String(v??"").replace(/\s+/g," ").trim();
const DAYS=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const ALIASES=[["lundi","lun","lu","l"],["mardi","mar","ma"],["mercredi","mer","me"],["jeudi","jeu","je","j"],["vendredi","ven","ve","v"],["samedi","sam","sa","s"],["dimanche","dim","di","d"]];
const readerUrl=document.currentScript?.src?new URL("vendor/xlsx-0.18.5.full.min.js",document.currentScript.src).href:"vendor/xlsx-0.18.5.full.min.js";
let loading=null;
function load(){
 if(window.XLSX?.read)return Promise.resolve(window.XLSX);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const s=document.createElement("script");let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);s.onload=s.onerror=null;if(error){s.remove();reject(error)}else resolve(window.XLSX)};
  const timer=setTimeout(()=>finish(Error("Le lecteur Excel n’a pas pu se charger. Vérifie ta connexion puis réessaie.")),15000);
  s.src=readerUrl;s.onload=()=>finish(window.XLSX?.read?null:Error("Le lecteur Excel est indisponible. Recharge la page puis réessaie."));
  s.onerror=()=>finish(Error("Impossible de charger le lecteur Excel. Recharge la page puis réessaie."));
  document.head.appendChild(s);
 }).catch(e=>{loading=null;throw e});
 return loading;
}
function marked(v){const n=N(v);return /^(x|oui|yes|ok|v|true|vrai)$/.test(n)||/[✓✔✕×☑●•]/.test(String(v))||(/^\d+(?:[.,]\d+)?$/.test(T(v))&&Number(T(v).replace(",","."))>0)}
function day(v){const n=N(v);return ALIASES.findIndex(a=>a.includes(n))}
function textDays(v){
 const raw=T(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(),found=new Set();
 const names="lundi|lun|lu|mardi|mar|ma|mercredi|mer|me|jeudi|jeu|je|vendredi|ven|ve|samedi|sam|sa|dimanche|dim|di";
 const range=new RegExp(`\\b(${names})\\.?\\s*(?:au|a|[-–—])\\s*(${names})\\b`,"g");
 for(const m of raw.matchAll(range)){const start=day(m[1]),end=day(m[2]);for(let n=start;n<=start+6;n++){found.add(n%7);if(n%7===end)break}}
 for(const word of N(v).split(" ")){if(word.length<2)continue;const n=day(word);if(n>=0)found.add(n)}
 return DAYS.filter((_,i)=>found.has(i));
}
function role(v){
 const n=N(v);if(!n)return"";
 if(/^(?:zones?|secteurs?|local|locaux|batiments?|espaces?|localisations?|emplacements?|parties?|categories?)(?: (?:a traiter|d intervention|de passage|des prestations|communes|secteur|zone))*$/.test(n))return"zone";
 if(/^(?:(?:nature|description|designation|liste|details?) (?:des? )?)?(?:prestations?|taches?|travaux|operations?|interventions?)(?: (?:a effectuer|a realiser|de nettoyage|d entretien|prevues?|zones?|jours?|batiments?|locaux))*$/.test(n)||/^(description|designation|libelle)$/.test(n))return"task";
 if(/^(frequences?|periodicites?|rythmes?)(?: de passage|d intervention|des prestations)?$/.test(n))return"frequency";
 if(/^(jours?|jours? de passage|jours? d intervention|jours? prevus|passages?)$/.test(n))return"daysText";
 if(/^(methodes?|consignes?|mode operatoire)(?: consignes?)?$/.test(n))return"method";
 if(/^(controles?|exigences?)(?: exigences?)?$/.test(n))return"control";
 if(/^(observations?|remarques?|notes?|commentaires?)$/.test(n))return"notes";
 if(day(n)>=0||n==="m")return"day";
 if(/^(quotidien(?:ne)?|hebdo(?:madaire)?|bimensuel(?:le)?|mensuel(?:le)?|trimestriel(?:le)?|semestriel(?:le)?|bi annuel(?:le)?|biannuel(?:le)?|annuel(?:le)?)$/.test(n))return"frequencyFlag";
 return"";
}
const ignored=v=>/^(?:total|sous total|signature|page|legende|cahier des charges)(?:\b|$)/.test(N(v));
function worksheet(X,ws){
 const entries=[];
 // Use populated cells: Excel often extends !ref to its last row just for formatting.
 for(const address of Object.keys(ws||{})){
  if(!/^[A-Z]+[1-9]\d*$/.test(address))continue;
  const c=ws[address];if(c?.t==="z"||!T(c?.v??c?.w))continue;
  const pos=X.utils.decode_cell(address);entries.push({r:pos.r,c:pos.c,value:c.t==="e"?"":T(X.utils.format_cell(c))});
 }
 if(!entries.length)return null;
 let first=Infinity,last=0,right=0;for(const c of entries){first=Math.min(first,c.r);last=Math.max(last,c.r);right=Math.max(right,c.c)}
 if(last-first>20000||right>=256||entries.length>200000)throw Error("Ce tableau est trop grand. Garde uniquement les colonnes et les lignes du cahier des charges dans le fichier à importer.");
 const grid=new Map(),mergeRows=new Map();
 for(const c of entries){if(!grid.has(c.r))grid.set(c.r,new Map());grid.get(c.r).set(c.c,c.value)}
 const merges=(ws["!merges"]||[]).filter(m=>m.e.r>=first&&m.s.r<=last&&m.s.c<=right);
 let mergeCells=0;
 for(const m of merges){
  const end=Math.min(m.e.r,last);mergeCells+=end-Math.max(first,m.s.r)+1;
  if(mergeCells>200000)throw Error("Ce fichier contient trop de cellules fusionnées. Importe uniquement le tableau des prestations.");
  for(let r=Math.max(first,m.s.r);r<=end;r++){if(!mergeRows.has(r))mergeRows.set(r,[]);mergeRows.get(r).push(m)}
 }
 const raw=(r,c)=>grid.get(r)?.get(c)||"";
 const merge=(r,c)=>(mergeRows.get(r)||[]).find(m=>c>=m.s.c&&c<=m.e.c)||null;
 const value=(r,c)=>{if(c==null||c<0)return"";const m=merge(r,c);return m?raw(m.s.r,m.s.c):raw(r,c)};
 // Header groups spread over several day columns must not become fake columns.
 const heading=(r,c)=>{const m=merge(r,c);return m&&m.s.c!==c?"":value(r,c)};
 return{first,last,right,raw,merge,value,heading};
}
function matrixColumns(g,start,h,fields,dayCols,frequencyCols){
 const schedule=[...dayCols.map(x=>x.c),...frequencyCols.map(x=>x.c),fields.frequency,fields.daysText].filter(c=>c>=0);
 if(!schedule.length)return;
 const firstSchedule=Math.min(...schedule),stats=new Map();
 const auxiliary=v=>/^(?:n|no|numero|code|ref|reference|quantite|surface|duree|horaire|produit|materiel|nom|prenom|agent|responsable|personnel)(?:s?\b)/.test(N(v));
 const textValue=v=>/[a-z]/.test(N(v))&&!marked(v)&&!ignored(v);
 const inspect=c=>{
  if(stats.has(c))return stats.get(c);
  let count=0,scheduled=0;
  for(let r=start;r<=Math.min(start+199,g.last);r++){
   // Stop at the next matrix, which may have a different column order.
   if(dayCols.filter(x=>role(g.raw(r,x.c))==="day").length>=2)break;
   const v=g.raw(r,c),m=g.merge(r,c);
   if(!textValue(v)||m&&m.e.c>=firstSchedule)continue;
   count++;
   if(schedule.some(col=>marked(g.value(r,col))))scheduled++;
  }
  const result={c,count,scheduled};stats.set(c,result);return result;
 };
 const originalTask=fields.task;
 if(originalTask>=0){
  // A heading spanning Zone + Task is not the location of every task beneath it.
  const merged=g.merge(start-1,originalTask);
  const candidates=[];
  for(let c=originalTask;c<firstSchedule;c++){
   if(c!==originalTask&&T(h[c])&&!(merged&&c<=merged.e.c))break;
   if(!auxiliary(h[c])&&c!==fields.zone)candidates.push(inspect(c));
  }
  const best=candidates.filter(x=>x.count).sort((a,b)=>b.scheduled-a.scheduled||b.count-a.count||b.c-a.c)[0];
  if(best)fields.task=best.c;
 }else{
  // With two or more day headings, infer the task from populated text columns.
  // Explicit personnel/quantity columns must never become cleaning tasks.
  const candidates=[];
  for(let c=0;c<firstSchedule;c++){
   if(c===fields.zone||auxiliary(h[c])||["method","control","notes"].includes(role(h[c])))continue;
   candidates.push(inspect(c));
  }
  const best=candidates.filter(x=>x.count&&x.scheduled).sort((a,b)=>b.scheduled-a.scheduled||b.count-a.count||b.c-a.c)[0];
  if(best)fields.task=best.c;
 }
 if(fields.zone<0&&fields.task>0){
  for(let c=fields.task-1;c>=0;c--){
   const m=g.merge(start-1,c),shared=m&&m.e.c>=fields.task&&m.e.c<firstSchedule;
   if(auxiliary(h[c])||T(h[c])&&c!==originalTask&&role(h[c])!=="zone"&&!shared)continue;
   if(inspect(c).count){fields.zone=c;break}
  }
 }
}
function header(g,r){
 let h=Array.from({length:g.right+1},(_,c)=>g.heading(r,c));
 const task=h.findIndex(v=>role(v)==="task");
 const distinctDays=new Set(h.filter(v=>role(v)==="day").map(N));
 if(task<0&&distinctDays.size<2)return null;
 // An isolated task word inside a data row is not a header.
 const meaningful=h.filter(T);if(meaningful.length>1&&!h.some(v=>["zone","frequency","daysText","method","control","notes","day"].includes(role(v))))return null;
 let end=r;
 for(let next=r+1;next<=Math.min(r+2,g.last);next++){
  const lower=Array.from({length:g.right+1},(_,c)=>g.heading(next,c));
  const direct=lower.filter((v,c)=>T(g.raw(next,c)));
  if(direct.filter(v=>["day","frequencyFlag"].includes(role(v))).length<2||direct.some(v=>!role(v)))break;
  h=h.map((v,c)=>lower[c]||v);end=next;
 }
 const fields={zone:-1,task:-1,frequency:-1,daysText:-1,method:-1,control:-1,notes:-1},dayCols=[],frequencyCols=[];
 h.forEach((v,c)=>{const k=role(v);if(k in fields&&fields[k]<0)fields[k]=c;if(k==="day")dayCols.push({c,index:day(v),label:N(v)});if(k==="frequencyFlag")frequencyCols.push({c,label:T(v)})});
 matrixColumns(g,end+1,h,fields,dayCols,frequencyCols);
 if(fields.task<0)return null;
 // The standard L M M J V (S D) sequence is unambiguous; a lone M is not.
 for(let start=0;start<dayCols.length;start++){
  const block=dayCols.slice(start,start+7),pattern=["l","m","m","j","v","s","d"];
  if(block.length>=5&&block.every((x,i)=>x.label===pattern[i]))block.forEach((x,i)=>x.index=i);
 }
 return{...fields,end,dayCols,frequencyCols};
}
function parseSheet(X,ws){
 const rows=[],warnings=[];let mergedGroups=0,missing=0;
 const g=worksheet(X,ws);if(!g)return{rows,warnings,mergedGroups};
 let columns=null,zone="";
 for(let r=g.first;r<=g.last;r++){
  const candidate=header(g,r);
  if(candidate){columns=candidate;r=candidate.end;continue}
  if(!columns)continue;
  const h=columns,pm=g.merge(r,h.task),p=g.value(r,h.task);
  const scheduleCols=[h.frequency,h.daysText,...h.dayCols.map(x=>x.c),...h.frequencyCols.map(x=>x.c)].filter(c=>c>=0);
  const section=pm&&pm.e.c>pm.s.c&&(pm.s.c<=h.zone&&pm.e.c>=h.task||scheduleCols.some(c=>c>=pm.s.c&&c<=pm.e.c));
  if(section){if(r===pm.s.r&&p&&!ignored(p))zone=p;continue}
  const currentZone=g.value(r,h.zone);if(currentZone&&!ignored(currentZone))zone=currentZone;
  if(pm&&r>pm.s.r)continue;
  if(!p){if(scheduleCols.some(c=>T(g.raw(r,c))))missing++;continue}
  if(ignored(p))continue;
  const end=pm?Math.min(pm.e.r,g.last):r;if(end>r)mergedGroups++;
  const values=col=>{const out=[];if(col<0)return out;for(let rr=r;rr<=end;rr++){const v=g.value(rr,col);if(v&&!out.some(x=>N(x)===N(v)))out.push(v)}return out};
  const frequencies=values(h.frequency),days=new Set();
  for(const {c,index} of h.dayCols){
   if(index<0)continue;
   for(let rr=r;rr<=end;rr++)if(marked(g.value(rr,c)))days.add(DAYS[index]);
  }
  for(const v of [...values(h.daysText),...frequencies])textDays(v).forEach(d=>days.add(d));
  for(const {c,label} of h.frequencyCols)for(let rr=r;rr<=end;rr++)if(marked(g.value(rr,c))){frequencies.push(label);break}
  const jours=DAYS.filter(d=>days.has(d)),frequence=[...new Set(frequencies)].join(" · ");
  const frequenceType=window.InovtecCdcImport?.freq?.(frequence,jours)||"jours";
  rows.push({zone,prestation:p,frequenceType,frequence,jours,methodeConsigne:values(h.method).join(" · "),controle:values(h.control).join(" · "),observations:values(h.notes).join(" · ")});
  if(rows.length>600)throw Error("Import limité à 600 prestations par fichier.");
  if(h.dayCols.some(x=>x.index<0))warnings.push("Une colonne « M » est ambiguë : renomme-la « Mardi » ou « Mercredi » puis réimporte le fichier.");
  r=end;
 }
 if(missing)warnings.push(`${missing} ligne${missing>1?"s":""} avec une fréquence ou des jours, mais sans prestation, ignorée${missing>1?"s":""}.`);
 return{rows,warnings:[...new Set(warnings)],mergedGroups};
}
window.InovtecCdcImportParsers.excel=async file=>{
 if(file.size>20*1024*1024)throw Error("Ce fichier dépasse 20 Mo. Enregistre une copie contenant uniquement le cahier des charges.");
 const X=await load();let wb;
 try{wb=X.read(await file.arrayBuffer(),{type:"array",cellDates:false})}catch(e){throw Error(/password|encrypt/i.test(e?.message||"")?"Ce fichier Excel est protégé par un mot de passe. Importe une copie non protégée.":"Le fichier Excel ne peut pas être lu. Ouvre-le dans Excel puis enregistre une nouvelle copie au format .xlsx.")}
 const rows=[],warnings=[];let mergedGroups=0;
 for(const name of wb.SheetNames||[]){
  if(wb.Workbook?.Sheets?.find(s=>s.name===name)?.Hidden){warnings.push(`Onglet « ${name} » masqué : non importé.`);continue}
  const parsed=parseSheet(X,wb.Sheets[name]);
  rows.push(...parsed.rows);mergedGroups+=parsed.mergedGroups;
  if(rows.length>600)throw Error("Import limité à 600 prestations par fichier.");
  warnings.push(...parsed.warnings.map(w=>`Onglet « ${name} » : ${w}`));
  if(!parsed.rows.length)warnings.push(`Onglet « ${name} » : aucun tableau de prestations reconnu.`);
 }
 if(mergedGroups)warnings.push(`${mergedGroups} prestation${mergedGroups>1?"s":""} sur cellules fusionnées regroupée${mergedGroups>1?"s":""} en une seule ligne.`);
 const reason=rows.length?"":"Aucun tableau de prestations reconnu. L’import recherche les textes des tâches à côté des jours de passage ou d’une fréquence. Vérifie que ces informations sont bien dans des cellules Excel, et non dans une image collée.";
 return{sourceType:"excel",rows,warnings,mergedGroups,reason};
};
})();
