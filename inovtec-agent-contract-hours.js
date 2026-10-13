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
    let available=d.getElementById("f_heuresDisponibles");
    if(!input||!available){
      const contrat=d.getElementById("f_contrat");
      let row=d.getElementById("ivAgentHoursRow");
      if(!row){
        row=d.createElement("div");
        row.id="ivAgentHoursRow";
        row.style.cssText="grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start";
        const css=d.createElement("style");
        css.textContent="@media(max-width:560px){#ivAgentHoursRow{grid-template-columns:1fr!important}}";
        d.head.appendChild(css);
        contrat.closest(".field")?.insertAdjacentElement("afterend",row);
      }
      if(input&&input.closest(".field"))row.appendChild(input.closest(".field"));
      if(!input){
        const field=d.createElement("div");
        field.className="field";
        field.innerHTML='<label for="f_heuresContrat">Heures contractuelles / semaine</label><input class="input" type="number" min="1" max="60" step="0.25" id="f_heuresContrat" inputmode="decimal" placeholder="Ex. 12, 24, 35"><div class="muted" style="margin-top:4px">Volume horaire prévu au contrat.</div>';
        row.appendChild(field);
      }
      if(!available){
        const field=d.createElement("div");
        field.className="field";
        field.innerHTML='<label for="f_heuresDisponibles">Heures disponibles / semaine (remplacements)</label><input class="input" type="number" min="0" max="60" step="0.25" id="f_heuresDisponibles" inputmode="decimal" placeholder="Ex. 5"><div class="muted" style="margin-top:4px">Volume supplémentaire mobilisable pour les remplacements, au-delà des heures contractuelles. Laisser vide si non défini.</div>';
        row.appendChild(field);
      }
      input=d.getElementById("f_heuresContrat");
      available=d.getElementById("f_heuresDisponibles");
    }

    const fill=()=>{
      try{
        const a=w.getSelectedAgent?.();
        if(!input)return;
        const raw=a?.job?.contractHoursWeekly;
        input.value=(raw===null||raw===undefined||raw==="")?"":String(raw);
        const extra=a?.job?.replacementHoursAvailableWeekly;
        if(available)available.value=(extra===null||extra===undefined||extra==="")?"":String(extra);
      }catch{}
    };

    // La sauvegarde est volontairement gérée uniquement par AGENTS-LEGACY.html.
    // Ce module ajoute et remplit le champ, sans jamais intercepter le bouton Enregistrer.

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

