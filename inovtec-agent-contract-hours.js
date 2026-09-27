(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
const frame=document.getElementById("legacyFrame");
let installedFor=null;
function parseHours(v){
  const n=Number(String(v??"").trim().replace(",","."));
  return Number.isFinite(n)&&n>0?n:null;
}
function install(){
  try{
    const w=frame?.contentWindow,d=frame?.contentDocument;
    if(!w||!d||!d.body||!d.getElementById("f_contrat")||!w.state){setTimeout(install,180);return}
    if(installedFor===d)return;
    installedFor=d;

    let input=d.getElementById("f_heuresContrat");
    if(!input){
      const contrat=d.getElementById("f_contrat");
      const field=d.createElement("div");
      field.className="field";
      field.innerHTML='<label>Heures contractuelles / semaine</label><input class="input" type="number" min="1" max="60" step="0.25" id="f_heuresContrat" inputmode="decimal" placeholder="Ex. 12, 24, 35"><div class="muted" style="margin-top:4px">Utilisé par le Planning pour contrôler l’amplitude et le repos quotidien.</div>';
      contrat.closest(".field")?.insertAdjacentElement("afterend",field);
      input=d.getElementById("f_heuresContrat");
    }

    const fill=()=>{
      try{
        const a=w.getSelectedAgent?.();
        if(!input)return;
        const raw=a?.job?.contractHoursWeekly;
        input.value=(raw===null||raw===undefined||raw==="")?"":String(raw);
      }catch{}
    };

    const saveBtn=d.getElementById("btnSaveAgent");
    if(saveBtn&&!saveBtn.dataset.ivContractHours){
      saveBtn.dataset.ivContractHours="1";
      const original=saveBtn.onclick||w.saveAgentForm;
      saveBtn.onclick=function(ev){
        const a=w.getSelectedAgent?.();
        if(a){
          a.job=a.job||{};
          const raw=String(input?.value||"").trim();
          if(raw){
            const n=parseHours(raw);
            if(n===null||n>60){
              alert("Indique un nombre d’heures contractuelles hebdomadaires compris entre 1 et 60 h.");
              input?.focus();
              return;
            }
            a.job.contractHoursWeekly=Math.round(n*100)/100;
          }else{
            a.job.contractHoursWeekly="";
          }
        }
        if(typeof original==="function")original.call(w,ev);
        setTimeout(fill,0);
      };
    }

    d.getElementById("agentList")?.addEventListener("click",()=>setTimeout(fill,0),true);
    if(window.MutationObserver){
      const title=d.getElementById("agentName");
      if(title)new MutationObserver(fill).observe(title,{childList:true,subtree:true,characterData:true});
    }
    fill();
  }catch(e){console.warn("Agent contract hours runtime",e);setTimeout(install,250)}
}
frame?.addEventListener("load",()=>{installedFor=null;setTimeout(install,60)});
setTimeout(install,100);
setTimeout(install,500);
})();

