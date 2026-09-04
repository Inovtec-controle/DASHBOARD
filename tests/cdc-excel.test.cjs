const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const X = require('../vendor/xlsx-0.18.5.full.min.js');
const root = path.join(__dirname, '..');
function app() {
  const context = vm.createContext({window: {XLSX: X}, document: {getElementById: () => null}, location: {search: '?mode=infos'}, URLSearchParams, URL, console, setTimeout, clearTimeout});
  for (const name of ['inovtec-cdc-importer.js', 'inovtec-cdc-import-excel.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context);
  return context.window;
}
function sheet(data, merges = [], origin) {
  const ws = X.utils.aoa_to_sheet([]);
  X.utils.sheet_add_aoa(ws, data, {origin: origin || 'A1'});
  ws['!merges'] = merges.map(m => X.utils.decode_range(m));
  return ws;
}
async function parse(ws, type = 'xlsx', extra = []) {
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'Prestations');
  extra.forEach(([name, other]) => X.utils.book_append_sheet(wb, other, name));
  const bytes = X.write(wb, {type: 'buffer', bookType: type});
  const res = await app().InovtecCdcImportParsers.excel({name: 'essai.' + type, arrayBuffer: async () => bytes});
  return JSON.parse(JSON.stringify(res));
}
test('imports the Clos Atlanta layout with a shared heading and four merged zones', async () => {
  const groups = [
    ['ESPACES\nVERTS', ['Ramassage détritus aux abords des entrées', 'Ramage déchets espaces verts'], [1]],
    ['HALLS', ['Nettoyage interphone', 'Nettoyage interrupteurs', 'Nettoyage vitreries', "Enlèvement toiles d’araignées", 'Dépoussiérage plinthes', 'Nettoyage des ascenseurs', 'nettoyage des boites aux lettres', 'Aspiration des sols carrelés et paillassons', 'Lavages sols carrelés'], [0, 3]],
    ['ETAGES', ['Aspiration ou Balayage des sols', 'Lavage des sols', 'Dépoussiérage des plinthes', 'Nettoyages interrupteurs', 'Nettoyage portes de services', "Enlèvement toiles d’araignées"], [2, 4]],
    ['ESCALIERS\nET ACCES\nSOUS SOLS', ['Aspiration ou balayage des sols', 'Lavage des sols', "Enlèvement des toiles d’araignées", 'Dépoussiérage des rampes et gardes corps'], [1]]
  ];
  const data = [['LE CLOS ATLANTA'], ['Prestations / jours/ bâtiments', '', 'Lundi', 'Mardi', 'mercredi', 'Jeudi', 'Vendredi']];
  const merges = ['A1:G1', 'A2:B2'], expected = [];
  for (const [zone, tasks, days] of groups) {
    const start = data.length + 1;
    tasks.forEach((task, i) => {
      data.push([i === 0 ? zone : '', task, ...Array.from({length: 5}, (_, d) => days.includes(d) ? '×' : '')]);
      expected.push([zone.replace(/\n/g, ' '), task, days.map(d => ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'][d])]);
    });
    merges.push(`A${start}:A${data.length}`);
  }
  for (const type of ['xlsx', 'xls']) {
    const res = await parse(sheet(data, merges), type);
    assert.equal(res.rows.length, 21);
    assert.deepEqual(res.rows.map(x => [x.zone, x.prestation, x.jours]), expected);
    assert.equal(res.mergedGroups, 0, 'merged zones must not merge their distinct tasks');
  }
});
test('shared task header spanning spare columns resolves the populated task column', async () => {
  const res = await parse(sheet([
    ['', 'Prestations / jours / bâtiments', '', '', 'Lundi', 'Vendredi'],
    ['', 'HALLS', 'Lavage des sols', '', 'x', ''],
    ['', '', 'Dépoussiérage des plinthes', '', '', 'x']
  ], ['B1:D1', 'B2:B3']));
  assert.deepEqual(res.rows.map(x => [x.zone, x.prestation]), [['HALLS', 'Lavage des sols'], ['HALLS', 'Dépoussiérage des plinthes']]);
});
test('recognizes an unlabelled zone beside a conventional task header', async () => {
  const res = await parse(sheet([['', 'Prestations', 'Lundi', 'Jeudi'], ['HALLS', 'Lavage', 'x'], ['', 'Vitres', '', 'x']], ['A2:A3']));
  assert.deepEqual(res.rows.map(x => x.zone), ['HALLS', 'HALLS']);
});
test('infers varied maintenance matrices without relying on a particular heading or task', async () => {
  for (const heading of ['Programme d’entretien / secteurs', 'Planning des passages', 'Prestations / jours / bâtiments']) {
    for (const type of ['xlsx', 'xls']) {
      const res = await parse(sheet([
        [heading, '', 'Ven.', 'Lu.', 'Me.'],
        ['BÂTIMENT NORD', 'Désinfection des poignées', 'x', '', 'x'],
        ['', 'Sortie des bacs', '', 'x', ''],
        ['COUR INTÉRIEURE', 'Ramassage des feuilles', 'x', '', '']
      ], ['C6:D6', 'C7:C8'], 'C6'), type);
      assert.deepEqual(res.rows.map(x => [x.zone, x.prestation, x.jours]), [
        ['BÂTIMENT NORD', 'Désinfection des poignées', ['mercredi', 'vendredi']],
        ['BÂTIMENT NORD', 'Sortie des bacs', ['lundi']],
        ['COUR INTÉRIEURE', 'Ramassage des feuilles', ['vendredi']]
      ]);
    }
  }
});
test('infers text columns from a days-only heading and retains separate zone groups', async () => {
  const res = await parse(sheet([
    ['', '', 'Lundi', 'Mardi', 'Mercredi'],
    ['GARAGES', 'Balayage', '', 'x', ''],
    ['', 'Vidage des corbeilles', 'x', '', ''],
    ['SAS', 'Nettoyage des portes', '', '', 'x']
  ], ['A2:A3']));
  assert.deepEqual(res.rows.map(x => [x.zone, x.prestation]), [['GARAGES', 'Balayage'], ['GARAGES', 'Vidage des corbeilles'], ['SAS', 'Nettoyage des portes']]);
});
test('does not turn a staff availability matrix into cleaning tasks', async () => {
  const res = await parse(sheet([['Nom', 'Prénom', 'Lundi', 'Mardi'], ['Dupont', 'Claire', 'x', ''], ['Martin', 'Paul', '', 'x']]));
  assert.equal(res.rows.length, 0);
});
test('recognizes offset tables, accents, XLSX and legacy XLS', async () => {
  for (const type of ['xlsx', 'xls']) {
    const r = await parse(sheet([['Zones', 'Nature des prestations', 'Fréquence'], ['Entrée', 'Lavage du sol', 'Trimestriel']], [], 'C5'), type);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].zone, 'Entrée');
    assert.equal(r.rows[0].frequenceType, 'trimestriel');
  }
});
test('keeps all tasks in a vertically merged zone, with short day labels', async () => {
  const r = await parse(sheet([['Zone', 'Prestation', 'Lu', 'Ma', 'Me', 'Je', 'Ve'], ['Hall', 'Balayage', 'x'], ['', 'Lavage', '', '', '', '', true]], ['A2:A3']));
  assert.deepEqual(r.rows.map(x => x.zone), ['Hall', 'Hall']);
  assert.deepEqual(r.rows.map(x => x.jours), [['lundi'], ['vendredi']]);
});
test('ignores a merged zone banner and carries its zone to following tasks', async () => {
  const r = await parse(sheet([['Zone', 'Prestation', 'Lundi', 'Vendredi'], ['HALL'], ['', 'Lavage du sol', 'x'], ['LOCAL POUBELLES'], ['', 'Désinfection', '', 'x']], ['A2:D2', 'A4:D4']));
  assert.deepEqual(r.rows.map(x => [x.zone, x.prestation]), [['HALL', 'Lavage du sol'], ['LOCAL POUBELLES', 'Désinfection']]);
});
test('one vertically merged task collects its days and observations once', async () => {
  const r = await parse(sheet([['Zone', 'Prestation', 'Lundi', 'Vendredi', 'Observations'], ['Hall', 'Lavage\ndu sol', 'x', '', 'Entrée'], ['', '', '', '✓', 'Étage']], ['A2:A3', 'B2:B3']));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].prestation, 'Lavage du sol');
  assert.deepEqual(r.rows[0].jours, ['lundi', 'vendredi']);
  assert.equal(r.rows[0].observations, 'Entrée · Étage');
});
test('repeated unmerged tasks with different schedules remain separate', async () => {
  const r = await parse(sheet([['Zone', 'Prestation', 'Fréquence'], ['Hall', 'Vitres', 'Mensuel'], ['', 'Vitres', 'Annuel']]));
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows.map(x => x.frequenceType), ['mensuel', 'annuel']);
});
test('reads multirow headings and distinguishes the two M columns', async () => {
  const r = await parse(sheet([['Zone', 'Prestation', 'Jours de passage'], ['', '', 'L', 'M', 'M', 'J', 'V', 'S', 'D'], ['Hall', 'Lavage', '', 'x', 'x', '', '', '', 'x']], ['A1:A2', 'B1:B2', 'C1:I1']));
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.rows[0].jours, ['mardi', 'mercredi', 'dimanche']);
});
test('ignores title rows and repeated headers and accepts reordered columns', async () => {
  const r = await parse(sheet([['CAHIER DES CHARGES'], ['Zone', 'Prestation', 'Lundi'], ['Hall', 'Sol', 'x'], ['Zone', 'Prestation', 'Lundi'], ['Étage', 'Vitres', ''], ['Prestation', 'Vendredi', 'Zone'], ['Portes', 'x', 'Entrée']], ['A1:C1']));
  assert.deepEqual(r.rows.map(x => x.prestation), ['Sol', 'Vitres', 'Portes']);
  assert.equal(r.rows[2].zone, 'Entrée');
  assert.deepEqual(r.rows[2].jours, ['vendredi']);
});
test('reads textual days, day ranges and frequency checkboxes', async () => {
  const r = await parse(sheet([['Zone', 'Prestation', 'Jours de passage', 'Mensuel', 'Trimestriel'], ['Hall', 'Sol', 'du lundi au vendredi'], ['', 'Vitres', '', '', 'x'], ['', 'Portes', 'Lun. / Jeu.', 'x']]));
  assert.deepEqual(r.rows[0].jours, ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);
  assert.equal(r.rows[1].frequenceType, 'trimestriel');
  assert.deepEqual(r.rows[2].jours, ['lundi', 'jeudi']);
  assert.equal(r.rows[2].frequenceType, 'mensuel');
});
test('does not infer the number column as the zone or import totals', async () => {
  const r = await parse(sheet([['N°', 'Prestation', 'Fréquence'], [1, 'Lavage', 'Hebdomadaire'], [2, 'Total', ''], [3, 'Signature', '']]));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].zone, '');
});
test('reads headers below row 30 and ignores unrelated worksheets', async () => {
  const data = Array.from({length: 40}, () => []);
  data.push(['Zone', 'Prestation', 'Lundi'], ['Hall', 'Lavage', 'x']);
  const r = await parse(sheet(data), 'xlsx', [['Contacts', sheet([['Nom', 'Téléphone'], ['Client', '0123456789']])]]);
  assert.equal(r.rows.length, 1);
  assert.ok(r.warnings.some(x => x.includes('Contacts')));
});
test('ignores formatting-only cells far below the table', async () => {
  const ws = sheet([['Zone', 'Prestation'], ['Hall', 'Sol']]);
  ws['!ref'] = 'A1:XFD1048576';
  const w = app();
  // Bypass serialization, which expands !ref itself: this is the decoded worksheet boundary.
  w.XLSX = {...X, read: () => ({SheetNames: ['Prestations'], Sheets: {Prestations: ws}})};
  const r = await w.InovtecCdcImportParsers.excel({arrayBuffer: async () => new Uint8Array(1)});
  assert.equal(r.rows.length, 1);
});
test('Excel row boundaries survive the shared import preparation', () => {
  const w = app();
  const rows = [{zone: 'Hall', prestation: 'Nettoyage'}, {zone: 'Hall', prestation: 'des vitres'}];
  const r = w.InovtecCdcImport.prepareRows({sourceType: 'excel', rows});
  assert.equal(r.rows.length, 2);
  const pdf = w.InovtecCdcImport.prepareRows({sourceType: 'pdf', rows});
  assert.equal(pdf.rows.length, 1);
});

