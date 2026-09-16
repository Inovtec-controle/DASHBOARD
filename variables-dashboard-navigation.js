(()=>{
'use strict';
const $=id=>document.getElementById(id),m=$('monthPick'),key='inovtec_variables_month_view',valid=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const requested=new URLSearchParams(location.search).get('month')||localStorage.getItem(key)||'';
if(valid(requested)){m.value=requested;m.dispatchEvent(new Event('change',{bubbles:true}))}
const remember=()=>{if(valid(m.value))localStorage.setItem(key,m.value)};m.addEventListener('change',remember);remember();
const pwin=(()=>{try{return parent&&parent!==window?parent:window}catch{return window}})();
function editor(action=''){remember();const nested='VARIABLES-LEGACY.html?month='+encodeURIComponent(m.value)+(action?'&action='+encodeURIComponent(action):'');const url='inovtec-page-shell.html?mode=variables&page='+encodeURIComponent(nested);try{pwin.location.assign(url)}catch{location.assign(url)}}
const hidden=(id,fn)=>{const b=document.createElement('button');b.type='button';b.id=id;b.hidden=true;b.addEventListener('click',fn);document.body.append(b)};
hidden('newVariable',()=>editor('new'));
hidden('detectPlanning',()=>editor('detect'));
hidden('exportCsv',()=>{$('estimateCsv')?.click()});
$('editAll')?.addEventListener('click',()=>remember(),true);
$('details')?.addEventListener('click',()=>remember(),true);
})();