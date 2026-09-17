/* En-tête commun Inovtec : présentation uniquement, aucune écriture dans les données métier. */
(()=>{
'use strict';
if(window !== window.top || window.__INOVTEC_COMMON_HEADER_V1__)return;
window.__INOVTEC_COMMON_HEADER_V1__=true;
const DATE=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const TIME=new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'});
const STYLES=`
.iv-header-tile{box-sizing:border-box!important;position:absolute;right:22px;top:16px;bottom:auto!important;z-index:8;display:flex!important;flex-direction:column;justify-content:center;align-items:center;gap:3px;width:210px;min-width:0!important;min-height:94px;padding:11px 12px 8px;border-radius:13px;border:1px solid rgba(255,255,255,.1);background:#074735;color:#fff;text-align:center;box-shadow:0 7px 18px rgba(0,35,23,.13);font-family:Inter,system-ui,sans-serif;line-height:1.35;transform:none!important;backdrop-filter:none!important}
.iv-header-tile .iv-head-date{display:block!important;font-size:12px!important;line-height:1.4!important;font-weight:800!important;letter-spacing:0!important;color:#fff!important;white-space:normal!important;text-align:center!important;margin:0!important}
.iv-header-tile .iv-head-time{display:block!important;font-size:11px!important;line-height:1.4!important;font-weight:650!important;letter-spacing:0!important;color:#e1f7e9!important;margin:0!important}
.iv-header-tile .iv-head-mark{box-sizing:border-box;display:grid!important;place-items:center;width:37px;height:37px;min-width:37px;margin-top:2px;border-radius:50%;border:1px solid rgba(127,226,181,.3);background:#176648;box-shadow:0 0 0 5px rgba(83,185,136,.12);font-family:Inter,system-ui,sans-serif;font-size:25px!important;line-height:1!important;font-weight:400!important;color:#b8f5d1!important}
.iv-shell .iv-hero{padding-right:255px!important}
.c3-hero-banner{position:relative}
.c3-hero-banner .iv-header-tile{right:19px;top:19px}
.c3-hero-banner .c3-hero-copy{max-width:calc(100% - 225px)}
.shell .hero{position:relative;padding-right:250px;min-height:140px}
.shell .hero .iv-header-tile{right:20px;top:18px}
@media(max-width:800px){
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
function init(){
 style();
 const shell=document.querySelector('.iv-shell .iv-hero');
 const home=document.querySelector('.c3-app .c3-hero-banner');
 const reassort=document.querySelector('.shell .hero');
 const hero=shell||home||reassort;
 if(!hero)return;
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
 const mark=document.createElement('span');mark.className='iv-head-mark';mark.textContent='✓';mark.setAttribute('aria-hidden','true');
 tile.replaceChildren(date,time,mark);
 tile.className='iv-header-tile';
 tile.setAttribute('role','group');tile.setAttribute('aria-label','Date et heure actuelles');
 if(!old)hero.appendChild(tile);
 tick();
}
function tick(){if(!tile?.isConnected)return;const now=new Date();const date=tile.querySelector('.iv-head-date');const time=tile.querySelector('.iv-head-time');if(date)date.textContent=DATE.format(now).replace(/^./,s=>s.toUpperCase());if(time)time.textContent=TIME.format(now)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
setInterval(()=>{if(!document.hidden)tick()},30000);
})();
