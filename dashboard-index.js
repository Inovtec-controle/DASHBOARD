(()=>{
"use strict";
const $=id=>document.getElementById(id);
const fmtDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const fmtTime=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function refreshClock(){const d=new Date();$("dateLabel").textContent=fmtDate.format(d).replace(/^./,c=>c.toUpperCase());$("timeLabel").textContent=fmtTime.format(d);}
refreshClock();setInterval(refreshClock,30000);
$("printBtn").addEventListener("click",()=>window.print());
function weatherVisual(code,isDay){
  if(code===0)return{icon:isDay?"☀️":"🌙",label:"Ciel dégagé"};
  if(code===1||code===2)return{icon:isDay?"🌤️":"☁️",label:"Partiellement nuageux"};
  if(code===3)return{icon:"☁️",label:"Couvert"};
  if(code===45||code===48)return{icon:"🌫️",label:"Brouillard"};
  if(code>=51&&code<=57)return{icon:"🌦️",label:"Bruine"};
  if(code>=61&&code<=67)return{icon:"🌧️",label:"Pluie"};
  if(code>=71&&code<=77)return{icon:"🌨️",label:"Neige"};
  if(code>=80&&code<=82)return{icon:"🌦️",label:"Averses"};
  if(code>=85&&code<=86)return{icon:"🌨️",label:"Averses de neige"};
  if(code>=95)return{icon:"⛈️",label:"Orage"};
  return{icon:"🌡️",label:"Météo locale"};
}
async function loadWeatherAt(lat,lon){
  const icon=$("weatherIcon");
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res=await fetch(url,{cache:"no-store"});if(!res.ok)throw new Error("weather");
    const data=await res.json(),c=data.current||{},v=weatherVisual(Number(c.weather_code),Number(c.is_day)===1);
    icon.textContent=v.icon;const temp=Number.isFinite(Number(c.temperature_2m))?` · ${Math.round(Number(c.temperature_2m))}°C`:"";icon.title=v.label+temp;icon.setAttribute("aria-label",v.label+temp);
  }catch(err){icon.textContent="🌡️";icon.title="Météo momentanément indisponible";}
}
function initWeather(){
  const icon=$("weatherIcon");if(!icon)return;
  if(!navigator.geolocation){icon.textContent="🌡️";icon.title="Localisation non disponible";return;}
  icon.title="Localisation en cours…";
  navigator.geolocation.getCurrentPosition(pos=>loadWeatherAt(pos.coords.latitude,pos.coords.longitude),()=>{icon.textContent="🌡️";icon.title="Autorisez la localisation pour afficher la météo locale";},{enableHighAccuracy:false,timeout:8000,maximumAge:1800000});
}
initWeather();
function normalizeDiscipline(data){if(Array.isArray(data?.recordsV9))return data.recordsV9;if(Array.isArray(data?.recordsV8))return data.recordsV8;if(Array.isArray(data?.recordsV7))return data.recordsV7;if(Array.isArray(data?.records))return data.records;return [];}
async function loadMetrics(user){
  try{
    const db=firebase.firestore();
    const snap=await db.collection("chantiers").orderBy("nom").get();
    const sites=snap.docs.map(d=>d.data()||{}).filter(x=>x._hidden!==true);
    $("kpiSites").textContent=String(sites.length);
    const agents=new Set(sites.map(x=>String(x.agentNom||"").trim()).filter(Boolean).map(x=>x.toLocaleLowerCase("fr")));
    $("kpiAgents").textContent=String(agents.size);
    $("kpiSitesSub").textContent="Synchronisé";$("kpiAgentsSub").textContent="Synchronisé";
  }catch(err){console.warn("Indicateurs chantiers",err);$("kpiSitesSub").textContent="Indisponible";$("kpiAgentsSub").textContent="Indisponible";}
  try{
    const db=firebase.firestore();
    const doc=await db.collection("discipline").doc(user.uid).get();
    const list=doc.exists?normalizeDiscipline(doc.data()||{}):[];
    const opened=list.filter(x=>String(x?.statut||"Ouvert").toLocaleLowerCase("fr")!=="clos").length;
    $("kpiDiscipline").textContent=String(opened);$("kpiDisciplineSub").textContent=opened?"À suivre":"Aucun dossier ouvert";
  }catch(err){console.warn("Indicateur Discipline",err);$("kpiDisciplineSub").textContent="Indisponible";}
  try{
    const root=firebase.storage().ref().child(`kontrol/${user.uid}/pdfs`);const result=await root.listAll();
    $("kpiKontrol").textContent=String(result.items.length);$("kpiKontrolSub").textContent="PDF archivés en ligne";
  }catch(err){console.warn("Indicateur KONTROL",err);$("kpiKontrolSub").textContent="Indisponible";}
}
if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  try{if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);const auth=firebase.auth();auth.onAuthStateChanged(user=>{if(user){$("cloudDot").classList.add("online");$("accountName").textContent=user.email?.split("@")[0]||"Compte Inovtec";$("accountStatus").textContent="Connecté";$("avatar").textContent=(user.email||"IN").slice(0,2).toUpperCase();loadMetrics(user);}else{$("cloudDot").classList.remove("online");$("accountStatus").textContent="Non connecté";}});}catch(err){console.warn(err);}
}
})();