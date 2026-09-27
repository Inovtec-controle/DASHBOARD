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

await check('Agents : Nom/Prénom, Enregistrer immédiat et tri A-Z', async () => {
  await page.goto(base + '/AGENTS-LEGACY.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => localStorage.setItem('kontrol_agents_classeur_v2', JSON.stringify([{
    id:'agent_da_rocha_test',
    identity:{nom:'',prenom:'Da rocha',telephone:'',email:'',adresse:'',dateNaissance:'',secu:'',permis:'',vehicule:''},
    job:{poste:'',typeContrat:'',dateEntree:'',sitePrincipal:'',disponibilites:'',notes:''},
    docs:[],incidents:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  }])));
  await page.goto(base + '/AGENTS.html?v=20260927-agentfields1', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#legacyFrame').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => {
    const f=document.getElementById('legacyFrame');
    return !!f?.contentDocument?.getElementById('btnSaveAgent')
      && !!f?.contentDocument?.querySelector('.listItem[data-agent-id="agent_da_rocha_test"]');
  }, null, { timeout: 30000 });

  const result=await page.evaluate(async () => {
    const frame=document.getElementById('legacyFrame'),d=frame.contentDocument,w=frame.contentWindow;
    d.querySelector('.listItem[data-agent-id="agent_da_rocha_test"]').click();
    const nom=d.getElementById('f_nom'),prenom=d.getElementById('f_prenom');
    const labels={
      nom:nom?.closest('.field')?.querySelector('label')?.textContent?.trim(),
      prenom:prenom?.closest('.field')?.querySelector('label')?.textContent?.trim()
    };
    if(labels.nom!=='Nom'||labels.prenom!=='Prénom')return {error:'Les champs Nom/Prénom sont encore inversés',labels};

    nom.value='Da rocha';
    prenom.value='';
    d.getElementById('btnSaveAgent').click();
    await new Promise(r=>setTimeout(r,80));

    const rows=JSON.parse(w.localStorage.getItem('kontrol_agents_classeur_v2')||'[]');
    const saved=rows.find(x=>x.id==='agent_da_rocha_test');
    const bubble=d.querySelector('.listItem[data-agent-id="agent_da_rocha_test"] .name')?.textContent?.trim()||'';

    d.querySelector('.listItem[data-agent-id="agent_da_rocha_test"]').click();
    return {
      savedNom:saved?.identity?.nom||'',
      savedPrenom:saved?.identity?.prenom||'',
      visibleNom:d.getElementById('f_nom')?.value||'',
      visiblePrenom:d.getElementById('f_prenom')?.value||'',
      bubble
    };
  });
  if(result.error)throw new Error(result.error);
  if(result.savedNom!=='Da rocha'||result.savedPrenom!=='')throw new Error('La correction Nom/Prénom n’est pas enregistrée');
  if(result.visibleNom!=='Da rocha'||result.visiblePrenom!=='')throw new Error('La fiche ne reflète pas immédiatement la correction');
  if(!/Da rocha/i.test(result.bubble))throw new Error('La bulle agent ne reflète pas immédiatement la correction');
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
