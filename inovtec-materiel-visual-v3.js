/* Présentation uniquement : réutilise les contrôles et les écritures Firebase du stock bureau. */
(()=>{'use strict';
if(window.__IV_MATERIEL_VISUAL_V3__)return;
const $=id=>document.getElementById(id);
const board=document.querySelector('.iv-office'),columns=board?.querySelector('.iv-office-columns'),rows=$('ivOfficeRows');
if(!board||!columns||!rows)return;
window.__IV_MATERIEL_VISUAL_V3__=true;
document.body.classList.add('iv-office-visual');
const snapshot=()=>window.__IV_OFFICE_DASHBOARD_SNAPSHOT__||{items:[],reassort:{orders:[],deliveries:[]},movements:[],online:false};
const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',"'":'&#39;'}[c]));
const office=item=>['bureau','depot','dépôt','stock central','magasin central','stock bureau'].includes(String(item?.site||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim());
const originalTitle=board.querySelector('.iv-office-title'),actions=originalTitle?.querySelector('.iv-office-actions'),kpis=board.querySelector('.iv-office-kpis');
if(actions){const strip=document.createElement('div');strip.className='iv-office-actions-strip';strip.setAttribute('aria-label','Mouvements au bureau');strip.append(...[...actions.children]);kpis?.after(strip)}
const inventory=columns.querySelector('.iv-office-panel'),alertPanel=columns.querySelectorAll('.iv-office-panel')[1];
const head=document.createElement('div');head.className='iv-office-inventory-head';head.innerHTML='<div><h3>Articles en stock</h3><p>Matériel de nettoyage présent physiquement au bureau</p></div><span class="iv-office-available" id="ivVisualAvailable">Disponible : —</span>';
inventory?.insertBefore(head,inventory.firstChild);
const oldTitle=inventory?.querySelector(':scope > h3');if(oldTitle)oldTitle.remove();
const searchbar=document.createElement('div');searchbar.className='iv-office-searchbar';searchbar.setAttribute('aria-label','Rechercher et filtrer le stock');
const searchWrap=document.querySelector('.toolbar .iv-search-wrap'),filters=document.querySelector('.toolbar .filters');
if(searchWrap)searchbar.append(searchWrap);if(filters)searchbar.append(filters);
head?.after(searchbar);
const rail=document.createElement('aside');rail.className='iv-visual-rail';rail.setAttribute('aria-label','Alertes, mouvements et préparations');
columns.append(rail);
if(alertPanel){rail.append(alertPanel);const title=alertPanel.querySelector('h3');if(title)title.textContent='⚠ Alertes stock bas';const h=alertPanel.querySelector('h3');if(h){const bar=document.createElement('div');bar.className='iv-office-section-title';h.before(bar);bar.append(h);const a=document.createElement('a');a.href='#ivOfficeRows';a.textContent='Voir le stock';bar.append(a)}}
const recent=document.createElement('section');recent.className='iv-office-panel iv-visual-recent';recent.innerHTML='<div class="iv-office-section-title"><h3>↗ Derniers mouvements</h3><a href="#ivOfficeMovements">Voir tout</a></div><div id="ivVisualRecent"><div class="iv-office-muted">Aucun mouvement enregistré.</div></div>';
rail.append(recent);
const prep=document.createElement('section');prep.className='iv-office-panel iv-visual-preparations';prep.innerHTML='<div class="iv-office-section-title"><h3>▣ Préparations chantier</h3><a href="REASSORT.html" target="_top">Voir tout</a></div><div id="ivVisualPreparations"><div class="iv-office-muted">Aucune préparation en attente.</div></div>';
rail.append(prep);
const history=board.querySelector('.iv-office-panel:has(#ivOfficeMovements)');if(history){history.classList.add('iv-office-history');const heading=history.querySelector('h3');if(heading)heading.textContent='Historique des livraisons et mouvements';const title=history.querySelector('.iv-office-title');if(title){const a=document.createElement('a');a.href='REASSORT.html';a.target='_top';a.className='iv-office-btn';a.textContent='Historique livraisons chantier ↗';title.append(a)}}
const originalTable=inventory?.querySelector('.iv-office-table');const header=originalTable?.querySelector('thead tr');
if(header&&header.children.length===6){header.children[0].textContent='Article';header.children[1].textContent='Au bureau';header.children[2].textContent='Réservé';header.children[3].textContent='Disponible';header.children[4].textContent='Seuil mini';['Fournisseur','Zone de stockage','Statut'].forEach(label=>{const th=document.createElement('th');th.textContent=label;header.insertBefore(th,header.lastElementChild)});header.lastElementChild.textContent='Actions'}
function iconFor(item){const s=String([item?.name,item?.category].join(' ')).toLowerCase();if(/frange|microfibre|lavette|chiffon/.test(s))return '▤';if(/balai|raclette|brosse/.test(s))return '⌁';if(/produit|détergent|nettoyant|vitre/.test(s))return '◉';if(/sac|rouleau|papier/.test(s))return '▣';return '◇'}
function enrichRows(){const byId=new Map((snapshot().items||[]).filter(office).map(item=>[String(item.id),item]));for(const row of rows.children){if(row.dataset.ivVisual==='1')continue;const cells=row.querySelectorAll('td');if(cells.length!==6)continue;const id=row.querySelector('[data-office-detail]')?.dataset.officeDetail||'';const item=byId.get(String(id));if(!item)continue;const badge=cells[0].querySelector('.iv-office-tag')?.cloneNode(true);const article=document.createElement('div');article.className='iv-article';const icon=document.createElement('span');icon.className='iv-article-icon';icon.setAttribute('aria-hidden','true');icon.textContent=iconFor(item);const content=document.createElement('span');const strong=document.createElement('strong');strong.textContent=item.name||'Article';const small=document.createElement('small');small.textContent='Réf. '+(item.reference||'non renseignée');content.append(strong,small);article.append(icon,content);cells[0].replaceChildren(article);
 const supplier=document.createElement('td');supplier.textContent=item.supplier||'À renseigner';const location=document.createElement('td');location.textContent=item.location||'Bureau · emplacement à préciser';const status=document.createElement('td');if(badge)status.append(badge);else status.textContent='—';row.insertBefore(supplier,cells[5]);row.insertBefore(location,cells[5]);row.insertBefore(status,cells[5]);row.dataset.ivVisual='1'}
 const empty=rows.querySelector('td[colspan="6"]');if(empty)empty.colSpan=9;
}
function renderRecent(){const source=$('ivOfficeMovements'),target=$('ivVisualRecent');if(!source||!target)return;target.replaceChildren();const entries=[...source.querySelectorAll(':scope > .iv-office-movement')].slice(0,4);if(!entries.length){const note=document.createElement('div');note.className='iv-office-muted';note.textContent='Aucun mouvement enregistré.';target.append(note);return}entries.forEach(entry=>target.append(entry.cloneNode(true)))}
function renderPreparation(){const {reassort={}}=snapshot(),orders=Array.isArray(reassort.orders)?reassort.orders:[],deliveries=Array.isArray(reassort.deliveries)?reassort.deliveries:[],groups=new Map();orders.forEach(order=>{if(order?.workflow!=='chantier'||['annulee','brouillon'].includes(order.status))return;const delivered=deliveries.filter(x=>x.orderId===order.id&&x.kind==='chantier').reduce((sum,d)=>sum+number(d.quantity),0),pending=Math.max(0,number(order.preparedQuantity)-delivered);if(!pending)return;const name=String(order.site||'Chantier non renseigné'),value=groups.get(name)||{lines:0,units:0};value.lines++;value.units+=pending;groups.set(name,value)});
 const target=$('ivVisualPreparations');if(!target)return;target.replaceChildren();if(!groups.size){const note=document.createElement('div');note.className='iv-office-muted';note.textContent='Aucune préparation en attente de livraison.';target.append(note);return}for(const [site,data] of [...groups].sort((a,b)=>a[0].localeCompare(b[0],'fr')).slice(0,5)){const entry=document.createElement('div');entry.className='iv-preparation-row';const info=document.createElement('div');const label=document.createElement('strong');label.textContent=site;const sub=document.createElement('small');sub.textContent=data.lines+' référence(s) préparée(s)';info.append(label,sub);const amount=document.createElement('b');amount.textContent=data.units+' unité(s)';entry.append(info,amount);target.append(entry)}}
function update(){const available=$('ivOfficeAvailable')?.textContent||'—';if($('ivVisualAvailable'))$('ivVisualAvailable').textContent='Disponible : '+available+' unités';enrichRows();renderRecent();renderPreparation()}
new MutationObserver(()=>enrichRows()).observe(rows,{childList:true});
const movements=$('ivOfficeMovements');if(movements)new MutationObserver(()=>renderRecent()).observe(movements,{childList:true});
window.addEventListener('iv-office-dashboard-update',update);
update();
})();