(()=>{
"use strict";
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode!=="agents")return;
if(window.__INOVTEC_AGENT_INCIDENT_PDF_V1__)return;
window.__INOVTEC_AGENT_INCIDENT_PDF_V1__=true;

const frame=document.getElementById("legacyFrame");
let installedFor=null;
let jsPdfPromise=null;

function clean(value){return value==null?"":String(value).trim()}
function safeFile(value){
  return clean(value||"incident").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"incident";
}
function frDate(iso){
  const m=clean(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}/${m[2]}/${m[1]}`:(clean(iso)||"—");
}
function agentName(agent){
  const i=agent?.identity||{};
  return `${clean(i.prenom)} ${clean(i.nom)}`.trim()||"Agent";
}

function loadJsPdf(w,d){
  if(w?.jspdf?.jsPDF)return Promise.resolve(w.jspdf.jsPDF);
  if(jsPdfPromise)return jsPdfPromise;
  jsPdfPromise=new Promise((resolve,reject)=>{
    const existing=d.querySelector('script[data-iv-incident-jspdf="1"]');
    const done=()=>w?.jspdf?.jsPDF?resolve(w.jspdf.jsPDF):reject(new Error("jsPDF indisponible"));
    if(existing){
      if(w?.jspdf?.jsPDF){resolve(w.jspdf.jsPDF);return}
      existing.addEventListener("load",done,{once:true});
      existing.addEventListener("error",()=>reject(new Error("Chargement jsPDF impossible")),{once:true});
      return;
    }
    const s=d.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.async=true;
    s.dataset.ivIncidentJspdf="1";
    s.onload=done;
    s.onerror=()=>reject(new Error("Chargement jsPDF impossible"));
    d.head.appendChild(s);
  }).catch(err=>{jsPdfPromise=null;throw err});
  return jsPdfPromise;
}

function dataUrlToJpeg(w,dataUrl){
  return new Promise((resolve,reject)=>{
    if(!dataUrl){reject(new Error("Image vide"));return}
    const img=new w.Image();
    img.onload=()=>{
      try{
        const max=1800;
        let width=img.naturalWidth||img.width||1,height=img.naturalHeight||img.height||1;
        const ratio=Math.min(1,max/Math.max(width,height));
        width=Math.max(1,Math.round(width*ratio));
        height=Math.max(1,Math.round(height*ratio));
        const canvas=w.document.createElement("canvas");
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        ctx.fillStyle="#ffffff";
        ctx.fillRect(0,0,width,height);
        ctx.drawImage(img,0,0,width,height);
        resolve({data:canvas.toDataURL("image/jpeg",0.88),width,height});
      }catch(e){reject(e)}
    };
    img.onerror=()=>reject(new Error("Image illisible"));
    img.src=dataUrl;
  });
}

async function generateIncidentPdf(w,d,agent,incident){
  try{
    const JsPDF=await loadJsPdf(w,d);
    const doc=new JsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    const pageW=210,pageH=297,left=16,right=16,usable=pageW-left-right;
    let y=16;
    const ensure=(needed=12)=>{if(y+needed>pageH-18){doc.addPage();y=16}};
    const line=(label,value)=>{
      ensure(12);
      doc.setFont("helvetica","bold");
      doc.setFontSize(10);
      doc.setTextColor(71,85,105);
      doc.text(label,left,y);
      const labelW=doc.getTextWidth(label)+3;
      doc.setFont("helvetica","normal");
      doc.setTextColor(15,23,42);
      const parts=doc.splitTextToSize(clean(value)||"—",Math.max(45,usable-labelW));
      doc.text(parts,left+labelW,y);
      y+=Math.max(7,parts.length*5+2);
    };
    const block=(label,value)=>{
      ensure(16);
      doc.setFont("helvetica","bold");
      doc.setFontSize(10);
      doc.setTextColor(71,85,105);
      doc.text(label,left,y);
      y+=6;
      doc.setFont("helvetica","normal");
      doc.setFontSize(10.5);
      doc.setTextColor(15,23,42);
      const parts=doc.splitTextToSize(clean(value)||"—",usable);
      parts.forEach(part=>{ensure(7);doc.text(part,left,y);y+=5.4});
      y+=3;
    };

    doc.setFillColor(6,78,59);
    doc.roundedRect(left,y,usable,22,3,3,"F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(17);
    doc.text("Fiche incident",left+7,y+9);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9.5);
    doc.text(agentName(agent),left+7,y+16);
    y+=31;

    line("Date :",frDate(incident?.date));
    line("Catégorie :",incident?.categorie||"—");
    line("Gravité :",incident?.gravite||"Modérée");
    line("Statut :",incident?.statut||"Ouvert");
    y+=2;
    block("Titre",incident?.titre||"Incident");
    block("Description / suite donnée",incident?.description||"");

    const photos=Array.isArray(incident?.photos)?incident.photos:[];
    if(photos.length){
      ensure(14);
      doc.setFont("helvetica","bold");
      doc.setFontSize(11);
      doc.setTextColor(15,23,42);
      doc.text(`Photos (${photos.length})`,left,y);
      y+=7;
      for(let i=0;i<photos.length;i++){
        try{
          const img=await dataUrlToJpeg(w,photos[i]?.dataUrl);
          let iw=usable,ih=iw*(img.height/img.width);
          const maxH=105;
          if(ih>maxH){ih=maxH;iw=ih*(img.width/img.height)}
          ensure(ih+13);
          doc.setFont("helvetica","normal");
          doc.setFontSize(8.5);
          doc.setTextColor(100,116,139);
          doc.text(clean(photos[i]?.name)||`Photo ${i+1}`,left,y);
          y+=5;
          doc.addImage(img.data,"JPEG",left,y,iw,ih,undefined,"FAST");
          y+=ih+7;
        }catch(e){
          ensure(9);
          doc.setFont("helvetica","italic");
          doc.setFontSize(8.5);
          doc.setTextColor(148,163,184);
          doc.text(`Photo ${i+1} non intégrable`,left,y);
          y+=7;
        }
      }
    }

    const pages=doc.getNumberOfPages();
    for(let p=1;p<=pages;p++){
      doc.setPage(p);
      doc.setDrawColor(226,232,240);
      doc.line(left,pageH-13,pageW-right,pageH-13);
      doc.setFont("helvetica","normal");
      doc.setFontSize(8);
      doc.setTextColor(100,116,139);
      doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`,left,pageH-8);
      doc.text(`Page ${p}/${pages}`,pageW-right,pageH-8,{align:"right"});
    }

    const filename=`Incident_${safeFile(agentName(agent))}_${safeFile(frDate(incident?.date))}_${safeFile(incident?.titre||"incident")}.pdf`;
    doc.save(filename);
  }catch(err){
    console.error("PDF incident",err);
    w.alert("Impossible de générer le PDF de cet incident. Réessaie après avoir actualisé la page.");
  }
}

