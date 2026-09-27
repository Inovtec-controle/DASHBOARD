import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8765';
const failures = [];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
await page.route('**/planning-firebase-direct-v2.js*', route=>route.fulfill({
  status:200,
  contentType:'application/javascript',
  body:'window.__INOVTEC_PLANNING_FIREBASE_DIRECT_V1__=true;'
}));
page.on('pageerror', error => {
  const message = String(error?.stack || error?.message || error);
  if (/(?:127\.0\.0\.1|localhost).*?(?:TypeError|ReferenceError|SyntaxError)|^(?:TypeError|ReferenceError|SyntaxError)/i.test(message)) {
    failures.push('JavaScript : ' + message.slice(0, 400));
  }
});

async function check(label, fn) {
  try { await fn(); console.log('OK : ' + label); }
  catch (error) { failures.push(label + ' : ' + String(error?.message || error).slice(0, 300)); console.error('ÉCHEC : ' + label + ' : ' + error?.message); }
}

await check('Accueil : recherche et navigation directe cohérente', async () => {
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#globalSearch').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.c3-nav')?.dataset.ivStableMenu === '1', null, { timeout: 20000 });
  const nav = page.locator('.c3-nav');
  if (await nav.locator('a[data-iv-menu-key="planning"]').count() !== 1) throw new Error('Lien Planning absent ou dupliqué');
  if (await nav.locator('a[data-iv-menu-key="variables"]').count() !== 1) throw new Error('Lien Variables absent ou dupliqué');
  if (await nav.locator('a[data-iv-menu-key="reassort"]').count() !== 1) throw new Error('Lien Réassort absent ou dupliqué');
  const url = await nav.locator('a[data-iv-menu-key="planning"]').getAttribute('href');
  if (!url || !url.startsWith('PLANNINGS.html')) throw new Error('Le lien Planning ne pointe pas vers la page dédiée');
});

