import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8765';
const failures = [];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
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
  if (!url?.startsWith('inovtec-page-shell.html?') || !url.includes('mode=planning')) throw new Error('Le planning fait encore une redirection intermédiaire');
});

await check('Planning : chargement dans la rubrique principale', async () => {
  await page.goto(base + '/PLANNINGS.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.frameLocator('#legacyFrame').locator('#calendarViewport').waitFor({ state: 'attached', timeout: 45000 });
  await page.frameLocator('#legacyFrame').locator('#prevBtn').waitFor({ state: 'attached', timeout: 10000 });
  await page.frameLocator('#legacyFrame').locator('#agentList').waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => {
    const doc = document.querySelector('#legacyFrame')?.contentDocument;
    const period = doc?.getElementById('periodLabel')?.textContent?.trim();
    return Boolean(period && period !== '—' && doc?.getElementById('week')?.value);
  }, null, { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('desktopNav')?.dataset.ivStableMenu === '1', null, { timeout: 20000 });
  if (await page.locator('#desktopNav a[data-iv-menu-key="reassort"]').count() !== 1) throw new Error('Menu Planning incomplet');
  const frameUrl=await page.locator('#legacyFrame').getAttribute('src')||'';
  if(!frameUrl.includes('PLANNINGS-LEGACY.html?v=20260923-editor-reset3')) throw new Error('Ancienne version du Planning chargée dans le Dashboard : '+frameUrl);
  const calendarSrc=await page.frameLocator('#legacyFrame').locator('script[src^="planning-calendar.js"]').getAttribute('src');
  if(calendarSrc!=='planning-calendar.js?v=20260923-editor-reset2') throw new Error('Ancien moteur Planning chargé : '+calendarSrc);
});

await check('Planning : changement des vues sans blocage', async () => {
  await page.goto(base + '/PLANNINGS-LEGACY.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
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
