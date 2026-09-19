/* Commandes de présentation : les actions restent reliées aux pages existantes. */
(()=>{'use strict';
if(window.__IV_MATERIEL_SHELL_V3__)return;window.__IV_MATERIEL_SHELL_V3__=true;
document.body.classList.add('iv-materiel-visual-v3');
const hero=document.querySelector('.iv-hero'),copy=hero?.querySelector('.iv-hero-copy'),frame=document.getElementById('materialFrame'),top=document.querySelector('.iv-topbar');if(!hero||!copy||!frame)return;
const eyebrow=copy.querySelector('.iv-eyebrow');if(eyebrow)eyebrow.textContent='GESTION DU MATÉRIEL';
const title=copy.querySelector('h1');if(title)title.innerHTML='Stock central du <em>bureau</em>';
const subtitle=copy.querySelector('p');if(subtitle)subtitle.textContent='Tout le matériel transite par le bureau avant d’être préparé et livré sur les chantiers.';
const flow=document.createElement('div');flow.className='iv-hero-flow';flow.innerHTML='<span>▣ Réception des fournisseurs</span><span>◇ Stockage centralisé</span><span>▥ Préparation des chantiers</span><span>↗ Traçabilité complète</span>';copy.append(flow);
const actions=document.createElement('div');actions.className='iv-hero-actions';actions.setAttribute('aria-label','Actions principales Matériel');
const receive=document.createElement('a');receive.href='REASSORT.html';receive.textContent='▣ Réception fournisseur';receive.title='Accéder aux commandes et aux réceptions fournisseur dans Réassort';
const deliver=document.createElement('a');deliver.href='REASSORT.html';deliver.textContent='↗ Créer sortie chantier';deliver.title='Préparer et confirmer une livraison chantier dans Réassort';
const add=document.createElement('button');add.type='button';add.textContent='＋ Nouvel article';add.onclick=()=>{const doc=frame.contentDocument;const button=doc?.getElementById('ivAddButton')||doc?.getElementById('newBtn');button?.click()};
actions.append(receive,deliver,add);hero.append(actions);
const nav=document.querySelector('.iv-sidebar .iv-nav');if(nav&&![...nav.querySelectorAll('a')].some(a=>a.getAttribute('href')?.startsWith('REASSORT.html'))){const link=document.createElement('a');link.href='REASSORT.html';link.innerHTML='<span class="iv-ico">▥</span><span>Réassort</span>';const material=nav.querySelector('a[href="MATERIEL.html"]');if(material)nav.insertBefore(link,material);else nav.append(link)}
if(top){const search=document.createElement('label');search.className='iv-top-search';search.innerHTML='<span aria-hidden="true">⌕</span><input id="ivVisualGlobalSearch" type="search" aria-label="Rechercher un article dans le stock" placeholder="Rechercher un article, un fournisseur, une référence…">';top.insertBefore(search,top.querySelector('.iv-top-actions'));
 const input=search.querySelector('input');input.addEventListener('input',()=>{const inner=frame.contentDocument?.getElementById('search');if(!inner)return;inner.value=input.value;inner.dispatchEvent(new Event('input',{bubbles:true}))});
 frame.addEventListener('load',()=>{const inner=frame.contentDocument?.getElementById('search');if(inner&&input.value){inner.value=input.value;inner.dispatchEvent(new Event('input',{bubbles:true}))}})}
})();