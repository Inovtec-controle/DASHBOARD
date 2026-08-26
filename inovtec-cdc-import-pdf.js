(()=>{"use strict";
window.InovtecCdcImportParsers=window.InovtecCdcImportParsers||{};
const D=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const N=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const T=v=>String(v??"").replace(/\s+/g," ").trim();
let loader=null;
const load=()=>window.pdfjsLib?Promise.resolve(window.pdfjsLib):(loader||(loader=new Promise((ok,no)=>{
  const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";ok(window.pdfjsLib)};
  s.onerror=()=>no(Error("Impossible de charger le lecteur PDF. Vérifie la connexion internet."));document.head.appendChild(s)
})));
function lines(items,t=3){
  const out=[];
  items.slice().sort((a,b)=>a.y-b.y||a.x-b.x).forEach(i=>{
    let l=out.find(x=>Math.abs(x.y-i.y)<=t);
    if(!l)out.push(l={y:i.y,i:[]});
    l.i.push(i);l.y=l.i.reduce((s,x)=>s+x.y,0)/l.i.length
  });
  return out.sort((a,b)=>a.y-b.y).map(l=>({...l,i:l.i.sort((a,b)=>a.x-b.x),text:T(l.i.map(x=>x.s).join(" "))}))
}
function clusters(values,t=8){
  const out=[];
  values.slice().sort((a,b)=>a-b).forEach(v=>{
    let g=out.find(x=>Math.abs(x.m-v)<=t);
    if(!g)out.push(g={v:[],m:v});
    g.v.push(v);g.m=g.v.reduce((a,b)=>a+b,0)/g.v.length
  });
  return out.sort((a,b)=>a.m-b.m)
}
function daysIn(v){
  const n=" "+N(v)+" ",out=[];
  const aliases={
    lundi:["lundi","lun"],mardi:["mardi","mar"],mercredi:["mercredi","mer"],
    jeudi:["jeudi","jeu"],vendredi:["vendredi","ven"],samedi:["samedi","sam"],dimanche:["dimanche","dim"]
  };
  D.forEach(d=>{if(aliases[d].some(a=>new RegExp(`(?:^| )${a}(?: |$)`).test(n))&&!out.includes(d))out.push(d)});
  return out
}
function freqType(f,j=[]){
  return window.InovtecCdcImport?.freq?.(f,j)||(/mensuel|chaque mois/.test(N(f))?"mensuel":/quotidien|tous les jours|chaque jour/.test(N(f))?"quotidien":/hebdo|chaque semaine|semaine/.test(N(f))?"hebdomadaire":j.length?"jours":f?"autre":"jours")
}
function cleanText(s){return T(String(s||"").replace(/^[\s•·▪◦‣►*–—-]+/,"").replace(/^\s*\d{1,3}\s*[.)-]\s*/,""))}
function noise(s){
  const n=N(s);
  if(!n)return true;
  if(/^(page\s*)?\d+\s*(\/|sur)\s*\d+$/.test(n)||/^page\s+\d+$/.test(n))return true;
  if(/^(cahier des charges|sommaire|signature|visa|date|client|site|chantier)$/.test(n))return true;
  if(/^total|^sous total/.test(n))return true;
  return false
}
function partition(R,Z){
  const n=R.length,k=Z.length;if(!k)return R.map(()=>-1);if(k===1)return R.map(()=>0);if(n<k)return R.map((_,i)=>Math.min(i,k-1));
  const p=[0];R.forEach(r=>p.push(p.at(-1)+r.y));
  const c=(a,b,z)=>{const m=(p[b+1]-p[a])/(b-a+1),lo=R[a].y,hi=R[b].y,zy=Z[z].y;let q=(m-zy)**2;if(zy<lo-14)q+=(lo-14-zy)**2*3;if(zy>hi+14)q+=(zy-hi-14)**2*3;return q};
  const dp=Array.from({length:k},()=>Array(n).fill(Infinity)),pr=Array.from({length:k},()=>Array(n).fill(-1));
  for(let j=0;j<=n-k;j++)dp[0][j]=c(0,j,0);
  for(let z=1;z<k;z++)for(let j=z;j<=n-(k-z);j++)for(let x=z-1;x<j;x++){const v=dp[z-1][x]+c(x+1,j,z);if(v<dp[z][j]){dp[z][j]=v;pr[z][j]=x}}
  let j=n-1,A=Array(n).fill(0);for(let z=k-1;z>=0;z--){const x=z?pr[z][j]:-1;for(let i=x+1;i<=j;i++)A[i]=z;j=x}return A
}
function weeklyParse(I,W){
  const H={};I.forEach(i=>D.forEach(k=>{if(N(i.s).startsWith(k.slice(0,5)))H[k]=i.x+i.w/2}));
  const M=I.filter(i=>/[✕×✓✔]/.test(i.s)||/^x$/i.test(i.s)),mc=clusters(M.map(x=>x.x+x.w/2));
  let C=D.map(k=>({k,x:H[k]})).filter(x=>Number.isFinite(x.x));
  if(C.length<3)C=mc.slice(0,7).map((g,i)=>({k:D[i],x:g.m}));
  if(C.length<3)return[];
  const fx=Math.min(...C.map(x=>x.x)),sx=C.map(x=>x.x).sort((a,b)=>a-b),g=sx.slice(1).map((x,i)=>x-sx[i]).sort((a,b)=>a-b);
  const left=fx-Math.max(12,(g[Math.floor(g.length/2)]||34)/2);
  const hy=Math.min(...I.filter(i=>D.some(k=>N(i.s).startsWith(k.slice(0,5)))).map(i=>i.y).concat([Infinity]));
  const B=I.filter(i=>i.y>(Number.isFinite(hy)?hy+7:0)),L=lines(B);
  const mins=L.map(l=>Math.min(...l.i.filter(i=>i.x<left).map(i=>i.x).concat([Infinity]))).filter(x=>Number.isFinite(x)&&x>W*.05);
  let cut=fx*.42,U=[...new Set(mins.map(Math.round))].sort((a,b)=>a-b),bg=0;
  for(let i=1;i<U.length;i++){const q=U[i]-U[i-1];if(q>bg&&U[i-1]<fx*.60&&U[i]>W*.12){bg=q;cut=(U[i]+U[i-1])/2}}
  const Z=[];
  for(const l of L){
    const a=l.i.filter(i=>i.x<cut&&i.x>W*.04),z=T(a.map(i=>i.s).join(" ")),letters=z.replace(/[^A-Za-zÀ-ÿ]/g,"");
    if(!a.length||!z||/prestations|jours|frequence|fréquence/i.test(z)||letters.length<2||z.length>=70)continue;
    const allUpper=z===z.toUpperCase(),looksHeading=allUpper||(/^[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ'’ -]{2,50}$/.test(z)&&!/[.!?;:]$/.test(z));
    if(!looksHeading)continue;
    const x=Math.min(...a.map(i=>i.x)),p=Z.at(-1);
    if(p&&Math.abs(l.y-p.y)<13&&Math.abs(x-p.x)<25){p.n=T(p.n+" "+z);p.y=(p.y+l.y)/2}else Z.push({y:l.y,x,n:z})
  }
  const P=[];
  for(const l of L){
    const a=l.i.filter(i=>i.x>=cut&&i.x<left),s=T(a.map(i=>i.s).join(" "));
    if(!a.length||!s||noise(s))continue;
    const x=Math.min(...a.map(i=>i.x)),p=P.at(-1);
    if(p&&l.y-p.last<11.6&&Math.abs(x-p.x)<90&&!/^[•▪◦*-]/.test(s)){p.s=T(p.s+" "+s);p.y=(p.y+l.y)/2;p.last=l.y}else P.push({y:l.y,last:l.y,x,s})
  }
  if(!P.length)return[];
  const A=partition(P,Z),R=P.map((r,i)=>({zone:A[i]>=0?Z[A[i]]?.n||"":"",prestation:cleanText(r.s),frequence:"",frequenceType:"jours",jours:[],methodeConsigne:"",controle:"",observations:"",_y:r.y,_z:A[i]})).filter(r=>r.prestation);
  M.forEach(m=>{
    let ri=-1,rd=99;R.forEach((r,i)=>{const q=Math.abs(r._y-m.y);if(q<rd){rd=q;ri=i}});if(ri<0||rd>10)return;
    let d=null,dd=99;C.forEach(c=>{const q=Math.abs(c.x-(m.x+m.w/2));if(q<dd){dd=q;d=c}});
    if(d&&dd<28&&!R[ri].jours.includes(d.k))R[ri].jours.push(d.k)
  });
  const F=lines(B.filter(i=>i.x>=left&&!M.includes(i)&&!D.some(k=>N(i.s).startsWith(k.slice(0,5)))),2.8)
    .map(l=>({y:l.y,s:T(l.text)})).filter(x=>/mensuel|hebdo|quotid|semaine|paire|impaire|ponctuel|annuel|trimestr|semestr|fois|jour/i.test(N(x.s)));
  F.forEach(f=>{
    let zi=-1,zd=99;Z.forEach((z,i)=>{const q=Math.abs(z.y-f.y);if(q<zd){zd=q;zi=i}});
    if(zi>=0&&zd<5.5&&/mensuel/.test(N(f.s))){R.filter(r=>r._z===zi&&!r.jours.length).forEach(r=>{r.frequence=f.s;r.frequenceType="mensuel"});return}
    let ri=-1,rd=99;R.forEach((r,i)=>{const q=Math.abs(r._y-f.y);if(q<rd){rd=q;ri=i}});
    if(ri>=0&&rd<10){R[ri].frequence=f.s;R[ri].frequenceType=freqType(f.s,R[ri].jours)}
  });
  return R.map(({_y,_z,...r})=>r)
}
function kind(v){
  const n=N(v);
  if(/^(zone|secteur|local|partie|categorie|lieu)$/.test(n))return"zone";
  if(/prestation|tache|travaux|designation|description|operation|intervention/.test(n))return"prestation";
  if(/frequence|periodicite|rythme|cadence/.test(n))return"frequence";
  if(/methode|consigne|mode operatoire|modalite/.test(n))return"methode";
  if(/controle|exigence|resultat attendu/.test(n))return"controle";
  if(/observation|remarque|notes?/.test(n))return"observations";
  const d=D.find(x=>n.startsWith(x.slice(0,3)));return d||""
}
function tableParse(I){
  const L=lines(I,3),candidates=[];
  L.forEach(l=>{
    const types=[...new Set(l.i.map(x=>kind(x.s)).filter(Boolean))];
    const hasP=types.includes("prestation"),score=types.length+(hasP?4:0);
    if(hasP&&score>=5)candidates.push({l,types,score})
  });
  if(!candidates.length)return[];
  candidates.sort((a,b)=>b.score-a.score||a.l.y-b.l.y);
  const h=candidates[0].l,raw=[];
  h.i.forEach(i=>{const k=kind(i.s);if(k)raw.push({k,x:i.x})});
  const map=new Map();
  raw.forEach(c=>{if(!map.has(c.k))map.set(c.k,c.x)});
  const cols=[...map].map(([k,x])=>({k,x})).sort((a,b)=>a.x-b.x);
  if(!cols.some(c=>c.k==="prestation"))return[];
  const boundaries=cols.map((c,i)=>i===cols.length-1?Infinity:(c.x+cols[i+1].x)/2);
  const assign=item=>{
    const x=item.x;
    for(let i=0;i<cols.length;i++)if(x<boundaries[i])return cols[i].k;
    return cols.at(-1).k
  };
  let zone="",out=[];
  for(const l of L){
    if(l.y<=h.y+4)continue;
    const n=N(l.text);if(!n||noise(l.text))continue;
    const types=[...new Set(l.i.map(x=>kind(x.s)).filter(Boolean))];
    if(types.includes("prestation")&&types.length>=2)continue;
    const cell={};l.i.forEach(i=>{const k=assign(i);cell[k]=T((cell[k]||"")+" "+i.s)});
    if(cell.zone)zone=cleanText(cell.zone);
    let p=cleanText(cell.prestation||"");
    if(!p){continue}
    if(/^(prestation|description|designation|tache|travaux)$/i.test(N(p)))continue;
    const f=T(cell.frequence||""),j=[...new Set(D.filter(d=>cell[d]&&(/[✕×✓✔]/.test(cell[d])||/^x$|^oui$|^1$/i.test(T(cell[d])))).concat(daysIn(f)))];
    out.push({zone,prestation:p,frequence:f,frequenceType:freqType(f,j),jours:j,methodeConsigne:T(cell.methode||""),controle:T(cell.controle||""),observations:T(cell.observations||"")})
  }
  return out
}
function labelledParse(I){
  const L=lines(I,3.2),out=[];let zone="";
  for(const l of L){
    const s=T(l.text),n=N(s);if(!s||noise(s))continue;
    let m=s.match(/^(?:zone|secteur|local|lieu|partie)\s*[:\-]\s*(.+)$/i);if(m){zone=T(m[1]);continue}
    m=s.match(/^(?:prestation|t[aâ]che|travaux|op[eé]ration|intervention)\s*[:\-]\s*(.+)$/i);
    if(m){
      let p=T(m[1]),f="",obs="";
      const fm=p.match(/\s+(?:fr[eé]quence|p[eé]riodicit[eé])\s*[:\-]\s*(.+)$/i);if(fm){f=T(fm[1]);p=T(p.slice(0,fm.index))}
      const j=daysIn(f);
      if(p)out.push({zone,prestation:p,frequence:f,frequenceType:freqType(f,j),jours:j,methodeConsigne:"",controle:"",observations:obs});
      continue
    }
    if(out.length&&/^(?:frequence|fr[eé]quence|periodicite|p[eé]riodicit[eé])\s*[:\-]/i.test(s)){
      const f=T(s.replace(/^[^:\-]+[:\-]\s*/,"")),r=out.at(-1);r.frequence=f;r.jours=daysIn(f);r.frequenceType=freqType(f,r.jours)
    }
  }
  return out
}
function listParse(I){
  const L=lines(I,3.2),out=[];let zone="",inside=false,bulletCount=0;
  for(const l of L){
    const s=T(l.text),n=N(s);if(!s||noise(s))continue;
    if(/^(prestations?|travaux|taches?|operations?|interventions?)( a realiser| attendues?)?$/.test(n)){inside=true;continue}
    const upper=s===s.toUpperCase(),heading=(upper&&s.length>=3&&s.length<=65&&!/[.!?;:]$/.test(s));
    if(heading&&!/frequence|periodicite|cahier des charges|prestations|travaux|taches/.test(n)){zone=s;continue}
    const bullet=/^[\s•·▪◦‣►*–—-]+/.test(s)||/^\s*\d{1,3}\s*[.)-]\s+/.test(s);
    if(!bullet&&!inside)continue;
    if(!bullet&&inside){
      if(s.length>180||/[.!?]$/.test(s)||/^(objet|generalites|conditions|organisation|materiel|produits|securite)/i.test(n))continue;
    }
    const p=cleanText(s);if(!p||p.length<3||p.length>220)continue;
    if(bullet)bulletCount++;
    const j=daysIn(p),f=/quotid|hebdo|mensuel|semaine|jour|fois|trimestr|annuel/i.test(N(p))?p.match(/(?:quotid\w*|hebdo\w*|mensuel\w*|trimestr\w*|annuel\w*|\d+\s*(?:x|fois)\s*(?:par\s*)?(?:jour|semaine|mois))/i)?.[0]||"":"";
    out.push({zone,prestation:p,frequence:f,frequenceType:freqType(f,j),jours:j,methodeConsigne:"",controle:"",observations:""})
  }
  return bulletCount>=2||out.length>=4?out:[]
}
function quality(rows){
  if(!rows.length)return 0;
  const useful=rows.filter(r=>r.prestation&&r.prestation.length>=3).length,z=new Set(rows.map(r=>N(r.zone)).filter(Boolean)).size;
  return useful*10+Math.min(z,8)*2
}
window.InovtecCdcImportParsers.pdf=async file=>{
  const P=await load(),pdf=await P.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out=[],warnings=[];
  let textChars=0,fallbackPages=0;
  for(let n=1;n<=pdf.numPages;n++){
    const p=await pdf.getPage(n),v=p.getViewport({scale:1}),c=await p.getTextContent();
    const I=c.items.map(i=>({s:T(i.str),x:+(i.transform?.[4]||0),y:v.height-+(i.transform?.[5]||0),w:+(i.width||0)})).filter(i=>i.s);
    textChars+=I.reduce((s,i)=>s+i.s.length,0);
    const choices=[
      {name:"planning",rows:weeklyParse(I,v.width)},
      {name:"tableau",rows:tableParse(I)},
      {name:"libelle",rows:labelledParse(I)},
      {name:"liste",rows:listParse(I)}
    ].sort((a,b)=>quality(b.rows)-quality(a.rows));
    const best=choices[0];if(best.rows.length){out.push(...best.rows);if(best.name!=="planning")fallbackPages++}
  }
  if(!out.length){
    const reason=textChars<30
      ?"Ce PDF semble être un scan ou une image : aucun texte exploitable n’a été détecté. Utilise un PDF avec texte sélectionnable ou passe le document par OCR."
      :"Le PDF contient du texte, mais aucun tableau ou aucune liste de prestations suffisamment fiable n’a été reconnu.";
    return{sourceType:"pdf",rows:[],warnings:[reason],reason}
  }
  if(fallbackPages)warnings.push(`Lecture PDF adaptable utilisée sur ${fallbackPages} page${fallbackPages>1?"s":""}. Vérifie l’aperçu avant d’importer.`);
  return{sourceType:"pdf",rows:out,warnings,reason:""};
};
})();