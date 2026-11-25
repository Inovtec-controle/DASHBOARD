import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = process.cwd();
const shell = fs.readFileSync(path.join(root, 'inovtec-page-shell.html'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'inovtec-shell-modules.js'), 'utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tests/shell-module-order.baseline.json'), 'utf8'));

// Le shell crée l'iframe avant toute tentative de chargement Firebase.
const shellScripts = [...shell.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)].map(match => match[1]);
assert.equal(shellScripts.length, 2, 'Le shell ne doit pas multiplier les injecteurs de scripts');
assert.match(shellScripts[0], /^inovtec-shell\.js\?/);
assert.match(shellScripts[1], /^inovtec-shell-modules\.js\?/);
assert.ok(!shell.includes('document.write'), 'Les conditionnels restent dans le registre commun');

let tested = 0;
for (const [mode, expected] of Object.entries(baseline.modes)) {
  const written = [];
  const window = {};
  const sandbox = {
    URLSearchParams,
    location: { search: mode === 'default' ? '' : '?mode=' + encodeURIComponent(mode) },
    document: { write: value => written.push(String(value)) },
    window
  };
  vm.runInNewContext(loader, sandbox, { filename: 'inovtec-shell-modules.js', timeout: 2000 });
  assert.equal(written.length, 1, mode + ' : chargement synchrone du registre');
  const emitted = [...written[0].matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)].map(match => match[1]);
  const actual = [shellScripts[0], ...emitted];
  // Une seule consolidation intentionnelle des deux scripts de mise en page Infos :
  // l'historique reste gelé dans baseline.json, pour vérifier les autres dépendances.
  const expectedCurrent = mode === 'infos'
    ? expected.map(src => src.startsWith('inovtec-info-save-placement.js?')
        ? 'inovtec-info-layout.js?v=20261125-layout-one-observer1'
        : src).filter(src => !src.startsWith('inovtec-info-top-layout.js?'))
    : expected;
  assert.deepEqual(actual, expectedCurrent, mode + ' : ordre et présence des dépendances modifiés');
  assert.deepEqual(Array.from(window.INOVTEC_SHELL_LOADED_SCRIPTS), emitted, mode + ' : état de diagnostic');
  assert.equal(new Set(actual).size, actual.length, mode + ' : script chargé plusieurs fois');
  for (const src of actual) {
    if (/^https?:\/\//i.test(src)) continue;
    const local = src.split(/[?#]/, 1)[0];
    assert.ok(fs.existsSync(path.join(root, local)), mode + ' : script manquant ' + local);
  }
  tested++;
}

console.log('OK — ' + tested + ' modes du shell vérifiés : dépendances, ordre, chemins et unicité.');
