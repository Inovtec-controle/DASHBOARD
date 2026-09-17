(()=>{
'use strict';
const p=new URLSearchParams(location.search),target=p.get('agent')||'',requested=p.get('month')||'',action=p.get('action')||'';
const validMonth=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s),$=id=>document.getElementById(id);
const parentWin=(()=>{try{return parent&&parent!==window?parent:window}catch{return window}})();
const chosen=validMonth(requested)?requested:localStorage.getItem('inovtec_variables_month_view');
if(validMonth(chosen||'')){$('monthPick').value=chosen;$('monthPick').dispatchEvent(new Event('change',{bubbles:true}))}
$('monthPick').addEventListener('change',()=>{if(validMonth($('monthPick').value))localStorage.setItem('inovtec_variables_month_view',$('monthPick').value)});
const back=document.createElement('button');back.type='button';back.className='btn soft';back.textContent='← Tableau de bord';back.title='Revenir au suivi mensuel sans modifier les données';back.onclick=()=>{const m=$('monthPick').value;const page='VARIABLES-DASHBOARD.html'+(validMonth(m)?'?month='+encodeURIComponent(m):'');const url='inovtec-page-shell.html?mode=variables&page='+encodeURIComponent(page);try{parentWin.location.assign(url)}catch{location.assign(url)}};
const actions=document.querySelector('.top-actions');if(actions)actions.insertBefore(back,actions.firstChild);
let done=false,attempts=0;
function selectRequested(){if(done||!target)return;attempts++;const select=$('formAgent'),list=$('agentList');if(!select||!list)return;const options=[...select.options].filter(o=>o.value);const idx=options.findIndex(o=>String(o.value)===target);const buttons=[...list.querySelectorAll('.agent-btn')];if(idx<0||buttons.length<options.length)return;
if($('searchAgent').value){$('searchAgent').value='';$('searchAgent').dispatchEvent(new Event('input',{bubbles:true}));return}
const btn=buttons[idx];if(!btn)return;done=true;btn.click();if(action==='new')$('newVariable')?.click();if(action==='detect')$('detectPlanning')?.click();}
if(target){const observer=new MutationObserver(selectRequested);observer.observe($('agentList'),{childList:true,subtree:true});observer.observe($('formAgent'),{childList:true,subtree:true});selectRequested();const timer=setInterval(()=>{selectRequested();if(done||++attempts>90){clearInterval(timer);observer.disconnect()}},200)}
else if(action==='new')$('newVariable')?.click();
// La vue Variables autonome ne charge pas firebase-config.js : appliquer aussi ici le réglage sans CSV.
if(!document.querySelector('script[data-iv-hide-csv="1"]')&&!window.__INOVTEC_HIDE_CSV_EXPORTS_V1__){
 const csv=document.createElement('script');csv.src='inovtec-hide-csv-exports.js?v=20260917-no-csv1';csv.dataset.ivHideCsv='1';csv.async=false;document.head.appendChild(csv);
}
})();