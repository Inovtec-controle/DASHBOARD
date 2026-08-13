(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const loginScreen = $("loginScreen");
  const appShell = $("appShell");
  const frame = $("kontrolFrame");
  const archiveModal = $("archiveModal");
  const archiveList = $("archiveList");
  const toast = $("toast");
  let toastTimer = null;
  let frameLoaded = false;

  if (!window.INOVTEC_FIREBASE_CONFIG || !window.firebase) {
    $("loginError").textContent = "Configuration Firebase introuvable.";
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
  const auth = firebase.auth();
  const storage = firebase.storage();

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast" + (isError ? " error" : "");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 5000);
  }

  function safeFileName(name) {
    return String(name || "Controle_Qualite.pdf")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 180);
  }

  function readKontrolMetadata() {
    try {
      const doc = frame.contentDocument;
      return {
        site: doc.getElementById("site")?.value?.trim() || "",
        controlDate: doc.getElementById("date")?.value || "",
        controller: doc.getElementById("controleur")?.value?.trim() || "",
        agents: doc.getElementById("agents")?.value?.trim() || "",
        category: (doc.getElementById("activeCategoryPill")?.textContent || "").replace(/^Actif\s*:\s*/i, "").trim()
      };
    } catch (error) {
      console.warn("Métadonnées KONTROL non lisibles", error);
      return { site:"", controlDate:"", controller:"", agents:"", category:"" };
    }
  }

  async function archivePdfBlob(blob, filename, details) {
    const user = auth.currentUser;
    if (!user || !blob) return;
    const cleanName = safeFileName(filename);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `kontrol/${user.uid}/pdfs/${stamp}_${cleanName}`;
    const ref = storage.ref().child(path);
    const metadata = {
      contentType: "application/pdf",
      contentDisposition: `inline; filename="${cleanName.replace(/"/g, "")}"`,
      customMetadata: {
        originalName: cleanName,
        site: String(details.site || "").slice(0, 220),
        controlDate: String(details.controlDate || "").slice(0, 30),
        controller: String(details.controller || "").slice(0, 160),
        agents: String(details.agents || "").slice(0, 220),
        category: String(details.category || "").slice(0, 80)
      }
    };
    showToast("Archivage du PDF en ligne…");
    await ref.put(blob, metadata);
    showToast("PDF téléchargé et archivé en ligne.");
  }

  function hookPdfSave() {
    if (!frame.contentWindow) return;
    const child = frame.contentWindow;
    const api = child.jspdf?.jsPDF?.API;
    if (!api || api.__inovtecCloudHooked) return;
    const originalSave = api.save;
    if (typeof originalSave !== "function") return;

    api.save = function(filename, options) {
      let blob = null;
      try { blob = this.output("blob"); } catch (error) { console.warn("Création du PDF pour archivage impossible", error); }
      const details = readKontrolMetadata();
      const result = originalSave.call(this, filename, options);
      if (blob) {
        archivePdfBlob(blob, filename, details).catch(error => {
          console.error("Archivage KONTROL impossible", error);
          showToast("Le PDF a été téléchargé, mais l’archivage en ligne a échoué.", true);
        });
      }
      return result;
    };
    api.__inovtecCloudHooked = true;
  }

  frame.addEventListener("load", () => {
    if (frame.src && !frame.src.endsWith("about:blank")) {
      frameLoaded = true;
      hookPdfSave();
      setTimeout(hookPdfSave, 500);
      setTimeout(hookPdfSave, 1500);
    }
  });

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("fr-FR", { dateStyle:"short", timeStyle:"short" }).format(date);
  }

  async function openPdf(item) {
    const popup = window.open("about:blank", "_blank");
    try {
      const url = await item.getDownloadURL();
      if (popup) popup.location.replace(url);
      else window.location.href = url;
    } catch (error) {
      if (popup) popup.close();
      console.error(error);
      showToast("Impossible d’ouvrir ce PDF.", true);
    }
  }

  async function loadArchive() {
    const user = auth.currentUser;
    if (!user) return;
    archiveList.innerHTML = '<div class="archive-empty">Chargement…</div>';
    try {
      const root = storage.ref().child(`kontrol/${user.uid}/pdfs`);
      const result = await root.listAll();
      const entries = await Promise.all(result.items.map(async item => {
        try { return { item, meta: await item.getMetadata() }; }
        catch (error) { return { item, meta: {} }; }
      }));
      entries.sort((a,b) => new Date(b.meta.timeCreated || 0) - new Date(a.meta.timeCreated || 0));
      archiveList.innerHTML = "";
      if (!entries.length) {
        archiveList.innerHTML = '<div class="archive-empty">Aucun PDF KONTROL archivé pour le moment.</div>';
        return;
      }
      entries.forEach(({item, meta}) => {
        const custom = meta.customMetadata || {};
        const row = document.createElement("div");
        row.className = "archive-item";
        const main = document.createElement("div");
        main.className = "archive-main";
        const title = document.createElement("div");
        title.className = "archive-title";
        title.textContent = custom.site || custom.originalName || item.name;
        const details = document.createElement("div");
        details.className = "archive-meta";
        const bits = [custom.category, custom.controlDate, custom.agents, formatDateTime(meta.timeCreated)].filter(Boolean);
        details.textContent = bits.join(" • ") || item.name;
        const open = document.createElement("button");
        open.type = "button";
        open.className = "btn open-btn";
        open.textContent = "Consulter";
        open.addEventListener("click", () => openPdf(item));
        main.append(title, details);
        row.append(main, open);
        archiveList.appendChild(row);
      });
    } catch (error) {
      console.error(error);
      archiveList.innerHTML = '<div class="archive-empty">Impossible de charger les PDF archivés. Vérifie les droits Firebase Storage.</div>';
    }
  }

  function showArchive() {
    archiveModal.classList.remove("hidden");
    $("accountLabel").textContent = auth.currentUser?.email || "Compte connecté";
    loadArchive();
  }

  function hideArchive() {
    archiveModal.classList.add("hidden");
  }

  $("archiveBtn").addEventListener("click", showArchive);
  $("closeArchiveBtn").addEventListener("click", hideArchive);
  $("refreshArchiveBtn").addEventListener("click", loadArchive);
  $("logoutBtn").addEventListener("click", () => auth.signOut());
  archiveModal.addEventListener("click", event => { if (event.target === archiveModal) hideArchive(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") hideArchive(); });

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("loginError").textContent = "";
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.signInWithEmailAndPassword($("loginEmail").value.trim(), $("loginPassword").value);
    } catch (error) {
      $("loginError").textContent = "Connexion impossible : " + (error.message || "vérifie les identifiants.");
    }
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      loginScreen.classList.add("hidden");
      appShell.classList.remove("hidden");
      if (!frameLoaded || !frame.src || frame.src.endsWith("about:blank")) frame.src = "KONTROL.html";
    } else {
      hideArchive();
      appShell.classList.add("hidden");
      loginScreen.classList.remove("hidden");
      frameLoaded = false;
      frame.src = "about:blank";
    }
  });
})();
