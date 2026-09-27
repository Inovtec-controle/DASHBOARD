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

await check('Agents : enregistrement et tri A-Z permanent par Nom', async () => {
  await page.goto(base + '/AGENTS-LEGACY.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => localStorage.removeItem('kontrol_agents_classeur_v2'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });

  async function createAgent(nom,prenom){
    await page.locator('#btnNewAgent').click();
    await page.locator('#f_prenom').fill(nom); // champ visible "Nom" (schéma historique)
    await page.locator('#f_nom').fill(prenom); // champ visible "Prénom"
    await page.locator('#btnSaveAgent').click();
  }

  for (const [nom,prenom] of [
    ['Touil','Nora'],
    ['Rott','Paul'],
    ['Acuna Carlos','Luis'],
    ['Da rocha','Mia'],
    ['Bernard','Zoé'],
    ['Évrard','Alain']
  ]) await createAgent(nom,prenom);

  const sortNames=await page.locator('#agentList .listItem').evaluateAll(rows=>rows.map(r=>(r.dataset.sortName||'').trim()));
  if(sortNames.length!==6) throw new Error('La liste Agents ne contient pas toutes les fiches de test');
  const collator=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
  const expected=[...sortNames].sort((a,b)=>collator.compare(a,b));
  if(JSON.stringify(sortNames)!==JSON.stringify(expected)){
    throw new Error('La liste Agents n’applique pas la règle générale A-Z sur le champ Nom');
  }
});

await check('Agents : Enregistrer reste fonctionnel après création et modification', async () => {
  // Prépare une copie locale vide sur le même origin, puis ouvre la vraie route Dashboard.
  await page.goto(base + '/AGENTS-LEGACY.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => localStorage.setItem('kontrol_agents_classeur_v2','[]'));

  await page.goto(base + '/AGENTS.html?v=20260927-agentsave-stable2', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#legacyFrame').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => {
    const f=document.getElementById('legacyFrame');
    return !!f?.contentDocument?.getElementById('btnNewAgent')
      && !!f?.contentDocument?.getElementById('btnSaveAgent')
      && typeof f?.contentWindow?.saveAgentForm === 'function';
  }, null, { timeout: 30000 });

  const first=await page.evaluate(async () => {
    const f=document.getElementById('legacyFrame'),d=f.contentDocument,w=f.contentWindow;
    d.getElementById('btnNewAgent').click();
    d.getElementById('f_prenom').value='Martin';
    d.getElementById('f_nom').value='Alice';
    d.getElementById('f_tel').value='0600000001';
    d.getElementById('btnSaveAgent').click();
    await new Promise(r=>setTimeout(r,120));
    const rows=JSON.parse(w.localStorage.getItem('kontrol_agents_classeur_v2')||'[]');
    const a=rows.find(x=>x?._deleted!==true&&x?.identity?.prenom==='Martin'&&x?.identity?.nom==='Alice');
    return a?{id:a.id,draft:a._draft,tel:a.identity?.telephone}:null;
  });
  if(!first||first.draft===true||first.tel!=='0600000001') throw new Error('Enregistrer ne crée pas correctement un nouvel agent');

  const second=await page.evaluate(async (id) => {
    const f=document.getElementById('legacyFrame'),d=f.contentDocument,w=f.contentWindow;
    const row=d.querySelector('.listItem[data-agent-id="'+CSS.escape(id)+'"]');
    row?.click();
    d.getElementById('f_tel').value='0600000002';
    d.getElementById('f_email').value='alice.martin@example.test';
    d.getElementById('btnSaveAgent').click();
    await new Promise(r=>setTimeout(r,120));
    const rows=JSON.parse(w.localStorage.getItem('kontrol_agents_classeur_v2')||'[]');
    const a=rows.find(x=>String(x?.id)===String(id));
    return a?{tel:a.identity?.telephone,email:a.identity?.email,draft:a._draft}:null;
  }, first.id);
  if(!second||second.draft===true||second.tel!=='0600000002'||second.email!=='alice.martin@example.test'){
    throw new Error('Enregistrer ne conserve pas les modifications d’une fiche existante');
  }
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
