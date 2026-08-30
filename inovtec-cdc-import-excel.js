(()=>{
"use strict";
window.InovtecCdcImportParsers=window.InovtecCdcImportParsers||{};

const N=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const T=v=>String(v??"").replace(/\s+/g," ").trim();
const D=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];

const load=()=>window.XLSX
 ? Promise.resolve(window.XLSX)
 : new Promise((ok,no)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload=()=>ok(window.XLSX);
    s.onerror=()=>no(Error("Impossible de charger le lecteur Excel."));
    document.head.appendChild(s);
   });

const idx=(h,p)=>{
 for(let i=0;i<h.length;i++){
  const x=N(h[i]);
  if(p.some(r=>r.test(x)))return i;
 }
 return-1;
};

const mark=v=>/^(x|oui|yes|ok|v|1)$/.test(N(v))||/[✓✔✕×]/.test(String(v));

function relMerges(X,ws){
 const ref=ws?.["!ref"];
 if(!ref)return[];
 const range=X.utils.decode_range(ref);
 return (ws["!merges"]||[]).map(m=>({
  s:{r:m.s.r-range.s.r,c:m.s.c},
  e:{r:m.e.r-range.s.r,c:m.e.c}
 })).filter(m=>m.e.r>=0&&m.e.c>=0);
}

function mergeAt(merges,r,c){
 return merges.find(m=>r>=m.s.r&&r<=m.e.r&&c>=m.s.c&&c<=m.e.c)||null;
}

function cell(g,merges,r,c){
 if(c<0||r<0)return"";
 const direct=T(g?.[r]?.[c]);
 if(direct)return direct;
 const m=mergeAt(merges,r,c);
 if(!m)return"";
 return T(g?.[m.s.r]?.[m.s.c]);
}

function uniqueValues(g,merges,start,end,col){
 if(col<0)return[];
 const out=[];
 for(let r=start;r<=end;r++){
  const v=cell(g,merges,r,col);
  if(v&&!out.some(x=>N(x)===N(v)))out.push(v);
 }
 return out;
}

function rowHasContinuation(g,merges,r,cols,dayCols){
 if(dayCols.some(c=>c>=0&&mark(cell(g,merges,r,c))))return true;
 return cols.some(c=>c>=0&&T(cell(g,merges,r,c)));
}

function isIgnoredTask(p){
 return /^(total|sous total|sous-total|signature|page\b)/i.test(T(p));
}

