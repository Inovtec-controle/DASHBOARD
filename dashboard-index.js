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

function weatherSvg(kind){
  const common='viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const map={
    sun:`<svg ${common}><circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>`,
    moon:`<svg ${common}><path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a7.6 7.6 0 1 0 11.2 11.2Z"/></svg>`,
    cloud:`<svg ${common}><path d="M6.8 18.3h10a4 4 0 0 0 .7-7.9A5.8 5.8 0 0 0 6.4 8.8a4.8 4.8 0 0 0 .4 9.5Z"/></svg>`,
    partly:`<svg ${common}><path d="M7 6.5V4.8M3.8 9.7H2.2M4.7 7.4 3.5 6.2"/><path d="M11.7 7.2A4 4 0 0 0 5.2 11"/><circle cx="7" cy="10" r="3"/><path d="M8 18.3h9a3.6 3.6 0 0 0 .6-7.1 5.1 5.1 0 0 0-9.7 1.7A3.4 3.4 0 0 0 8 18.3Z"/></svg>`,
    rain:`<svg ${common}><path d="M6.7 15.6h10a3.8 3.8 0 0 0 .7-7.5 5.5 5.5 0 0 0-10.5 1.7 4.2 4.2 0 0 0-.2 5.8Z"/><path d="m8 18.2-.7 2M12 18.2l-.7 2M16 18.2l-.7 2"/></svg>`,
    fog:`<svg ${common}><path d="M6.7 13.2h10a3.7 3.7 0 0 0 .7-7.3A5.5 5.5 0 0 0 6.8 7.5a4.1 4.1 0 0 0-.1 5.7Z"/><path d="M4.5 16.5h15M6.5 20h11"/></svg>`,
    snow:`<svg ${common}><path d="M6.7 14.5h10a3.8 3.8 0 0 0 .7-7.5A5.5 5.5 0 0 0 6.8 8.6a4.1 4.1 0 0 0-.1 5.9Z"/><path d="M8 18v3M6.7 19.5h2.6M12 18v3M10.7 19.5h2.6M16 18v3M14.7 19.5h2.6"/></svg>`,
    storm:`<svg ${common}><path d="M6.7 14.2h10a3.8 3.8 0 0 0 .7-7.5A5.5 5.5 0 0 0 6.8 8.3a4.1 4.1 0 0 0-.1 5.9Z"/><path d="m12.7 15.8-2 3.2h2l-1.1 2.5 3.1-4h-2Z"/></svg>`,
    neutral:`<svg ${common}><circle cx="12" cy="12" r="8.2"/><path d="M8.5 13.5a4 4 0 0 1 7 0"/><path d="M12 7.2v1"/></svg>`
  };
  return map[kind]||map.neutral;
}
function setWeatherIcon(target,kind){
  if(!target)return;
  ["sun","moon","cloud","partly","rain","fog","snow","storm","neutral"].forEach(k=>target.classList.remove("c3-weather-"+k));
  target.classList.add("c3-weather-"+kind);
  target.innerHTML=weatherSvg(kind);
}
function weatherVisual(code,isDay){
  if(code===0)return{kind:isDay?"sun":"moon",label:"Ciel dégagé"};
  if(code===1||code===2)return{kind:"partly",label:"Partiellement nuageux"};
  if(code===3)return{kind:"cloud",label:"Couvert"};
  if(code===45||code===48)return{kind:"fog",label:"Brouillard"};
  if(code>=51&&code<=67)return{kind:"rain",label:code<=57?"Bruine":"Pluie"};
  if(code>=71&&code<=77)return{kind:"snow",label:"Neige"};
  if(code>=80&&code<=82)return{kind:"rain",label:"Averses"};
  if(code>=85&&code<=86)return{kind:"snow",label:"Averses de neige"};
  if(code>=95)return{kind:"storm",label:"Orage"};
  return{kind:"neutral",label:"Météo locale"};
}

async function loadWeatherAt(lat,lon){
  const icon=$("weatherIcon"),heroIcon=$("heroWeatherIcon");
  if(!icon)return;
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res=await fetch(url,{cache:"no-store"});
    if(!res.ok)throw new Error("weather");
    const data=await res.json(),current=data.current||{},v=weatherVisual(Number(current.weather_code),Number(current.is_day)===1);
    setWeatherIcon(icon,v.kind);
    setWeatherIcon(heroIcon,v.kind);
    const tempValue=Number(current.temperature_2m);
    const temp=Number.isFinite(tempValue)?` · ${Math.round(tempValue)}°C`:"";
    icon.title=v.label+temp;
    icon.setAttribute("aria-label",v.label+temp);
    if($("heroWeatherText"))$("heroWeatherText").textContent=Number.isFinite(tempValue)?`${Math.round(tempValue)}°C · ${v.label}`:v.label;
  }catch(err){
    setWeatherIcon(icon,"neutral");
    setWeatherIcon(heroIcon,"neutral");
    icon.title="Météo momentanément indisponible";
    if($("heroWeatherText"))$("heroWeatherText").textContent="Indisponible";
  }
}

function initWeather(){
  const icon=$("weatherIcon"),heroIcon=$("heroWeatherIcon");
  if(!icon)return;
  setWeatherIcon(icon,"neutral");
  setWeatherIcon(heroIcon,"neutral");
  if(!navigator.geolocation){
    icon.title="Localisation non disponible";
    if($("heroWeatherText"))$("heroWeatherText").textContent="Localisation indisponible";
    return;
  }
  icon.title="Localisation en cours…";
  navigator.geolocation.getCurrentPosition(
    pos=>loadWeatherAt(pos.coords.latitude,pos.coords.longitude),
    ()=>{setWeatherIcon(icon,"neutral");setWeatherIcon(heroIcon,"neutral");icon.title="Autorisez la localisation pour afficher la météo locale";if($("heroWeatherText"))$("heroWeatherText").textContent="Localisation non autorisée";},
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
        if($("heroSyncIcon"))$("heroSyncIcon").classList.add("online");
        if($("accountName"))$("accountName").textContent=name;
        if($("heroUserName"))$("heroUserName").textContent=name;
        if($("heroSyncText"))$("heroSyncText").textContent="Synchronisé";
        if($("accountStatus"))$("accountStatus").textContent="Connecté";
        if($("avatar"))$("avatar").textContent=initials(name);
        loadBaseMetrics();
      }else{
        if($("cloudDot"))$("cloudDot").classList.remove("online");
        if($("heroSyncIcon"))$("heroSyncIcon").classList.remove("online");
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
  const src=document.getElementById("sharedStatus"),dst=document.getElementById("heroSyncText");
  if(!src||!dst)return;
  const sync=()=>{const t=String(src.textContent||"").trim();if(t)dst.textContent=t};
  new MutationObserver(sync).observe(src,{childList:true,subtree:true,characterData:true});
  sync();
})();
