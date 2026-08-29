(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const loginScreen = $("loginScreen");
  const appShell = $("appShell");
  const frame = $("kontrolFrame");
  const archiveModal = $("archiveModal");
  const archiveList = $("archiveList");
  const toast = $("toast");
  const WORKING_DRAFT_KEY = "cq_app_state_bottomnote_v1";
  const CLOUD_DRAFT_META_KEY = "iv_cloud_meta_kontrol";
  let toastTimer = null;
  let frameLoaded = false;

  if (!window.INOVTEC_FIREBASE_CONFIG || !window.firebase) {
    $("loginError").textContent = "Configuration Firebase introuvable.";
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(window.INOVTEC_FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  const SHARED_CHUNK_SIZE = 180000;
  const DIRECT_CONTROL_TYPE = "kontrolControlRecord";
  const DIRECT_PHOTO_CHUNK_TYPE = "kontrolControlPhotoChunk";
  const DIRECT_PHOTO_CHUNK_SIZE = 180000;
  const MAX_DIRECT_PHOTOS = 20;
  const MAX_DIRECT_PHOTO_CHARS = 18 * 1024 * 1024;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast" + (isError ? " error" : "");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 5000);
  }

  function clearWorkingDraft() {
    try {
      localStorage.removeItem(WORKING_DRAFT_KEY);
      localStorage.removeItem(CLOUD_DRAFT_META_KEY);
    } catch (error) {
      console.warn("Impossible de vider le brouillon KONTROL", error);
    }
  }

  function controlWorkspaceNodes(doc) {
    return [
      doc.getElementById("tasksCard"),
      doc.getElementById("summaryCard"),
      doc.getElementById("obs")?.closest("section.card"),
      doc.getElementById("ctrlNotes")?.closest("section.card"),
      doc.getElementById("photosCard"),
      doc.querySelector(".sticky-actions")
    ].filter(Boolean);
  }

  function updateControlWorkspaceVisibility(doc) {
    const site = doc.getElementById("site");
    const visible = !!site?.value?.trim();
    controlWorkspaceNodes(doc).forEach(node => {
      node.hidden = !visible;
      node.setAttribute("aria-hidden", visible ? "false" : "true");
    });
  }

  function prepareFreshControl() {
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      if (doc.body.dataset.ivFreshControlPrepared === "1") {
        updateControlWorkspaceVisibility(doc);
        return;
      }
      doc.body.dataset.ivFreshControlPrepared = "1";

      ["date", "heure", "site", "agents", "controleur", "obs", "ctrlNotes"].forEach(id => {
        const field = doc.getElementById(id);
        if (!field) return;
        field.value = "";
        field.setAttribute("autocomplete", "off");
        field.dispatchEvent(new Event("input", { bubbles:true }));
      });

      const newTask = doc.getElementById("newTaskInput");
      if (newTask) newTask.value = "";

      const site = doc.getElementById("site");
      if (site) {
        const refresh = () => updateControlWorkspaceVisibility(doc);
        site.addEventListener("input", refresh);
        site.addEventListener("change", refresh);
      }
      doc.getElementById("importFile")?.addEventListener("change", () => {
        setTimeout(() => updateControlWorkspaceVisibility(doc), 120);
      });

      const saveControlBtn = doc.getElementById("pdfBtn");
      if (saveControlBtn && saveControlBtn.dataset.ivDirectHistoryBound !== "1") {
        saveControlBtn.dataset.ivDirectHistoryBound = "1";
        saveControlBtn.textContent = "Enregistrer + PDF";
        saveControlBtn.title = "Enregistrer ce contrôle dans l’historique du chantier puis générer le PDF";
        saveControlBtn.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (saveControlBtn.disabled) return;
          saveControlBtn.disabled = true;
          const oldText = saveControlBtn.textContent;
          saveControlBtn.textContent = "Enregistrement…";
          showToast("Enregistrement du contrôle dans le chantier…");
          try {
            await saveControlDirect();
            saveControlBtn.textContent = "Génération du PDF…";
            showToast("Contrôle enregistré. Génération du PDF…");
            const child = frame.contentWindow;
            if (!child) throw new Error("La fenêtre KONTROL n’est pas disponible pour générer le PDF");
            const generate = child.InovtecGenerateControlPdf;
            if (typeof generate !== "function") throw new Error("La fonction PDF KONTROL n’est pas prête. Recharge KONTROL et réessaie.");
            child.__INOVTEC_SKIP_CLOUD_ARCHIVE_ONCE__ = true;
            const pdfResult = await generate();
            if (!pdfResult?.ok) throw new Error("Le PDF KONTROL n’a pas pu être généré correctement");
            saveControlBtn.textContent = "Enregistré + PDF ✓";
            showToast("Contrôle enregistré et PDF généré avec "+String(pdfResult.photoCount||0)+" photo"+((pdfResult.photoCount||0)>1?"s":"")+".");
            setTimeout(() => {
              if (saveControlBtn.isConnected) saveControlBtn.textContent = oldText;
            }, 2200);
          } catch (error) {
            console.error("Enregistrement direct KONTROL impossible", error);
            saveControlBtn.textContent = "Réessayer";
            showToast(error?.message || "Impossible d’enregistrer le contrôle.", true);
          } finally {
            saveControlBtn.disabled = false;
          }
        }, true);
      }

      updateControlWorkspaceVisibility(doc);
    } catch (error) {
      console.warn("Préparation du contrôle vierge impossible", error);
    }
  }

  function safeFileName(name) {
    return String(name || "Controle_Qualite.pdf")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 180);
  }

  function hash(value) {
    const s = String(value || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Lecture PDF impossible"));
      reader.readAsDataURL(blob);
    });
  }

  async function resolveChantierId(details) {
    const direct = String(details?.chantierId || "").trim();
    if (direct) {
      try {
        const snap = await db.collection("chantiers").doc(direct).get();
        if (snap.exists && !snap.data()?._hidden) return direct;
      } catch {}
    }
    const siteName = String(details?.site || "").trim();
    if (!siteName) return "";
    try {
      const exact = await db.collection("chantiers").where("nom", "==", siteName).limit(10).get();
      const rows = exact.docs.filter(doc => !doc.data()?._hidden);
      if (rows.length === 1) return rows[0].id;
      const target = normalize(siteName);
      const allSites = await db.collection("chantiers").get();
      const matches = allSites.docs.filter(doc => {
        const data = doc.data() || {};
        return !data._hidden && normalize(data.nom) === target;
      });
      return matches.length === 1 ? matches[0].id : "";
    } catch (error) {
      console.warn("Résolution chantier KONTROL impossible", error);
      return "";
    }
  }

  async function writeSharedHistory(blob, path, cleanName, details, user) {
    const chantierId = await resolveChantierId(details);
    if (!chantierId) throw new Error("Impossible d’identifier le chantier du contrôle");
    const dataUrl = await readBlobAsDataUrl(blob);
    if (!dataUrl) throw new Error("PDF vide");
    const pdfId = "kpdf_" + hash(user.uid + "|" + path);
    const chunks = [];
    for (let i = 0; i < dataUrl.length; i += SHARED_CHUNK_SIZE) {
      chunks.push(dataUrl.slice(i, i + SHARED_CHUNK_SIZE));
    }
    if (!chunks.length) throw new Error("PDF vide");
    const chunkIds = chunks.map((_, i) => `__kontrol_pdf_chunk__${pdfId}_${String(i).padStart(3, "0")}`);
    for (let start = 0; start < chunks.length; start += 20) {
      const batch = db.batch();
      chunks.slice(start, start + 20).forEach((data, offset) => {
        const index = start + offset;
        batch.set(db.collection("chantiers").doc(chunkIds[index]), {
          _hidden: true,
          _type: "kontrolPdfChunk",
          pdfId,
          chunkIndex: index,
          totalChunks: chunks.length,
          data
        });
      });
      await batch.commit();
    }
    const now = new Date().toISOString();
    const createdAtMs = Date.now();
    const metaDocId = "__kontrol_pdf_meta__" + pdfId;
    const batch = db.batch();
    batch.set(db.collection("chantiers").doc(metaDocId), {
      _hidden: true,
      _type: "kontrolPdfMeta",
      pdfId,
      chunkIds,
      originalName: cleanName,
      size: Number(blob.size) || 0,
      contentType: "application/pdf",
      timeCreated: now,
      createdAtMs,
      createdByUid: user.uid,
      createdByEmail: user.email || "",
      chantierId,
      storagePath: path,
      customMetadata: {
        originalName: cleanName,
        site: String(details.site || "").slice(0, 220),
        chantierId,
        controlDate: String(details.controlDate || "").slice(0, 30),
        controller: String(details.controller || "").slice(0, 160),
        agents: String(details.agents || "").slice(0, 220),
        category: String(details.category || "").slice(0, 80)
      }
    }, { merge: true });
    batch.set(db.collection("chantiers").doc(chantierId), {
      kontrolHistoryMetaIds: firebase.firestore.FieldValue.arrayUnion(metaDocId),
      kontrolHistoryUpdatedAtMs: createdAtMs
    }, { merge: true });
    await batch.commit();
    return { pdfId, chantierId, metaDocId };
  }

  function readKontrolMetadata() {
    try {
      const doc = frame.contentDocument;
      const siteField = doc.getElementById("site");
      return {
        site: siteField?.value?.trim() || "",
        chantierId: siteField?.dataset?.ivChantierId?.trim() || "",
        controlDate: doc.getElementById("date")?.value || "",
        controlTime: doc.getElementById("heure")?.value || "",
        controller: doc.getElementById("controleur")?.value?.trim() || "",
        agents: doc.getElementById("agents")?.value?.trim() || "",
        category: (doc.getElementById("activeCategoryPill")?.textContent || "").replace(/^Actif\s*:\s*/i, "").trim(),
        score: doc.getElementById("score")?.textContent?.trim() || "",
        observations: doc.getElementById("obs")?.value?.trim() || ""
      };
    } catch (error) {
      console.warn("Métadonnées KONTROL non lisibles", error);
      return { site:"", chantierId:"", controlDate:"", controlTime:"", controller:"", agents:"", category:"", score:"", observations:"" };
    }
  }

  function readKontrolTasks() {
    try {
      const doc = frame.contentDocument;
      return [...doc.querySelectorAll("#tasksBody tr[data-task-id]")].map(row => {
        const taskId = String(row.dataset.taskId || "");
        const title = row.querySelector(".task-title")?.textContent?.trim() || "";
        const status = row.querySelector('input[type="radio"]:checked')?.value || "";
        const commentRow = row.nextElementSibling?.classList?.contains("comment-row") ? row.nextElementSibling : null;
        const comment = commentRow?.querySelector("textarea")?.value?.trim() || "";
        return { taskId, title, status, comment };
      }).filter(x => x.title);
    } catch (error) {
      console.warn("Lecture des tâches KONTROL impossible", error);
      return [];
    }
  }

  function readKontrolPhotos() {
    const out = [];
    try {
      const raw = localStorage.getItem(WORKING_DRAFT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const photos = Array.isArray(parsed?.photos) ? parsed.photos : [];
      photos.slice(0, MAX_DIRECT_PHOTOS).forEach((ph, index) => {
        const dataUrl = String(ph?.dataUrl || "");
        if (!dataUrl.startsWith("data:image/")) return;
        out.push({
          id: String(ph?.id || ("photo_" + index)),
          name: String(ph?.name || ("Photo " + (index + 1))).slice(0,160),
          caption: String(ph?.caption || "").slice(0,500),
          dataUrl
        });
      });
    } catch (error) {
      console.warn("Lecture des photos KONTROL depuis le brouillon impossible", error);
    }
    if (out.length) return out;
    try {
      const doc = frame.contentDocument;
      [...doc.querySelectorAll("#photosGrid .photo-card")].slice(0, MAX_DIRECT_PHOTOS).forEach((card,index)=>{
        const img = card.querySelector("img"), input = card.querySelector(".caption input");
        const dataUrl = String(img?.src || "");
        if (!dataUrl.startsWith("data:image/")) return;
        out.push({
          id: String(card.dataset.pid || ("photo_" + index)),
          name: "Photo " + (index + 1),
          caption: String(input?.value || "").slice(0,500),
          dataUrl
        });
      });
    } catch (error) {
      console.warn("Lecture des photos KONTROL depuis l’écran impossible", error);
    }
    return out;
  }

  async function writeControlPhotos(recordId, chantierId, photos) {
    const refs = [];
    let totalChars = 0;
    for (let index = 0; index < Math.min(photos.length, MAX_DIRECT_PHOTOS); index++) {
      const ph = photos[index];
      const dataUrl = String(ph?.dataUrl || "");
      if (!dataUrl.startsWith("data:image/")) continue;
      if (totalChars + dataUrl.length > MAX_DIRECT_PHOTO_CHARS) {
        console.warn("Limite photos KONTROL atteinte, les photos suivantes ne sont pas archivées");
        break;
      }
      totalChars += dataUrl.length;
      const chunks = [];
      for (let i = 0; i < dataUrl.length; i += DIRECT_PHOTO_CHUNK_SIZE) chunks.push(dataUrl.slice(i, i + DIRECT_PHOTO_CHUNK_SIZE));
      const photoId = "kphoto_" + hash(recordId + "|" + index + "|" + String(ph.id || ""));
      const chunkIds = chunks.map((_,chunkIndex)=>"__kontrol_control_photo_chunk__" + photoId + "_" + String(chunkIndex).padStart(3,"0"));
      for (let start = 0; start < chunks.length; start += 20) {
        const batch = db.batch();
        chunks.slice(start,start+20).forEach((data,offset)=>{
          const chunkIndex = start + offset;
          batch.set(db.collection("chantiers").doc(chunkIds[chunkIndex]),{
            _hidden:true,
            _type:DIRECT_PHOTO_CHUNK_TYPE,
            recordId,
            chantierId,
            photoId,
            photoIndex:index,
            chunkIndex,
            totalChunks:chunks.length,
            data
          });
        });
        await batch.commit();
      }
      refs.push({
        photoId,
        name:String(ph.name || ("Photo " + (index + 1))).slice(0,160),
        caption:String(ph.caption || "").slice(0,500),
        chunkIds,
        sizeChars:dataUrl.length
      });
    }
    return refs;
  }
  async function saveControlDirect() {
    const user = auth.currentUser;
    if (!user) throw new Error("Connexion Firebase requise");
    const details = readKontrolMetadata();
    const chantierId = await resolveChantierId(details);
    if (!chantierId) throw new Error("Choisis un chantier enregistré avant d’enregistrer le contrôle");
    const tasks = readKontrolTasks();
    const photos = readKontrolPhotos();
    const now = Date.now();
    const recordId = "__kontrol_control__" + hash([user.uid, chantierId, now, details.controlDate, details.controlTime].join("|"));
    const photoRefs = photos.length ? await writeControlPhotos(recordId, chantierId, photos) : [];
    const record = {
      _hidden: true,
      _type: DIRECT_CONTROL_TYPE,
      recordId,
      chantierId,
      site: String(details.site || "").slice(0,220),
      controlDate: String(details.controlDate || "").slice(0,30),
      controlTime: String(details.controlTime || "").slice(0,20),
      controller: String(details.controller || "").slice(0,160),
      agents: String(details.agents || "").slice(0,220),
      category: String(details.category || "").slice(0,80),
      score: String(details.score || "").slice(0,40),
      observations: String(details.observations || "").slice(0,4000),
      tasks: tasks.slice(0,250),
      photoRefs,
      photoCount: photoRefs.length,
      createdAtMs: now,
      timeCreated: new Date(now).toISOString(),
      createdByUid: user.uid,
      createdByEmail: user.email || "",
      source: "kontrol-direct-history-v1"
    };
    const batch = db.batch();
    batch.set(db.collection("chantiers").doc(recordId), record, { merge: true });
    batch.set(db.collection("chantiers").doc(chantierId), {
      kontrolHistoryRecordIds: firebase.firestore.FieldValue.arrayUnion(recordId),
      kontrolHistoryUpdatedAtMs: now
    }, { merge: true });
    await batch.commit();
    try {
      window.dispatchEvent(new CustomEvent("inovtec:kontrol-control-saved", { detail: { chantierId, recordId } }));
    } catch {}
    return { chantierId, recordId };
  }

  async function archivePdfBlob(blob, filename, details) {
    const user = auth.currentUser;
    if (!user || !blob) return;
    const cleanName = safeFileName(filename);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `kontrol/${user.uid}/pdfs/${stamp}_${cleanName}`;
    const ref = storage.ref().child(path);
    const chantierId = await resolveChantierId(details);
    const resolvedDetails = { ...details, chantierId };
    const metadata = {
      contentType: "application/pdf",
      contentDisposition: `inline; filename="${cleanName.replace(/"/g, "")}"`,
      customMetadata: {
        originalName: cleanName,
        site: String(resolvedDetails.site || "").slice(0, 220),
        chantierId: String(resolvedDetails.chantierId || "").slice(0, 120),
        controlDate: String(resolvedDetails.controlDate || "").slice(0, 30),
        controller: String(resolvedDetails.controller || "").slice(0, 160),
        agents: String(resolvedDetails.agents || "").slice(0, 220),
        category: String(resolvedDetails.category || "").slice(0, 80)
      }
    };
    showToast("Archivage du PDF et de l’historique…");
    await ref.put(blob, metadata);
    let shared = null;
    let sharedError = null;
    for (let attempt = 1; attempt <= 3 && !shared; attempt++) {
      try {
        shared = await writeSharedHistory(blob, path, cleanName, resolvedDetails, user);
      } catch (error) {
        sharedError = error;
        console.warn("Création historique KONTROL tentative " + attempt, error);
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 350 * attempt));
      }
    }
    try {
      if (shared) await ref.updateMetadata({
        customMetadata: {
          ...metadata.customMetadata,
          chantierId: shared.chantierId,
          sharedPdfId: shared.pdfId
        }
      });
    } catch (error) {
      console.error("Mise à jour des métadonnées KONTROL impossible", error);
    }
    if (!shared && sharedError) {
      console.error("Création directe de l’historique KONTROL impossible après 3 tentatives", sharedError);
    }
    try {
      window.dispatchEvent(new CustomEvent("inovtec:kontrol-pdf-archived", {
        detail: { path, chantierId: String(shared?.chantierId || resolvedDetails.chantierId || "") }
      }));
      if (shared) window.dispatchEvent(new CustomEvent("inovtec:kontrol-shared-archive-synced"));
    } catch {}
    if (shared) showToast("PDF archivé et ajouté à l’historique du chantier.");
    else showToast("PDF archivé, mais l’historique chantier n’a pas pu être confirmé.", true);
  }

  function hookPdfSave() {
    if (!frame.contentWindow) return;
    const child = frame.contentWindow;
    const api = child.jspdf?.jsPDF?.API;
    if (!api || api.__inovtecCloudHooked) return;
    const originalSave = api.save;
    if (typeof originalSave !== "function") return;

    api.save = function(filename, options) {
      const pdf = this;
      if (child.__INOVTEC_SKIP_CLOUD_ARCHIVE_ONCE__ === true) {
        child.__INOVTEC_SKIP_CLOUD_ARCHIVE_ONCE__ = false;
        return originalSave.call(pdf, filename, options);
      }
      let blob = null;
      try { blob = pdf.output("blob"); } catch (error) { console.warn("Création du PDF pour archivage impossible", error); }
      const details = readKontrolMetadata();
      if (!blob) return originalSave.call(pdf, filename, options);

      archivePdfBlob(blob, filename, details)
        .catch(error => {
          console.error("Archivage KONTROL impossible", error);
          showToast("L’archivage en ligne a échoué. Le PDF est tout de même téléchargé.", true);
        })
        .finally(() => {
          try { originalSave.call(pdf, filename, options); }
          catch (error) {
            console.error("Téléchargement du PDF KONTROL impossible", error);
            showToast("Le contrôle a été archivé, mais le téléchargement du PDF a échoué.", true);
          }
        });
      return pdf;
    };
    api.__inovtecCloudHooked = true;
  }

  frame.addEventListener("load", () => {
    if (frame.src && !frame.src.endsWith("about:blank")) {
      frameLoaded = true;
      prepareFreshControl();
      setTimeout(prepareFreshControl, 120);
      setTimeout(prepareFreshControl, 500);
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
      try{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)}catch(_e1){try{await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)}catch(_e2){try{await auth.setPersistence(firebase.auth.Auth.Persistence.NONE)}catch(_e3){}}}
      await auth.signInWithEmailAndPassword($("loginEmail").value.trim(), $("loginPassword").value);
    } catch (error) {
      $("loginError").textContent = "Connexion impossible : " + (error.message || "vérifie les identifiants.");
    }
  });

  auth.onAuthStateChanged(user => {
    if (user) {
      loginScreen.classList.add("hidden");
      appShell.classList.remove("hidden");
      if (!frameLoaded || !frame.src || frame.src.endsWith("about:blank")) {
        clearWorkingDraft();
        frame.src = "KONTROL.html?v=20260830-pdfphotos1";
      }
    } else {
      hideArchive();
      appShell.classList.add("hidden");
      loginScreen.classList.remove("hidden");
      frameLoaded = false;
      frame.src = "about:blank";
    }
  });
})();