function parseSheet(X,ws){
 const out=[];
 let mergedGroups=0;
 const ref=ws?.["!ref"];
 if(!ref)return{rows:out,mergedGroups};

 const range=X.utils.decode_range(ref);
 const colCount=Math.max(1,range.e.c+1);
 const g=X.utils.sheet_to_json(ws,{
  header:1,
  defval:"",
  raw:false,
  blankrows:true,
  range:{s:{r:range.s.r,c:0},e:{r:range.e.r,c:range.e.c}}
 });
 if(!g.length)return{rows:out,mergedGroups};

 const merges=relMerges(X,ws);
 const expandedRow=r=>Array.from({length:colCount},(_,c)=>cell(g,merges,r,c));

 let hi=-1,best=-1;
 for(let r=0;r<Math.min(30,g.length);r++){
  const score=expandedRow(r).map(N).reduce((a,x)=>a+(
   /zone|secteur|local|prestation|tache|travaux|designation|description|frequence|periodicite|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|methode|consigne|controle|observation/.test(x)?1:0
  ),0);
  if(score>best){best=score;hi=r}
 }
 if(hi<0||best<1)return{rows:out,mergedGroups};

 const h=expandedRow(hi);
 let iz=idx(h,[/^zone$/,/^secteur$/,/^local$/,/^partie$/,/^categorie$/]);
 let ip=idx(h,[/prestation/,/^tache/,/^travaux/,/designation/,/description/,/operation/]);
 const iff=idx(h,[/frequence/,/periodicite/,/rythme/]);
 const im=idx(h,[/methode/,/consigne/,/mode operatoire/]);
 const ic=idx(h,[/controle/,/exigence/]);
 const io=idx(h,[/observation/,/remarque/,/^notes?$/]);
 const di={};
 D.forEach(k=>di[k]=idx(h,[new RegExp(`^${k.slice(0,3)}`)]));

 if(ip<0){
  const ex=new Set([iz,iff,im,ic,io,...Object.values(di)]);
  ip=h.findIndex((x,i)=>!ex.has(i)&&T(x));
 }
 if(ip<0)return{rows:out,mergedGroups};
 if(iz<0&&ip>0)iz=ip-1;

 const dayCols=D.map(k=>di[k]).filter(c=>c>=0);
 const continuationCols=[iff,im,ic,io].filter(c=>c>=0);
 let z="";

 for(let r=hi+1;r<g.length;){
  const zoneHere=iz>=0?cell(g,merges,r,iz):"";
  if(zoneHere)z=zoneHere;

  const pm=mergeAt(merges,r,ip);
  let p=pm?cell(g,merges,pm.s.r,ip):T(g?.[r]?.[ip]);

  if(pm&&r>pm.s.r){
   r++;
   continue;
  }
  if(!p||isIgnoredTask(p)){
   r++;
   continue;
  }

  let end=r;
  if(pm&&pm.s.r===r&&pm.e.r>r){
   end=Math.min(g.length-1,pm.e.r);
   mergedGroups++;
  }else{
   for(let k=r+1;k<g.length;k++){
    const rawZone=iz>=0?T(g?.[k]?.[iz]):"";
    if(rawZone&&z&&N(rawZone)!==N(z))break;

    const km=mergeAt(merges,k,ip);
    const rawP=T(g?.[k]?.[ip]);
    const kp=km?cell(g,merges,km.s.r,ip):rawP;

    if(km&&km.s.r===k&&kp&&N(kp)!==N(p))break;
    if(kp&&N(kp)!==N(p))break;

    const cont=rowHasContinuation(g,merges,k,continuationCols,dayCols);
    const sameTask=kp&&N(kp)===N(p);
    if(!sameTask&&!cont)break;

    end=k;
   }
  }

  const jours=[];
  D.forEach(k=>{
   const c=di[k];
   if(c<0)return;
   for(let rr=r;rr<=end;rr++){
    if(mark(cell(g,merges,rr,c))){
     jours.push(k);
     break;
    }
   }
  });

  const freqValues=uniqueValues(g,merges,r,end,iff);
  const methodValues=uniqueValues(g,merges,r,end,im);
  const controlValues=uniqueValues(g,merges,r,end,ic);
  const observationValues=uniqueValues(g,merges,r,end,io);
  const frequence=freqValues.join(" · ");
  const frequenceType=window.InovtecCdcImport?.freq?.(frequence,jours)||"jours";

  out.push({
   zone:z,
   prestation:p,
   frequenceType,
   frequence,
   jours:[...new Set(jours)],
   methodeConsigne:methodValues.join(" · "),
   controle:controlValues.join(" · "),
   observations:observationValues.join(" · ")
  });

  r=end+1;
 }

 return{rows:out,mergedGroups};
}

window.InovtecCdcImportParsers.excel=async file=>{
 const X=await load();
 const wb=X.read(await file.arrayBuffer(),{type:"array",cellDates:false});
 const rows=[],warnings=[];
 let mergedGroups=0;

 for(const sn of wb.SheetNames){
  const parsed=parseSheet(X,wb.Sheets[sn]);
  rows.push(...parsed.rows);
  mergedGroups+=parsed.mergedGroups;
 }

 if(mergedGroups){
  warnings.push(`${mergedGroups} cellule${mergedGroups>1?"s":""} fusionnée${mergedGroups>1?"s":""} regroupée${mergedGroups>1?"s":""} en une seule prestation.`);
 }
 if(!rows.length){
  warnings.push("Aucun tableau Excel avec des colonnes reconnaissables n’a été trouvé.");
 }

 return{
  sourceType:"excel",
  rows,
  warnings,
  mergedGroups,
  reason:rows.length?"":warnings[warnings.length-1]
 };
};
})();