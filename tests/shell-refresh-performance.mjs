import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, serviceWorkers: 'block' });
  await page.addInitScript(() => {
    // Compter uniquement les cycles de suivi du shell ; les iframes ont leur propre fenêtre.
    if (window.top !== window) return;
    const nativeSetInterval = window.setInterval;
    window.__inovtecStatusPollingCount = 0;
    window.setInterval = function (callback, delay, ...args) {
      if (delay === 2400) window.__inovtecStatusPollingCount += 1;
      return nativeSetInterval.call(this, callback, delay, ...args);
    };
  });
  await page.goto('http://127.0.0.1:8765/inovtec-page-shell.html?mode=temps&page=TEMPS-LEGACY.html', {
    waitUntil: 'domcontentloaded', timeout: 45000
  });
  await page.locator('#loading.hidden').waitFor({ state: 'attached', timeout: 30000 });
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(() => new Promise((resolve, reject) => {
      const frame = document.getElementById('legacyFrame');
      if (!frame?.contentWindow) return reject(new Error('Cadre absent'));
      frame.addEventListener('load', resolve, { once: true });
      frame.contentWindow.location.reload();
    }));
    await page.locator('#loading.hidden').waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(130);
  }
  const count = await page.evaluate(() => window.__inovtecStatusPollingCount);
  if (count !== 1) throw new Error(`Les actualisations ont créé ${count} cycles périodiques (attendu : 1)`);
  console.log('OK : un seul suivi périodique après quatre actualisations de la page intégrée');
} finally {
  await browser.close();
}
