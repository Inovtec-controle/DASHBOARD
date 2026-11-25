import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error?.message || error)));
  await page.goto(base + '/tests/info-layout-fixture.html?mode=infos', { waitUntil: 'domcontentloaded' });

  const ready = () => {
    const d = document.getElementById('legacyFrame')?.contentDocument;
    const form = d?.getElementById('siteForm');
    const general = d?.getElementById('ivGeneralInfoCard');
    const contacts = d?.getElementById('ivContactsCard');
    const history = d?.getElementById('ivControlHistoryCard');
    const save = d?.querySelector('.sticky-save');
    const title = general?.querySelector('.section-title');
    const contract = d?.getElementById('ivContractFields');
    return !!(form && general && contacts && history && save && title && contract &&
      form.firstElementChild === general &&
      general.nextElementSibling === contacts &&
      title.nextElementSibling === contract &&
      history.nextElementSibling === save &&
      save.classList.contains('iv-after-cdc'));
  };

  await page.waitForFunction(ready, { timeout: 10000 });
  const initial = await page.evaluate(() => {
    const d = document.getElementById('legacyFrame').contentDocument;
    return {
      observerCount: window.__ivLayoutObserverStates.filter(state => state.active && state.source.includes('inovtec-info-layout.js')).length,
      label: d.querySelector('label[for="locauxConteneurs"]')?.textContent,
      choices: [...d.getElementById('ivTypeChantier').options].map(o => o.value),
      topStyles: d.querySelectorAll('#ivInfoTopLayoutStyle').length,
      saveStyles: d.querySelectorAll('#ivInfoSavePlacementStyle').length
    };
  });
  assert.equal(initial.observerCount, 1, 'Un seul observateur Infos chantier doit être actif');
  assert.equal(initial.label, 'Local conteneurs');
  assert.deepEqual(initial.choices, ['', 'Copropriétés', 'Tertiaire', 'Industriels', 'Autre']);
  assert.equal(initial.topStyles, 1);
  assert.equal(initial.saveStyles, 1);

  // Le bouton suit le cahier des charges quand la carte historique disparaît.
  await page.evaluate(() => {
    const d = document.getElementById('legacyFrame').contentDocument;
    d.getElementById('ivControlHistoryCard').remove();
  });
  await page.waitForFunction(() => {
    const d = document.getElementById('legacyFrame').contentDocument;
    return d.getElementById('ivCdcCard').nextElementSibling === d.querySelector('.sticky-save');
  }, { timeout: 5000 });

  // Il suit ensuite l'historique ajouté dynamiquement.
  await page.evaluate(() => {
    const d = document.getElementById('legacyFrame').contentDocument;
    const card = d.createElement('section');
    card.id = 'ivControlHistoryCard';
    card.className = 'card';
    card.textContent = 'Historique arrivé après chargement';
    d.getElementById('ivCdcCard').insertAdjacentElement('afterend', card);
  });
  await page.waitForFunction(() => {
    const d = document.getElementById('legacyFrame').contentDocument;
    return d.getElementById('ivControlHistoryCard').nextElementSibling === d.querySelector('.sticky-save');
  }, { timeout: 5000 });

  // Lorsqu'une nouvelle fiche est chargée dans le cadre, un seul observateur est créé.
  await page.evaluate(() => window.inovtecInfoFixture());
  await page.waitForFunction(ready, { timeout: 10000 });
  await page.waitForFunction(() => window.__ivLayoutObserverStates.filter(state => state.active && state.source.includes('inovtec-info-layout.js')).length === 1, null, { timeout: 5000 });
  assert.deepEqual(errors, [], 'Aucune erreur JavaScript sur la fiche');
  console.log('OK — Infos chantier : affichage, enregistrement, historique dynamique et recharge du cadre.');
} finally {
  await browser.close();
}
