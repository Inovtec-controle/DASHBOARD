/* Navigation et connexion communes : aucune mutation de données métier. */
(()=>{
'use strict';
if(window.__INOVTEC_UI_STABILITY_V1__)return;
window.__INOVTEC_UI_STABILITY_V1__=true;
const mode=(new URLSearchParams(location.search).get('mode')||'').toLowerCase();
const pathname=location.pathname.split('/').pop().toUpperCase();
const definitions=[
 ['Accueil','⌂','index.html','home'],
 ['Planning','▦','PLANNINGS.html','planning','PLANNINGS-LEGACY.html?v=20260917-planning-preservation1'],
 ['KONTROL','✓','KONTROL-CLOUD.html','kontrol','KONTROL-CLOUD-LEGACY.html?v=20260913-width1'],
 ['Infos chantier','ⓘ','INFOCHANTIERS-V2.html','infos','INFOCHANTIERS-V2-LEGACY.html?v=20260904-editdays1'],
 ['Classeur agents','♙','AGENTS.html','agents','AGENTS-LEGACY.html?v=20260914-incidentpdf1'],
 ['Matériel','▣','MATERIEL.html','materiel'],
 ['Réassort','↻','REASSORT.html','reassort'],
 ['Congés & absences','☂','CONGES.html','conges','CONGES-LEGACY.html?v=20260829-operational1'],
 ['Variables agents','◷','VARIABLES.html','variables','VARIABLES-DASHBOARD.html?v=20260916-1'],
 ['Organisation','◎','ORGA.html','organisation','ORGA-LEGACY.html?v=20260829-operational1'],
 ['Conversion temps','⇄','TEMPS.html','temps','TEMPS-LEGACY.html?v=20260829-operational1'],
 ['Salaire','€','SALAIRE.html','salaire','SALAIRE-LEGACY.html?v=20260829-operational1'],
 ['Dépense carburant','⛽','ESSENCE.html','essence','ESSENCE-LEGACY.html?v=20260829-operational1']
];
const route=d=>d[4]?'inovtec-page-shell.html?'+new URLSearchParams({mode:d[3],page:d[4],build:'20260917-ui-stable1'}).toString():d[2];
const active=mode||({'INDEX.HTML':'home','MATERIEL.HTML':'materiel','REASSORT.HTML':'reassort'}[pathname]||'');
function desktopLink(doc,d,kind){const a=doc.createElement('a');a.href=route(d);a.dataset.ivMenuKey=d[3];if(d[3]===active)a.classList.add('active');
 if(kind==='shell')a.innerHTML='<span class="iv-ico">'+d[1]+'</span><span>'+d[0]+'</span>';
 else if(kind==='reassort')a.innerHTML='<span>'+d[1]+'</span>'+d[0];
 else a.innerHTML='<span class="ico">'+d[1]+'</span><span>'+d[0]+'</span>';
 return a;}
function renderDesktop(nav){if(!nav||nav.dataset.ivStableMenu==='1')return;const kind=nav.matches('#desktopNav,.iv-sidebar .iv-nav')?'shell':nav.matches('.side nav')?'reassort':'home';
 const fragment=document.createDocumentFragment();definitions.forEach(d=>fragment.appendChild(desktopLink(document,d,kind)));nav.replaceChildren(fragment);nav.dataset.ivStableMenu='1';}
function renderMobile(nav){if(!nav||nav.dataset.ivStableMenu==='1')return;const items=definitions.filter(d=>['home','planning','infos','agents','variables'].includes(d[3]));const f=document.createDocumentFragment();
 items.forEach(d=>{const a=document.createElement('a');a.href=route(d);a.dataset.ivMenuKey=d[3];if(d[3]===active)a.classList.add('active');a.innerHTML='<span>'+d[1]+'</span><span>'+({'home':'Accueil','planning':'Planning','infos':'Chantiers','agents':'Agents','variables':'Variables'}[d[3]]||d[0])+'</span>';f.appendChild(a)});
 const more=document.createElement('button');more.type='button';more.className='iv-more-menu';more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');more.innerHTML='<span>☰</span><span>Menu</span>';more.addEventListener('click',()=>openDrawer(more));f.appendChild(more);nav.replaceChildren(f);nav.dataset.ivStableMenu='1';}
let drawer=null,drawerSource=null;
function closeDrawer(){if(!drawer)return;drawer.remove();drawer=null;if(drawerSource){drawerSource.setAttribute('aria-expanded','false');drawerSource.focus();drawerSource=null}}
function openDrawer(source){if(drawer){closeDrawer();return}drawerSource=source;source.setAttribute('aria-expanded','true');drawer=document.createElement('div');drawer.className='iv-unified-menu-backdrop';drawer.innerHTML='<section role="dialog" aria-modal="true" aria-label="Toutes les rubriques" class="iv-unified-menu-panel"><header><strong>Toutes les rubriques</strong><button type="button" aria-label="Fermer le menu">×</button></header><nav aria-label="Toutes les rubriques"></nav></section>';
 drawer.querySelector('button').addEventListener('click',closeDrawer);drawer.addEventListener('click',e=>{if(e.target===drawer)closeDrawer()});const nav=drawer.querySelector('nav');definitions.forEach(d=>{const a=desktopLink(document,d,'home');if(d[3]===active)a.setAttribute('aria-current','page');nav.appendChild(a)});document.body.appendChild(drawer);drawer.querySelector('button').focus();}
function ensureStyle(){if(document.getElementById('ivUnifiedUiStyle'))return;const style=document.createElement('style');style.id='ivUnifiedUiStyle';style.textContent=`.iv-more-menu{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;display:grid;gap:2px;text-align:center;align-items:center;justify-items:center;padding:4px 8px;font-size:10px}.iv-more-menu span:first-child{font-size:19px}.iv-unified-menu-backdrop{position:fixed;inset:0;z-index:12000;background:rgba(7,33,24,.54);display:flex;justify-content:flex-end}.iv-unified-menu-panel{background:#fff;color:#143f30;width:min(360px,90vw);height:100%;overflow-y:auto;box-shadow:-14px 0 36px #0002;padding:22px;font:500 14px Inter,system-ui,sans-serif}.iv-unified-menu-panel header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;font-size:17px}.iv-unified-menu-panel button{background:white;border:1px solid #dce9e2;border-radius:9px;padding:5px 11px;font-size:23px;cursor:pointer}.iv-unified-menu-panel nav{display:grid;gap:4px}.iv-unified-menu-panel nav a{display:flex;gap:13px;align-items:center;text-decoration:none;color:#204f3b;border-radius:9px;padding:11px 12px}.iv-unified-menu-panel nav a.active,.iv-unified-menu-panel nav a:hover{background:#eaf5ef}.iv-unified-menu-panel .ico{width:22px;text-align:center}.iv-session-overlay{position:fixed;inset:0;z-index:15000;background:rgba(9,30,23,.67);display:grid;place-items:center;padding:16px;font:500 14px Inter,system-ui,sans-serif}.iv-session-card{width:min(410px,100%);background:white;color:#143f30;border-radius:17px;box-shadow:0 20px 60px #0004;padding:24px}.iv-session-card h2{margin:0 0 8px;font-size:22px}.iv-session-card p{font-size:13px;color:#557064;line-height:1.5}.iv-session-card label{display:block;margin-top:12px;font-size:12px;font-weight:700}.iv-session-card input{width:100%;border:1px solid #c9dcd1;border-radius:9px;margin-top:5px;padding:12px;font:inherit}.iv-session-card button{width:100%;margin-top:17px;background:#086b47;color:white;border:0;border-radius:9px;padding:12px;font:700 14px Inter,system-ui,sans-serif;cursor:pointer}.iv-session-error{color:#a12626!important;min-height:17px}#ivCloudLogin{display:none!important}body.iv-unified-session #loginBox.login{display:none!important}@media(min-width:801px){.iv-more-menu{display:none!important}}`;(document.head||document.documentElement).appendChild(style)}
function decorate(){ensureStyle();document.querySelectorAll('#desktopNav,.c3-nav,.iv-sidebar .iv-nav,.side nav,.m1-sidebar .m1-nav,.sidebar .nav').forEach(renderDesktop);document.querySelectorAll('#mobileNav,.iv-mobile-nav,.mobile-nav').forEach(renderMobile);}
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer)closeDrawer()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
const authRequired=!!document.querySelector('.iv-shell,.c3-app,.shell')&&(!mode||!['temps','salaire','essence'].includes(mode));
if(!authRequired)return;
document.body.classList.add('iv-unified-session');
let overlay=null,auth=null,authBound=false,firebaseSdk=null;
function hide(){if(overlay){overlay.remove();overlay=null}}
function show(message='Utilise le même compte Inovtec sur ton téléphone et ton ordinateur.'){
 if(!overlay){overlay=document.createElement('div');overlay.className='iv-session-overlay';overlay.innerHTML='<form class="iv-session-card"><h2>Connexion Inovtec</h2><p id="ivSessionMessage"></p><label for="ivSessionEmail">Adresse e-mail</label><input id="ivSessionEmail" type="email" autocomplete="username" required><label for="ivSessionPassword">Mot de passe</label><input id="ivSessionPassword" type="password" autocomplete="current-password" required><button type="submit">Se connecter</button><p class="iv-session-error" role="alert" id="ivSessionError"></p></form>';
 overlay.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const dialog=overlay,error=dialog?.querySelector('#ivSessionError');if(!auth||!firebaseSdk){if(error)error.textContent='Firebase indisponible. Vérifie ta connexion réseau.';return}const button=dialog.querySelector('button');button.disabled=true;if(error)error.textContent='';try{
  try{await auth.setPersistence(firebaseSdk.auth.Auth.Persistence.LOCAL)}catch(localError){await auth.setPersistence(firebaseSdk.auth.Auth.Persistence.SESSION);if(error)error.textContent='Connexion limitée à cette session du navigateur.'}
  await auth.signInWithEmailAndPassword(dialog.querySelector('#ivSessionEmail').value.trim(),dialog.querySelector('#ivSessionPassword').value);
 }catch(ex){if(error)error.textContent=['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(ex?.code)?'Adresse e-mail ou mot de passe incorrect.':'Connexion impossible : '+String(ex?.message||'vérifie le réseau.')}finally{button.disabled=false}});
 document.body.appendChild(overlay)}
 overlay.querySelector('#ivSessionMessage').textContent=message;
}
function suppressFrameLogin(){const frame=document.getElementById('legacyFrame')||document.getElementById('materialFrame');try{const d=frame?.contentDocument;if(!d?.head)return;if(!d.getElementById('ivSuppressDuplicateLogin')){const style=d.createElement('style');style.id='ivSuppressDuplicateLogin';style.textContent='#loginBox.login{display:none!important}';d.head.appendChild(style)}}catch{}}
let retry=0;
function bootAuth(){if(authBound)return;let sdk=window.firebase;
 if(!sdk&&pathname==='MATERIEL.HTML'){try{sdk=document.getElementById('materialFrame')?.contentWindow?.firebase}catch{}}
 const config=window.INOVTEC_FIREBASE_CONFIG||(()=>{try{return document.getElementById('materialFrame')?.contentWindow?.INOVTEC_FIREBASE_CONFIG}catch{return null}})();
 if(!sdk?.auth||!config){if(++retry<40)setTimeout(bootAuth,250);else show('Firebase indisponible. Vérifie ta connexion réseau avant de saisir des données.');return}
 try{if(!sdk.apps.length)sdk.initializeApp(config);firebaseSdk=sdk;auth=sdk.auth();authBound=true;auth.onAuthStateChanged(u=>{if(u){hide();suppressFrameLogin()}else show()},e=>show('Connexion Firebase impossible : '+String(e?.message||'erreur d’authentification')))}catch(e){show('Connexion Firebase impossible : '+String(e?.message||'erreur'))}
}
const frame=document.getElementById('legacyFrame')||document.getElementById('materialFrame');frame?.addEventListener('load',()=>{suppressFrameLogin();if(!authBound)bootAuth()});
bootAuth();
})();