test('confirmation preserves manual entries and cannot change target or batch while saving', async () => {
  const elements = new Map();
  for (const id of ['ivCdcImpCss', 'ivCdcFile', 'ivImpX', 'ivImpCancel', 'ivImpMode', 'ivImpGo', 'ivImpS']) elements.set(id, {id});
  const doc = {getElementById: id => elements.get(id), createElement: () => ({}), body: {appendChild: el => elements.set(el.id, el)}};
  elements.get('ivImpMode').value = 'replace_imported';
  const saved = [], timers = [];
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const db = {
    collection: name => ({doc: id => ({name, id})}),
    runTransaction: async fn => { await waiting; return fn({
      get: async () => ({exists: true, data: () => ({cahierDesChargesV1: {rows: [
        {id: 'manual', sourceType: 'manual', prestation: 'Saisie manuelle', ordre: 10},
        {id: 'previous', sourceType: 'excel', prestation: 'Ancien import', ordre: 20}
      ]}})}),
      update: (ref, value) => saved.push({ref, value})
    });}
  };
  const w = {firebase: {firestore: () => db, auth: () => ({currentUser: {uid: 'test'}})}};
  const context = vm.createContext({window: w, document: {getElementById: () => null}, location: {search: '?mode=infos'}, URLSearchParams, console, setTimeout: fn => timers.push(fn)});
  const code = fs.readFileSync(path.join(root, 'inovtec-cdc-importer.js'), 'utf8').replace('window.InovtecCdcImport={freq,', 'window.InovtecCdcImport={commit,ui,setPending:value=>{pending=value},freq,');
  vm.runInContext(code, context);
  w.InovtecCdcImport.ui(doc);
  elements.get('ivCdcImp').hidden = false;
  const imported = w.InovtecCdcImport.clean({zone: 'Hall', prestation: 'Lavage du sol', jours: ['lundi'], frequence: ''});
  w.InovtecCdcImport.setPending({targetSiteId: 'chantier-A', targetSiteName: 'Chantier A', rows: [imported], sourceType: 'excel', fileName: 'cdc.xlsx', fileType: ''});
  const save = w.InovtecCdcImport.commit(doc);
  assert.equal(saved.length, 0);
  assert.equal(elements.get('ivImpCancel').disabled, true);
  elements.get('ivImpCancel').onclick();
  assert.equal(elements.get('ivCdcImp').hidden, false); // cancel stays locked during the transaction
  await w.InovtecCdcImport.commit(doc); // rapid double click must not enqueue another transaction
  release();await save;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].ref.id, 'chantier-A');
  const rows = saved[0].value['cahierDesChargesV1.rows'];
  assert.deepEqual(Array.from(rows, x => x.prestation), ['Saisie manuelle', 'Lavage du sol']);
  assert.deepEqual(Array.from(rows[1].jours), ['lundi']);
  timers.forEach(fn => fn());
  assert.equal(elements.get('ivImpCancel').disabled, false);
});

test('bundled reader loads once for concurrent imports and allows retry after an error', async () => {
  const scripts = [], w = {};
  const ctx = vm.createContext({window: w, document: {currentScript: {src: 'https://example.test/DASHBOARD/inovtec-cdc-import-excel.js?v=2'}, createElement: () => ({remove() {}}), head: {appendChild: el => scripts.push(el)}}, URL, setTimeout, clearTimeout});
  vm.runInContext(fs.readFileSync(path.join(root, 'inovtec-cdc-import-excel.js'), 'utf8'), ctx);
  const empty = {arrayBuffer: async () => new Uint8Array(1)};
  const a = w.InovtecCdcImportParsers.excel(empty);
  const b = w.InovtecCdcImportParsers.excel(empty);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://example.test/DASHBOARD/vendor/xlsx-0.18.5.full.min.js');
  const failed = Promise.allSettled([a, b]);scripts[0].onerror();
  assert.ok((await failed).every(r => r.status === 'rejected'));
  const retry = w.InovtecCdcImportParsers.excel(empty);
  w.XLSX = {...X, read: () => ({SheetNames: []})};
  scripts[1].onload();
  assert.equal((await retry).rows.length, 0);
});
