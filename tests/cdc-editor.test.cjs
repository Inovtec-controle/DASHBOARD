const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const importedRows = () => [
  {id: 'hall', zone: 'Hall', prestation: 'Nettoyage des portes', jours: ['lundi', 'jeudi'], frequenceType: 'jours', sourceType: 'excel', importId: 'import-1', ordre: 10},
  {id: 'etage', zone: 'Étage', prestation: 'Lavage des sols', jours: ['mercredi', 'vendredi'], frequenceType: 'jours', sourceType: 'excel', importId: 'import-1', ordre: 20},
  {id: 'parking', zone: 'Parking', prestation: 'Balayage', jours: [], frequenceType: 'mensuel', frequence: 'Mensuel', sourceType: 'excel', importId: 'import-1', ordre: 30}
];

function editor(initial = importedRows(), cached = []) {
  let stored = structuredClone(initial);
  const elements = new Map(), observers = [], pending = new Set();
  function element(id) {
    const el = {id, value: '', dataset: {}, focus() {}, addEventListener() {}};
    elements.set(id, el);
    return el;
  }
  for (const id of ['ivCdcOverlay', 'ivCdcForm', 'ivCdcModalTitle', 'ivCdcZone', 'ivCdcPrestation', 'ivCdcFrequence', 'ivCdcControle', 'ivCdcMethode', 'ivCdcObservations', 'ivCdcFrequenceType', 'ivCdcScheduleStyle', 'siteForm']) element(id);
  elements.get('siteForm').dataset.ivChantierId = 'site-a';
  elements.get('ivCdcForm').dataset.ivOperationalFix = '1';
  const overlay = elements.get('ivCdcOverlay');
  let hidden = true;
  Object.defineProperty(overlay, 'hidden', {
    get: () => hidden,
    set: value => {
      hidden = value;
      observers.filter(o => o.target === overlay).forEach(o => pending.add(o));
    }
  });
  const checkboxes = DAYS.map(day => ({dataset: {ivCdcDay: day}, checked: false}));
  const submit = {dataset: {}};
  const doc = {
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '[data-iv-cdc-day]:checked' ? checkboxes.filter(cb => cb.checked) : checkboxes,
    querySelector: selector => selector === '#ivCdcForm button[type=submit]' ? submit : null
  };
  const snapshot = () => ({id: 'site-a', exists: true, data: () => ({cahierDesChargesV1: {rows: structuredClone(stored)}})});
  const db = {
    collection: () => ({doc: id => ({id, get: async () => snapshot()})}),
    runTransaction: async fn => fn({
      get: async () => snapshot(),
      set: (ref, data) => { assert.equal(ref.id, 'site-a'); stored = structuredClone(data.cahierDesChargesV1.rows); }
    })
  };
  const w = {firebase: {firestore: () => db, auth: () => ({currentUser: null})}};
  const context = vm.createContext({
    window: w, document: {getElementById: id => id === 'legacyFrame' ? {contentDocument: doc, addEventListener() {}} : null},
    location: {search: '?mode=infos'}, URLSearchParams, console,
    setTimeout() {}, clearTimeout() {}, setInterval() {},
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { this.target = target; observers.push(this); }
    },
    alert: message => assert.fail(message)
  });
  const exports = {
    'inovtec-cahier-des-charges.js': 'window.editorTest={openEditor,setSite:id=>{currentSiteId=id}};',
    'inovtec-cdc-schedule-fields.js': 'window.scheduleTest={ensureFields,setRows:value=>{rows=value}};'
  };
  for (const name of ['inovtec-cahier-des-charges.js', 'inovtec-cdc-schedule-fields.js', 'inovtec-cdc-operational-fix.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    vm.runInContext(source.replace(/\}\)\(\);\s*$/, (exports[name] || '') + '\n})();'), context);
  }
  w.editorTest.setSite('site-a');
  w.scheduleTest.setRows(cached);
  w.scheduleTest.ensureFields(doc);
  function flushObservers() {
    const callbacks = [...pending]; pending.clear();
    callbacks.forEach(o => o.callback());
  }
  return {
    open: row => { w.editorTest.openEditor(doc, row); flushObservers(); },
    days: () => checkboxes.filter(cb => cb.checked).map(cb => cb.dataset.ivCdcDay),
    setDays: days => checkboxes.forEach(cb => { cb.checked = days.includes(cb.dataset.ivCdcDay); }),
    field: id => elements.get(id),
    save: () => w.InovtecCdcOperationalSave(doc),
    rows: () => stored,
    refresh: rows => { w.scheduleTest.setRows(rows); w.scheduleTest.ensureFields(doc); flushObservers(); }
  };
}

test('editing an imported task prechecks its days even before the separate schedule subscription loads', async () => {
  const original = importedRows(), e = editor(original);
  e.open(original[0]);
  assert.deepEqual(e.days(), ['lundi', 'jeudi']);
  e.field('ivCdcPrestation').value = 'Nettoyage des portes et poignées';
  e.field('ivCdcZone').value = 'Hall principal';
  await e.save();
  assert.deepEqual(e.rows()[0], {...original[0], prestation: 'Nettoyage des portes et poignées', zone: 'Hall principal', observations: '', updatedAtMs: e.rows()[0].updatedAtMs});
  assert.deepEqual(e.rows().slice(1), original.slice(1));
});

test('stale schedule data cannot overwrite the opened task or deliberate day changes', async () => {
  const original = importedRows(), stale = [{...original[0], jours: ['mardi']}], e = editor(original, stale);
  e.open(original[0]);
  assert.deepEqual(e.days(), ['lundi', 'jeudi']);
  e.setDays(['vendredi']);
  e.refresh(stale);
  assert.deepEqual(e.days(), ['vendredi']);
  await e.save();
  e.open(e.rows()[0]);
  assert.deepEqual(e.days(), ['vendredi']);
});

test('deliberately unchecking every day persists and stays empty on reopening', async () => {
  const original = importedRows(), e = editor(original, original);
  e.open(original[0]);
  e.setDays([]);
  await e.save();
  assert.deepEqual(e.rows()[0].jours, []);
  e.open(e.rows()[0]);
  assert.deepEqual(e.days(), []);
});

test('switching tasks, monthly frequencies and new entries resets the form to the correct schedule', async () => {
  const original = importedRows(), e = editor(original);
  e.open(original[0]);
  e.open(original[1]);
  assert.deepEqual(e.days(), ['mercredi', 'vendredi']);
  e.open(original[2]);
  assert.deepEqual(e.days(), []);
  assert.equal(e.field('ivCdcFrequenceType').value, 'mensuel');
  e.field('ivCdcPrestation').value = 'Balayage du parking';
  await e.save();
  assert.equal(e.rows()[2].frequenceType, 'mensuel');
  assert.equal(e.rows()[2].frequence, 'Mensuel');
  e.open(original[0]);
  e.open(null);
  assert.deepEqual(e.days(), []);
  assert.equal(e.field('ivCdcFrequenceType').value, 'jours');
});

test('older imported entries without an id retain their days and are updated in place', async () => {
  const row = {...importedRows()[0], jours: [' Lundi ', 'JEUDI']};
  delete row.id;
  const e = editor([row]);
  e.open(row);
  assert.deepEqual(e.days(), ['lundi', 'jeudi']);
  e.field('ivCdcZone').value = 'Entrée';
  await e.save();
  assert.equal(e.rows().length, 1);
  assert.equal(e.rows()[0].zone, 'Entrée');
  assert.deepEqual(e.rows()[0].jours, ['lundi', 'jeudi']);
  assert.equal(e.rows()[0].sourceType, 'excel');
});