function installButtons(w,d){
  const agent=w.getSelectedAgent?.();
  if(!agent||!Array.isArray(agent.incidents))return;
  d.querySelectorAll("[data-inc-edit]").forEach(edit=>{
    const id=edit.getAttribute("data-inc-edit");
    if(!id)return;
    const parent=edit.parentElement;
    const exists=parent&&Array.from(parent.querySelectorAll("[data-inc-pdf]")).some(b=>String(b.getAttribute("data-inc-pdf"))===String(id));
    if(exists)return;
    const incident=agent.incidents.find(x=>String(x?.id)===String(id));
    if(!incident)return;
    const btn=d.createElement("button");
    btn.type="button";
    btn.className="tiny green ivIncidentPdfBtn";
    btn.setAttribute("data-inc-pdf",id);
    btn.textContent="PDF";
    btn.title="Générer le PDF de cet incident";
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();generateIncidentPdf(w,d,agent,incident)};
    edit.insertAdjacentElement("beforebegin",btn);
  });
}

function install(){
  try{
    const w=frame?.contentWindow,d=frame?.contentDocument;
    if(!w||!d||!d.body||!w.state||typeof w.renderAll!=="function"||typeof w.getSelectedAgent!=="function"){
      setTimeout(install,180);
      return;
    }
    if(installedFor===d){installButtons(w,d);return}
    installedFor=d;

    const css=d.createElement("style");
    css.textContent='.ivIncidentPdfBtn{border-color:rgba(6,78,59,.24)!important;background:rgba(6,78,59,.09)!important;color:#065f46!important}';
    d.head.appendChild(css);

    const originalRenderAll=w.renderAll.bind(w);
    w.renderAll=function(){
      const r=originalRenderAll();
      setTimeout(()=>installButtons(w,d),0);
      return r;
    };

    loadJsPdf(w,d).catch(()=>{});
    installButtons(w,d);
  }catch(e){
    console.warn("Incident PDF runtime",e);
    installedFor=null;
    setTimeout(install,250);
  }
}

frame?.addEventListener("load",()=>{installedFor=null;jsPdfPromise=null;setTimeout(install,90)});
setTimeout(install,140);
setTimeout(install,700);
})();