async function generateIncidentPdf(w,d,agent,incident,action="download",printWindow=null){
  try{
    const JsPDF=await loadJsPdf(w,d);
    const pdf=new JsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    const pageW=210,pageH=297,margin=17,contentW=176,lowerLimit=273;
    let y=0;
    const name=agentName(agent),date=frDate(incident?.date);
    function nextPage(){
      pdf.addPage();
      pdf.setDrawColor(212,225,218);
      pdf.setFont("helvetica","bold");
      pdf.setTextColor(6,78,59);
      pdf.setFontSize(9);
      pdf.text("INOVTEC  |  SUIVI DES INCIDENTS",margin,17);
      pdf.line(margin,21,pageW-margin,21);
      y=31;
    }
    function ensure(height){
      if(y+height>lowerLimit)nextPage();
    }
    function section(label){
      ensure(15);
      y+=3;
      pdf.setTextColor(6,78,59);
      pdf.setFont("helvetica","bold");
      pdf.setFontSize(10);
      pdf.text(label.toUpperCase(),margin,y);
      y+=3;
      pdf.setDrawColor(206,224,213);
      pdf.line(margin,y,pageW-margin,y);
      y+=7;
    }
    function paragraph(value,{empty="Non renseigné",lineHeight=5.4}={}){
      const txt=clean(value)||empty;
      pdf.setFont("helvetica","normal");
      pdf.setFontSize(10);
      pdf.setTextColor(25,39,52);
      const lines=pdf.splitTextToSize(txt,contentW);
      for(const part of lines){
        ensure(lineHeight+2);
        pdf.text(part,margin,y);
        y+=lineHeight;
      }
      y+=4;
    }
    function field(label,value){
      ensure(15);
      pdf.setFont("helvetica","bold");
      pdf.setFontSize(9);
      pdf.setTextColor(95,108,117);
      pdf.text(label,margin,y);
      y+=6;
      paragraph(value);
    }
    function blankArea(label){
      section(label);
      ensure(22);
      pdf.setDrawColor(214,223,227);
      for(let j=0;j<3;j++){
        pdf.line(margin,y+5,pageW-margin,y+5);
        y+=7;
      }
      y+=4;
    }
    pdf.setFillColor(6,78,59);
    pdf.rect(0,0,pageW,45,"F");
    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(10);
    pdf.text("INOVTEC  |  DOCUMENT INTERNE",margin,14);
    pdf.setFontSize(17);
    // Le nom de l'agent est le titre de la fiche ; adapter la taille aux noms longs.
    const titleWidth=pdf.getTextWidth(name);
    if(titleWidth>contentW)pdf.setFontSize(Math.max(10,17*contentW/titleWidth));
    pdf.text(name,margin,27);
    y=56;
    section("Identification");
    field("Agent concerné",name);
    field("Date des faits",date);
    field("Catégorie",incident?.categorie);
    field("Gravité",incident?.gravite||"Modérée");
    section("Faits consignés");
    field("Objet",incident?.titre||"Incident");
    field("Description / suite consignée",incident?.description);

    const photos=Array.isArray(incident?.photos)?incident.photos:[];
    if(photos.length){
      section("Pièces photographiques ("+photos.length+")");
      for(let i=0;i<photos.length;i++){
        const photo=photos[i]||{};
        ensure(15);
        pdf.setFont("helvetica","bold");
        pdf.setFontSize(9);
        pdf.setTextColor(53,68,79);
        const caption=pdf.splitTextToSize("Photo "+(i+1)+" - "+(clean(photo.name)||"Sans nom"),contentW);
        for(const row of caption){
          ensure(6);
          pdf.text(row,margin,y);
          y+=5;
        }
        y+=2;
        try{
          const img=await dataUrlToJpeg(w,photo.dataUrl);
          let pw=contentW,ph=pw*img.height/img.width;
          if(ph>170){ph=170;pw=ph*img.width/img.height}
          ensure(ph+10);
          pdf.addImage(img.data,"JPEG",margin,y,pw,ph,undefined,"FAST");
          y+=ph+10;
        }catch(error){
          ensure(12);
          pdf.setFont("helvetica","italic");
          pdf.setFontSize(9);
          pdf.setTextColor(130,71,71);
          pdf.text("Photographie non disponible dans le PDF",margin,y);
          y+=11;
        }
      }
    }
    blankArea("Observations complémentaires (à compléter)");
    const pages=pdf.getNumberOfPages();
    for(let p=1;p<=pages;p++){
      pdf.setPage(p);
      pdf.setDrawColor(208,220,214);
      pdf.line(margin,284,pageW-margin,284);
      pdf.setTextColor(91,102,111);
      pdf.setFont("helvetica","normal");
      pdf.setFontSize(7.5);
      pdf.text("Document de suivi - ne constitue pas un avertissement disciplinaire.",margin,289);
      pdf.text("Page "+p+"/"+pages,pageW-margin,289,{align:"right"});
      pdf.text("Édité le "+new Date().toLocaleString("fr-FR"),margin,294);
    }
    const filename="Incident_"+safeFile(name)+"_"+safeFile(incident?.date)+"_"+safeFile(incident?.titre||"incident")+".pdf";
    if(action==="print"&&printWindow&&!printWindow.closed){
      const blob=pdf.output("blob");
      printWindow.location.replace(w.URL.createObjectURL(blob));
    }else{
      pdf.save(filename);
      if(action==="print")w.alert("L'onglet d'impression a été bloqué. Le PDF a été téléchargé : ouvre-le pour l'imprimer.");
    }
  }catch(err){
    console.error("PDF incident",err);
    try{if(printWindow&&!printWindow.closed)printWindow.close()}catch(e){}
    w.alert("Impossible de générer la fiche PDF. Vérifie la connexion et réessaie.");
  }
}

function installButtons(w,d){
  const agent=w.getSelectedAgent?.();
  if(!agent||!Array.isArray(agent.incidents))return;
  d.querySelectorAll("[data-inc-edit]").forEach(edit=>{
    const id=edit.getAttribute("data-inc-edit");
    if(!id)return;
    const parent=edit.parentElement;
    if(!parent)return;
    const current=agent.incidents.find(item=>String(item?.id)===String(id));
    if(!current)return;
    for(const spec of [
      {action:"download",label:"Télécharger PDF",title:"Télécharger la fiche de cet incident en PDF"},
      {action:"print",label:"Imprimer",title:"Ouvrir la fiche PDF de cet incident pour l'imprimer"}
    ]){
      if(Array.from(parent.querySelectorAll("[data-inc-pdf]")).some(btn=>btn.getAttribute("data-inc-pdf")===id&&btn.getAttribute("data-inc-pdf-action")===spec.action))continue;
      const btn=d.createElement("button");
      btn.type="button";
      btn.className="tiny green ivIncidentPdfBtn";
      btn.setAttribute("data-inc-pdf",id);
      btn.setAttribute("data-inc-pdf-action",spec.action);
      btn.textContent=spec.label;
      btn.title=spec.title;
      btn.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        const selected=w.getSelectedAgent?.();
        const item=selected?.incidents?.find(row=>String(row?.id)===String(id));
        if(!item){w.alert("Cet incident n'est plus disponible.");return}
        let printWindow=null;
        if(spec.action==="print"){
          // Ouvrir pendant le clic, avant les opérations asynchrones, évite le bloqueur de fenêtres.
          printWindow=w.open("","_blank");
          if(printWindow){
            printWindow.document.title="Préparation de la fiche incident";
            printWindow.document.body.textContent="Préparation du PDF à imprimer…";
          }
        }
        generateIncidentPdf(w,d,selected,item,spec.action,printWindow);
      });
      edit.insertAdjacentElement("beforebegin",btn);
    }
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
