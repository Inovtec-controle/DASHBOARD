import assert from "node:assert/strict";
import fs from "node:fs";

const cloud = fs.readFileSync("kontrol-cloud.js", "utf8");
const page = fs.readFileSync("KONTROL.html", "utf8");
const start = cloud.indexOf("  function checklistForSite(");
const end = cloud.indexOf("  async function saveChecklistForActiveSite(", start);
assert(start >= 0 && end > start, "Fonctions de listes introuvables");
const snippet = cloud.slice(start, end);
assert(!snippet.includes("db.collection("), "Chargement du gabarit dépendant de Firebase");

function fixture({ failCustom = false, failDefault = false } = {}) {
  const calls = [];
  let rows = 0;
  const field = { dataset: {} };
  const doc = {
    body: { dataset: {} },
    getElementById: () => field,
    querySelector: () => rows ? {} : null,
    querySelectorAll: () => ({ length: rows })
  };
  const api = {
    useDefaultChecklist() {
      calls.push("default");
      if (failDefault) throw Error("Défaut indisponible");
      rows = 34;
    },
    replaceChecklist(items) {
      calls.push("custom");
      if (failCustom) throw Error("Liste corrompue");
      rows = items.length;
    }
  };
  const before = [
    "let chantierReferences = [], activeChecklistSiteId = '';",
    "const frame = { contentDocument: doc };",
    "function checklistApi() { return api; }",
    "function setChecklistSource(_doc, mode) { calls.push('source:' + mode); }",
    "function showToast() { calls.push('toast'); }"
  ].join("\n");
  const code = [before, snippet, "return { applyChecklistForSite };"].join("\n");
  const { applyChecklistForSite } = new Function("api", "doc", "calls", code)(api, doc, calls);
  return { applyChecklistForSite, doc, calls };
}

for (const [site, expected] of [
  [{ id: "sans" }, "default"],
  [{ id: "non", kontrolChecklistV1: { customized: false } }, "default"],
  [{ id: "vide", kontrolChecklistV1: { customized: true, items: [] } }, "default"],
  [{ id: "invalide", kontrolChecklistV1: { customized: true, items: null } }, "default"],
  [{ id: "perso", kontrolChecklistV1: { customized: true, items: ["Hall", "Escalier"] } }, "custom"]
]) {
  const test = fixture();
  assert.equal(test.applyChecklistForSite(site, test.doc), true);
  assert.equal(test.calls[0], expected);
  assert.equal(test.doc.body.dataset.ivChecklistLoadedFor, site.id);
  const before = test.calls.length;
  assert.equal(test.applyChecklistForSite(site, test.doc), true);
  assert.equal(test.calls.length, before, "Ne pas effacer les réponses du même chantier");
}

const other = fixture();
assert(other.applyChecklistForSite({ id: "a" }, other.doc));
assert(other.applyChecklistForSite({ id: "b" }, other.doc));
assert.equal(other.calls.filter(x => x === "default").length, 2);

const recovery = fixture({ failCustom: true });
assert(recovery.applyChecklistForSite({ id: "corrompu", kontrolChecklistV1: { customized: true, items: ["Point"] } }, recovery.doc));
assert.deepEqual(recovery.calls.slice(0, 3), ["custom", "default", "source:default"]);

const failed = fixture({ failDefault: true });
assert.equal(failed.applyChecklistForSite({ id: "ko" }, failed.doc), false);
assert.equal(failed.doc.body.dataset.ivChecklistLoadedFor, "");

assert(page.includes("document.createDocumentFragment()"));
assert(page.includes("els.tasksBody.replaceChildren(fragment)"));
assert(/saveControlBtn\.addEventListener\(["']click/.test(cloud));
assert(cloud.includes("saveControlDirect()"));

console.log("KONTROL : 5 types de gabarit, changement de résidence, secours, échec et sauvegarde PDF OK");
