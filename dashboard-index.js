(()=>{
"use strict";
const $=id=>document.getElementById(id);
const fmtDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const fmtHeroDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"});
const fmtTime=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"});
function titleCase(value){return String(value||"").split(/[._\-\s]+/).filter(Boolean).map(x=>x.charAt(0).toLocaleUpperCase("fr")+x.slice(1)).join(" ")}
function connectedName(user){
  const display=String(user?.displayName||"").trim();
  if(display)return display;
  const local=String(user?.email||"").split("@")[0]||"";
  return titleCase(local)||"Inovtec";
}
function initials(value){
  const parts=String(value||"IN").trim().split(/\s+/).filter(Boolean);
  return (parts.length>1?(parts[0][0]+parts[parts.length-1][0]):String(parts[0]||"IN").slice(0,2)).toUpperCase();
}

function refreshClock(){
  const d=new Date();
  if($("dateLabel"))$("dateLabel").textContent=fmtDate.format(d).replace(/^./,c=>c.toUpperCase());
  if($("heroDateLabel"))$("heroDateLabel").textContent=fmtHeroDate.format(d).replace(/^./,c=>c.toUpperCase());
  if($("timeLabel"))$("timeLabel").textContent=fmtTime.format(d);
}
refreshClock();
setInterval(refreshClock,30000);

if($("printBtn"))$("printBtn").addEventListener("click",()=>window.print());

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
  if(!icon)return;
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res=await fetch(url,{cache:"no-store"});
    if(!res.ok)throw new Error("weather");
    const data=await res.json(),c=data.current||{},v=weatherVisual(Number(c.weather_code),Number(c.is_day)===1);
    icon.textContent=v.icon;
    const tempValue=Number(c.temperature_2m);
    const temp=Number.isFinite(tempValue)?` · ${Math.round(tempValue)}°C`:"";
    icon.title=v.label+temp;
    icon.setAttribute("aria-label",v.label+temp);
    if($("heroWeatherIcon"))$("heroWeatherIcon").textContent=v.icon;
    if($("heroWeatherText"))$("heroWeatherText").textContent=Number.isFinite(tempValue)?`${Math.round(tempValue)}°C · ${v.label}`:v.label;
  }catch(err){
    icon.textContent="🌡️";
    icon.title="Météo momentanément indisponible";
    if($("heroWeatherIcon"))$("heroWeatherIcon").textContent="◌";
    if($("heroWeatherText"))$("heroWeatherText").textContent="Indisponible";
  }
}

function initWeather(){
  const icon=$("weatherIcon");
  if(!icon)return;
  if(!navigator.geolocation){
    icon.textContent="🌡️";
    icon.title="Localisation non disponible";
    if($("heroWeatherText"))$("heroWeatherText").textContent="Localisation indisponible";
    return;
  }
  icon.title="Localisation en cours…";
  navigator.geolocation.getCurrentPosition(
    pos=>loadWeatherAt(pos.coords.latitude,pos.coords.longitude),
    ()=>{icon.textContent="🌡️";icon.title="Autorisez la localisation pour afficher la météo locale";if($("heroWeatherText"))$("heroWeatherText").textContent="Localisation non autorisée";},
    {enableHighAccuracy:false,timeout:8000,maximumAge:1800000}
  );
}
initWeather();

async function loadBaseMetrics(){
  try{
    const db=firebase.firestore();
    const snap=await db.collection("chantiers").orderBy("nom").get();
    const sites=snap.docs.map(d=>d.data()||{}).filter(x=>x._hidden!==true);
    if($("kpiSites"))$("kpiSites").textContent=String(sites.length);
    if($("kpiSitesSub"))$("kpiSitesSub").textContent="Synchronisé";
    const names=new Set(
      sites.map(x=>String(x.agentNom||"").trim()).filter(Boolean).map(x=>x.toLocaleLowerCase("fr"))
    );
    if($("kpiAgents")&&$("kpiAgents").textContent.trim()==="—")$("kpiAgents").textContent=String(names.size);
  }catch(err){
    console.warn("Indicateurs chantiers",err);
    if($("kpiSitesSub"))$("kpiSitesSub").textContent="Synchronisation en cours";
  }
}

if(window.firebase&&window.INOVTEC_FIREBASE_CONFIG){
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
    const auth=firebase.auth();
    auth.onAuthStateChanged(user=>{
      if(user){
        const name=connectedName(user);
        if($("cloudDot"))$("cloudDot").classList.add("online");
        if($("accountName"))$("accountName").textContent=name;
        if($("heroUserName"))$("heroUserName").textContent=name;
        if($("heroSyncText"))$("heroSyncText").textContent="Synchronisé";
        if($("accountStatus"))$("accountStatus").textContent="Connecté";
        if($("avatar"))$("avatar").textContent=initials(name);
        loadBaseMetrics();
      }else{
        if($("cloudDot"))$("cloudDot").classList.remove("online");
        if($("heroUserName"))$("heroUserName").textContent="Inovtec";
        if($("heroSyncText"))$("heroSyncText").textContent="Non connecté";
        if($("accountStatus"))$("accountStatus").textContent="Non connecté";
      }
    });
  }catch(err){
    console.warn("Initialisation Dashboard",err);
  }
}
})();
/* Synchronisation du texte du bandeau avec l’état partagé du Dashboard. */
(()=>{
  const src=$("sharedStatus"),dst=$("heroSyncText");
  if(!src||!dst)return;
  const sync=()=>{const t=String(src.textContent||"").trim();if(t)dst.textContent=t};
  new MutationObserver(sync).observe(src,{childList:true,subtree:true,characterData:true});
  sync();
})();
