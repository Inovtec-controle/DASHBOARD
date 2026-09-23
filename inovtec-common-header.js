/* En-tête commun Inovtec : présentation uniquement, aucune écriture dans les données métier. */
(()=>{
'use strict';
if(window !== window.top || window.__INOVTEC_COMMON_HEADER_V1__)return;
window.__INOVTEC_COMMON_HEADER_V1__=true;
const DATE=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const TIME=new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'});
const STYLES=`
/* Le fond de Planning des équipes est la référence unique de tous les en-têtes. */
.iv-shell .iv-hero,.c3-app .c3-hero-banner,.shell .hero{background:linear-gradient(110deg,#064e3b 0%,#056647 53%,#0c7a57 100%)!important;color:#fff!important;box-shadow:0 12px 28px rgba(4,78,59,.18)!important;border-color:rgba(255,255,255,.12)!important}
.c3-app .c3-hero-banner .c3-hero-copy h1,.c3-app .c3-hero-banner .c3-hero-copy h1 span{color:#fff!important}
.c3-app .c3-hero-banner .c3-hero-copy p{color:#e5f8ef!important}
.c3-app .c3-hero-banner .c3-hero-kicker{color:#a7f3d0!important;background:rgba(3,63,50,.35)!important;border-color:rgba(167,243,208,.25)!important}
.c3-app .c3-hero-banner .c3-hero-art{display:none!important}
.c3-app .c3-hero-banner .c3-hero-copy{position:relative;z-index:4}
.shell .hero>div:first-child,.shell .hero>a{position:relative;z-index:4}
/* Reprise des mêmes ornements que .iv-geometry dans inovtec-shell.css. */
.iv-shared-backdrop{position:absolute;inset:0 0 0 43%;z-index:1;overflow:hidden;opacity:.96;pointer-events:none}
.iv-shared-backdrop .iv-circle{position:absolute;border:1px solid rgba(167,243,208,.42);border-radius:50%}
.iv-shared-backdrop .iv-circle.a{width:180px;height:180px;left:17%;top:10px}
.iv-shared-backdrop .iv-circle.b{width:260px;height:260px;right:-60px;bottom:-180px}
.iv-shared-backdrop .iv-rect{position:absolute;border:1px solid rgba(255,255,255,.17);background:linear-gradient(135deg,rgba(110,231,183,.24),rgba(255,255,255,.03))}
.iv-shared-backdrop .iv-rect.a{width:110px;height:126px;left:45%;top:35px}
.iv-shared-backdrop .iv-rect.b{width:145px;height:85px;left:62%;top:75px}
.iv-shared-backdrop .iv-dots{position:absolute;width:135px;height:85px;left:6%;top:40px;background-image:radial-gradient(rgba(167,243,208,.55) 1px,transparent 1px);background-size:10px 10px}
.iv-shared-backdrop .iv-diag{position:absolute;height:1px;width:90%;background:rgba(255,255,255,.2);transform:rotate(-42deg);transform-origin:left}
.iv-shared-backdrop .iv-diag.one{left:5%;top:95%}.iv-shared-backdrop .iv-diag.two{left:27%;top:75%}.iv-shared-backdrop .iv-diag.three{left:48%;top:56%}
.iv-header-tile{box-sizing:border-box!important;position:absolute;right:22px;top:16px;bottom:auto!important;z-index:8;display:flex!important;flex-direction:column;justify-content:center;align-items:center;gap:3px;width:210px;min-width:0!important;min-height:94px;padding:11px 12px 8px;border-radius:13px;border:1px solid rgba(255,255,255,.1);background:#074735;color:#fff;text-align:center;box-shadow:0 7px 18px rgba(0,35,23,.13);font-family:Inter,system-ui,sans-serif;line-height:1.35;transform:none!important;backdrop-filter:none!important}
.iv-header-tile .iv-head-date{display:block!important;font-size:12px!important;line-height:1.4!important;font-weight:800!important;letter-spacing:0!important;color:#fff!important;white-space:normal!important;text-align:center!important;margin:0!important}
.iv-header-tile .iv-head-time{display:block!important;font-size:11px!important;line-height:1.4!important;font-weight:650!important;letter-spacing:0!important;color:#e1f7e9!important;margin:0!important}
.iv-header-tile .iv-head-mark{box-sizing:border-box;display:grid!important;place-items:center;width:37px;height:37px;min-width:37px;margin-top:2px;border-radius:50%;border:1px solid rgba(127,226,181,.3);background:#176648;box-shadow:0 0 0 5px rgba(83,185,136,.12);font-family:Inter,system-ui,sans-serif;font-size:25px!important;line-height:1!important;font-weight:400!important;color:#b8f5d1!important}
.iv-header-tile .iv-head-mark[data-state="loading"]{position:relative;color:transparent!important;background:rgba(255,255,255,.10)!important;border-color:rgba(255,255,255,.28)!important;box-shadow:0 0 0 5px rgba(255,255,255,.07)!important}
.iv-header-tile .iv-head-mark[data-state="loading"]::before{content:"";box-sizing:border-box;width:21px;height:21px;border-radius:50%;border:3px solid rgba(167,243,208,.28);border-top-color:#a7f3d0;border-right-color:#34d399;animation:ivHeaderSyncSpin .82s linear infinite}
.iv-header-tile .iv-head-mark[data-state="connected"]{background:#176648!important;border-color:rgba(127,226,181,.42)!important;box-shadow:0 0 0 5px rgba(83,185,136,.15)!important;color:#b8f5d1!important}
.iv-header-tile .iv-head-mark[data-state="error"]{background:rgba(153,27,27,.72)!important;border-color:rgba(254,202,202,.55)!important;box-shadow:0 0 0 5px rgba(239,68,68,.11)!important;color:#fecaca!important}
@keyframes ivHeaderSyncSpin{to{transform:rotate(360deg)}}
.iv-shell .iv-hero{padding-right:255px!important}
.c3-hero-banner{position:relative}
.c3-hero-banner .iv-header-tile{right:19px;top:19px}
.c3-hero-banner .c3-hero-copy{max-width:calc(100% - 225px)}
.shell .hero{position:relative;padding-right:250px;min-height:140px}
.shell .hero .iv-header-tile{right:20px;top:18px}
@media(max-width:800px){
 .iv-shared-backdrop{inset:0 0 0 24%}
 .iv-shell .iv-hero{padding-right:18px!important;min-height:142px;display:flex;flex-direction:column;align-items:stretch;gap:12px}
 .iv-shell .iv-hero .iv-header-tile{position:relative;right:auto;top:auto;align-self:flex-end;width:168px;min-height:77px;padding:7px 9px 6px;margin:0;flex:0 0 auto}
 .c3-hero-banner{display:flex;flex-direction:column;gap:13px}
 .c3-hero-banner .c3-hero-copy{max-width:100%}
 .c3-hero-banner .iv-header-tile{position:relative;right:auto;top:auto;align-self:flex-end;width:168px;min-height:77px;padding:7px 9px 6px}
 .shell .hero{padding-right:21px;display:flex;flex-direction:column;align-items:stretch;gap:13px}
 .shell .hero .iv-header-tile{position:relative;right:auto;top:auto;align-self:flex-end;width:168px;min-height:77px;padding:7px 9px 6px}
 .iv-header-tile .iv-head-date{font-size:10px!important}.iv-header-tile .iv-head-time{font-size:10px!important}.iv-header-tile .iv-head-mark{width:29px;height:29px;min-width:29px;font-size:20px!important}
}
@media print{.iv-header-tile{box-shadow:none!important}}
`;
function style(){if(document.getElementById('ivCommonHeaderStyle'))return;const s=document.createElement('style');s.id='ivCommonHeaderStyle';s.textContent=STYLES;(document.head||document.documentElement).appendChild(s)}
let tile=null;
function matchingBackdrop(hero){
 if(hero.querySelector('.iv-shared-backdrop'))return;
 const backdrop=document.createElement('div');backdrop.className='iv-shared-backdrop';backdrop.setAttribute('aria-hidden','true');
 ['iv-dots','iv-circle a','iv-circle b','iv-rect a','iv-rect b','iv-diag one','iv-diag two','iv-diag three'].forEach(classes=>{const shape=document.createElement('span');shape.className=classes;backdrop.appendChild(shape)});
 hero.appendChild(backdrop);
}
function init(){
 style();
 const shell=document.querySelector('.iv-shell .iv-hero');
 const home=document.querySelector('.c3-app .c3-hero-banner');
 const reassort=document.querySelector('.shell .hero');
 const hero=shell||home||reassort;
 if(!hero)return;
 if(home||reassort)matchingBackdrop(hero);
 const existing=hero.querySelector('.iv-header-tile');
 if(existing){tile=existing;tick();return;}
 const old=shell?.querySelector('.iv-date');
 tile=old||document.createElement('div');
 // Préserver les identifiants déjà utilisés par l'horloge des pages encadrées.
 let date=old?.querySelector('#dateLabel');
 let time=old?.querySelector('#timeLabel');
 if(!date){date=document.createElement('strong');date.className='iv-head-date'}
 else date.classList.add('iv-head-date');
 if(!time){time=document.createElement('span');time.className='iv-head-time'}
 else time.classList.add('iv-head-time');
 const mark=document.createElement('span');mark.className='iv-head-mark';mark.textContent='';mark.dataset.state='loading';mark.setAttribute('role','status');mark.setAttribute('aria-live','polite');mark.setAttribute('aria-label','Vérification de la synchronisation et de l’affichage');mark.title='Vérification de la synchronisation et de l’affichage';
 tile.replaceChildren(date,time,mark);
 tile.className='iv-header-tile';
 tile.setAttribute('role','group');tile.setAttribute('aria-label','Date et heure actuelles');
 if(!old)hero.appendChild(tile);
 tick();
}
function tick(){if(!tile?.isConnected)return;const now=new Date();const date=tile.querySelector('.iv-head-date');const time=tile.querySelector('.iv-head-time');if(date)date.textContent=DATE.format(now).replace(/^./,s=>s.toUpperCase());if(time)time.textContent=TIME.format(now)}
let syncReadyAfter=Date.now()+650,lastLocalState='',syncTimer=null;
function inferSync(text){
 const raw=String(text||'').trim(),t=raw.toLowerCase();if(!t)return null;
 if(/erreur|impossible|indisponible|hors[ -]?ligne|échec|echec|déconnect|deconnect|non connecté|non connecte|permission|refus/.test(t))return{state:'error',message:raw};
 if(/connexion|chargement|synchronisation en cours|synchronisation…|synchronisation\.\.\.|sauvegarde en cours|envoi en cours|patiente/.test(t)&&!/connecté|connecte|synchronisé|synchronise/.test(t))return{state:'loading',message:raw};
 if(/synchronisé|synchronise|connecté|connecte|en ligne|firebase.*(?:ok|actif)|données synchronisées|donnees synchronisees|inventaire synchronisé|inventaire synchronise/.test(t))return{state:'connected',message:raw};
 return null;
}
function visible(el){
 if(!el)return false;
 try{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)!==0}catch{return true}
}
function docsForSync(){
 const docs=[document],seen=new Set([document]);
 const visit=doc=>{
  let frames=[];try{frames=[...doc.querySelectorAll('iframe')]}catch{}
  frames.forEach(frame=>{try{const d=frame.contentDocument;if(d&&d.documentElement&&!seen.has(d)){seen.add(d);docs.push(d);visit(d)}}catch{}});
 };
 visit(document);return docs;
}
function localSyncState(){
 const selectors=['#syncStatus','#sharedStatus','#syncMirror','#liveMirror','#heroSyncText','#ivKontrolCloudState','.status.ok','.status.warning','.status.error'];
 let connected=null;
 for(const d of docsForSync()){
  for(const sel of selectors){
   let els=[];try{els=[...d.querySelectorAll(sel)]}catch{}
   for(const el of els){if(!visible(el))continue;const r=inferSync(el.textContent);if(!r)continue;if(r.state==='error')return r;if(r.state==='loading')return r;if(r.state==='connected')connected=r}
  }
 }
 return connected;
}
function frameDisplayReady(){
 const topLoading=document.getElementById('loading');
 if(topLoading&&visible(topLoading)&&!topLoading.classList.contains('hidden'))return{ok:false,message:'Affichage de la page en cours'};
 const frames=[...document.querySelectorAll('iframe')];
 for(const frame of frames){
  try{
   const d=frame.contentDocument;
   if(!d||d.readyState!=='complete'||!d.body||!String(d.body.textContent||'').trim())return{ok:false,message:'Affichage de la page en cours'};
   const nested=[...d.querySelectorAll('iframe')];
   for(const sub of nested){const sd=sub.contentDocument;if(!sd||sd.readyState!=='complete'||!sd.body||!String(sd.body.textContent||'').trim())return{ok:false,message:'Affichage de la page en cours'}}
  }catch{return{ok:false,message:'Affichage de la page non vérifiable'}}
 }
 return{ok:true,message:'Affichage de la page vérifié'};
}
function setMarkState(state,message){
 const m=tile?.querySelector('.iv-head-mark');if(!m)return;
 m.dataset.state=state;m.textContent=state==='connected'?'✓':state==='error'?'×':'';
 m.setAttribute('aria-label',message);m.title=message;
 window.InovtecHeaderSyncState={state,message,checkedAt:new Date().toISOString()};
}
function evaluateSyncMark(){
 if(!tile?.isConnected)return;
 if(!navigator.onLine){setMarkState('error','Pas de connexion réseau');return}
 const local=localSyncState();
 if(local?.state!==lastLocalState){lastLocalState=local?.state||'';if(local?.state==='connected')syncReadyAfter=Date.now()+900}
 if(local?.state==='error'){setMarkState('error',local.message);return}
 if(local?.state==='loading'){setMarkState('loading',local.message);return}
 const health=window.InovtecFirebaseOperational;
 if(health?.ok===false){setMarkState('error','Firebase inaccessible : '+String(health.error||'lecture refusée'));return}
 let authKnown=false,signedIn=false;
 try{if(window.firebase?.auth){authKnown=true;signedIn=!!firebase.auth().currentUser}}catch{}
 const firebaseConfirmed=health?.ok===true||local?.state==='connected';
 if(authKnown&&!signedIn&&!firebaseConfirmed){setMarkState('loading','Connexion au compte Firebase en cours');return}
 if(!firebaseConfirmed){setMarkState('loading','Synchronisation Firebase non encore confirmée');return}
 const display=frameDisplayReady();
 if(!display.ok){setMarkState('loading',display.message);return}
 if(Date.now()<syncReadyAfter){setMarkState('loading','Vérification de l’affichage après synchronisation');return}
 setMarkState('connected','Firebase synchronisé · affichage de la page vérifié');
}
function bindSyncChecks(){
 const arm=()=>{syncReadyAfter=Date.now()+550;setMarkState('loading','Vérification de la synchronisation et de l’affichage');setTimeout(evaluateSyncMark,80)};
 document.querySelectorAll('iframe').forEach(f=>f.addEventListener('load',arm));
 window.addEventListener('inovtec:firebase-operational',evaluateSyncMark);
 window.addEventListener('inovtec:firebase-status',evaluateSyncMark);
 window.addEventListener('online',arm);window.addEventListener('offline',evaluateSyncMark);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)evaluateSyncMark()});
 clearInterval(syncTimer);syncTimer=setInterval(()=>{if(!document.hidden)evaluateSyncMark()},700);
 evaluateSyncMark();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();bindSyncChecks()},{once:true});else{init();bindSyncChecks()}
setInterval(()=>{if(!document.hidden)tick()},30000);
})();
