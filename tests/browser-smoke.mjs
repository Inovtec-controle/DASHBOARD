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

await check('Accueil : recherche et navigation', async () => {
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#globalSearch').waitFor({ state: 'visible', timeout: 15000 });
  if (await page.locator('.c3-nav a[href*="PLANNINGS.html"]').count() !== 1) throw new Error('Lien Planning absent');
  if (await page.locator('.c3-nav a[href*="VARIABLES.html"]').count() !== 1) throw new Error('Lien Variables absent');
});

await check('Planning : chargement complet du calendrier', async () => {
  await page.goto(base + '/PLANNINGS.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.frameLocator('#legacyFrame').locator('#calendarViewport').waitFor({ state: 'attached', timeout: 45000 });
  await page.frameLocator('#legacyFrame').locator('#prevBtn').waitFor({ state: 'attached', timeout: 10000 });
  await page.frameLocator('#legacyFrame').locator('#agentList').waitFor({ state: 'attached', timeout: 10000 });
  // L’existence des boutons ne signifie pas que leurs gestionnaires JavaScript sont installés.
  await page.waitForFunction(() => {
    const doc = document.querySelector('#legacyFrame')?.contentDocument;
    const period = doc?.getElementById('periodLabel')?.textContent?.trim();
    return Boolean(period && period !== '—' && doc?.getElementById('week')?.value);
  }, null, { timeout: 30000 });
});

await check('Planning : changement des vues sans blocage', async () => {
  const frame = page.frameLocator('#legacyFrame');
  for (const mode of ['month', 'list', 'week', 'day', 'week']) {
    const button = frame.locator(`.view-tab[data-view="${mode}"]`);
    await button.click({ force: true, timeout: 10000 });
    await page.waitForTimeout(150);
    if (!await button.evaluate(b => b.classList.contains('active'))) throw new Error('Vue non sélectionnée : ' + mode);
  }
  await frame.locator('#todayBtn').click({ force: true, timeout: 10000 });
  const text = await frame.locator('#periodLabel').textContent();
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
  for (const name of ['AGENTS.html','INFOCHANTIERS-V2.html','KONTROL-CLOUD.html','CONGES.html','ORGA.html','MATERIEL.html']) {
    const response = await page.request.get(base + '/' + name, { timeout: 20000 });
    if (!response.ok()) throw new Error(name + ' : HTTP ' + response.status());
    if (!(await response.text()).toLowerCase().includes('<html')) throw new Error(name + ' : réponse HTML invalide');
  }
});

console.log('BILAN NAVIGATEUR : ' + (failures.length ? failures.length + ' anomalie(s)' : 'aucune anomalie détectée'));
for (const issue of failures) console.log('::error::' + issue);
await browser.close();
if (failures.length) process.exitCode = 1;