await check('Planning : présentation Dashboard et moteur intégré', async () => {
  await page.goto(base + '/PLANNINGS.html?mode=planning', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#legacyFrame').waitFor({ state: 'attached', timeout: 45000 });
  const frame = page.frameLocator('#legacyFrame');
  await frame.locator('#calendarViewport').waitFor({ state: 'attached', timeout: 45000 });
  await frame.locator('#prevBtn').waitFor({ state: 'attached', timeout: 10000 });
  await frame.locator('#agentList').waitFor({ state: 'attached', timeout: 10000 });
  if (await frame.locator('#addTaskBtn').count()) throw new Error('Le bouton + Tâche est encore présent');
  await frame.locator('#periodLabel').waitFor({ state: 'attached', timeout: 10000 });
});

await check('Planning : changement des vues sans blocage', async () => {
  await page.goto(base + '/PLANNINGS-APP.html?mode=planning', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => {
    const period = document.getElementById('periodLabel')?.textContent?.trim();
    return Boolean(period && period !== '—' && document.getElementById('week')?.value);
  }, null, { timeout: 30000 });
  for (const mode of ['month', 'list', 'week', 'day', 'week']) {
    const button = page.locator(`.view-tab[data-view="${mode}"]`);
    await button.click({ timeout: 10000 });
    await page.waitForFunction(value => document.querySelector(`.view-tab[data-view="${value}"]`)?.classList.contains('active'), mode, { timeout: 5000 });
  }
  await page.locator('#todayBtn').click({ timeout: 10000 });
  const text = await page.locator('#periodLabel').textContent();
  if (!text || text.trim() === '—') throw new Error('Période du calendrier absente');
});

await check('Agents : Firebase uniquement, création et renommage', async () => {
  await page.addInitScript(() => {
    if(!/AGENTS-LEGACY\.html$/i.test(location.pathname)) return;
    const clone=v=>JSON.parse(JSON.stringify(v));
    const fixture={rows:[]};
    window.__agentCloudFixture=fixture;
    window.InovtecAgentsCloud={
      load:async()=>clone(fixture.rows),
      saveAgent:async agent=>{
        const idx=fixture.rows.findIndex(x=>String(x?.id||'')===String(agent?.id||''));
        const value=clone(agent);
        if(idx>=0)fixture.rows[idx]=value;else fixture.rows.push(value);
        return clone(value);
      },
      saveAll:async rows=>{
        fixture.rows=clone(Array.isArray(rows)?rows:[]);
        return clone(fixture.rows);
      }
    };
  });

  await page.goto(base + '/AGENTS-LEGACY.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#btnNewAgentAction').waitFor({state:'attached',timeout:15000});

  const placement=await page.locator('#btnNewAgentAction').evaluate(el=>({
    visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length),
    inCard:!!el.closest('.card'),
    inActionBar:el.closest('#agentActionBar')!==null
  }));
  if(!placement.visible||placement.inCard||!placement.inActionBar){
    throw new Error('Le bouton Nouvel agent n’est pas à sa place : '+JSON.stringify(placement));
  }

  async function create(nom,prenom){
    await page.locator('#btnNewAgentAction').click();
    await page.locator('#f_prenom').fill(nom);
    await page.locator('#f_nom').fill(prenom);
    await page.locator('#btnSaveAgent').click();
    await page.waitForFunction(() => document.getElementById('btnSaveAgent')?.textContent?.includes('Enregistré'), null, {timeout:5000});
    const data=await page.evaluate(()=>({
      remote:window.__agentCloudFixture.rows.map(a=>({id:a.id,nom:a.identity?.nom||'',prenom:a.identity?.prenom||'',draft:a._draft})),
      list:[...document.querySelectorAll('#agentList .listItem')].map(r=>({id:r.dataset.agentId,sort:r.dataset.sortName,name:r.querySelector('.name')?.textContent?.trim()})),
      local:localStorage.getItem('kontrol_agents_classeur_v2')
    }));
    if(data.local!==null)throw new Error('Le Classeur Agents écrit encore dans localStorage');
    if(!data.remote.some(a=>a.prenom===nom&&a.nom===prenom&&a.draft!==true))throw new Error('Agent non envoyé au service Firebase direct : '+JSON.stringify(data));
    if(!data.list.some(a=>a.sort===nom))throw new Error('Agent non visible immédiatement : '+JSON.stringify(data));
  }

  await create('Dupont','Jeanne');
  await create('Zulu','Paul');

  await page.locator('.listItem[data-sort-name="Zulu"]').click();
  await page.locator('#f_prenom').fill('Abadie');
  await page.locator('#btnSaveAgent').click();
  await page.waitForFunction(() => document.getElementById('btnSaveAgent')?.textContent?.includes('Enregistré'), null, {timeout:5000});

  const result=await page.evaluate(()=>({
    remote:window.__agentCloudFixture.rows.map(a=>({nom:a.identity?.nom||'',prenom:a.identity?.prenom||''})),
    list:[...document.querySelectorAll('#agentList .listItem')].map(r=>r.dataset.sortName),
    local:localStorage.getItem('kontrol_agents_classeur_v2')
  }));
  if(result.local!==null)throw new Error('Une copie locale Agents a été recréée');
  if(!result.remote.some(a=>a.prenom==='Abadie'&&a.nom==='Paul'))throw new Error('Renommage non envoyé à Firebase : '+JSON.stringify(result));
  const collator=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
  const expected=[...result.list].sort((a,b)=>collator.compare(a,b));
  if(JSON.stringify(result.list)!==JSON.stringify(expected))throw new Error('Liste Agents non reclassée A-Z : '+JSON.stringify(result));
});

await check('Variables : indicateurs et mois accessibles', async () => {
  await page.goto(base + '/VARIABLES-DASHBOARD.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#monthPick').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#details').waitFor({ state: 'attached' });
  await page.locator('#reload').click({ timeout: 10000 });
  await page.locator('#monthPick').fill('2026-09');
  if (await page.locator('#monthPick').inputValue() !== '2026-09') throw new Error('Sélection du mois impossible');
});

await check('Variables : accès à l’éditeur', async () => {
  await page.locator('#editAll').click({ timeout: 10000 });
  await page.waitForURL(/mode=variables/, { timeout: 20000 });
  await page.locator('#legacyFrame').waitFor({ state: 'attached', timeout: 20000 });
});

await check('Pages métiers : réponses HTML', async () => {
  for (const name of ['AGENTS.html','INFOCHANTIERS-V2.html','KONTROL-CLOUD.html','CONGES.html','ORGA.html','MATERIEL.html','REASSORT.html']) {
    const response = await page.request.get(base + '/' + name, { timeout: 20000 });
    if (!response.ok()) throw new Error(name + ' : HTTP ' + response.status());
    if (!(await response.text()).toLowerCase().includes('<html')) throw new Error(name + ' : réponse HTML invalide');
  }
});

console.log('BILAN NAVIGATEUR : ' + (failures.length ? failures.length + ' anomalie(s)' : 'aucune anomalie détectée'));
for (const issue of failures) console.log('::error::' + issue);
await browser.close();
if (failures.length) process.exitCode = 1;
