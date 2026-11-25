/*
 * Chargeur unique des dépendances du shell INOVTEC.
 *
 * IMPORTANT : ordre historique préservé (Firebase, données, ponts métier,
 * interface). Ce script est chargé pendant l'analyse du HTML ; document.write
 * conserve l'exécution synchrone des anciens modules, sans démarrer de requête
 * Firebase supplémentaire ni déplacer les données.
 *
 * Pour ajouter une dépendance, l'inscrire ici à sa place dans le flux.
 * Ne plus ajouter de blocs conditionnels <script> dans inovtec-page-shell.html.
 */
(function () {
  'use strict';

  var mode = (new URLSearchParams(location.search).get('mode') || '').toLowerCase();
  var manifest = [
    { src: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js' },
    { src: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js' },
    { src: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js' },
    { src: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js', modes: ['agents'] },
    { src: 'firebase-config.js?v=20261014-mobile-connect1' },
    { src: 'inovtec-data-hub.js?v=20261009-performance1' },
    { src: 'inovtec-agents-firebase-direct.js?v=20261113-agents-restsave1', modes: ['agents'] },
    { src: 'inovtec-cloud-sync.js?v=20260927-authfix1', except: ['agents', 'kontrol', 'planning'] },
    { src: 'inovtec-shared-workspace.js?v=20261002-orga-single-sync1', modes: ['planning', 'agents', 'heures', 'conges', 'organisation', 'discipline'] },
    { src: 'inovtec-variables-sync-bridge.js?v=20260917-variables-multisupport1', modes: ['variables'] },
    { src: 'inovtec-firebase-indicator.js?v=20261014-mobile-connect1' },
    { src: 'inovtec-info-auth-bridge.js?v=20260820-info-operational1', modes: ['infos'] },
    { src: 'inovtec-referential.js?v=20261009-performance1', modes: ['discipline', 'infos', 'heures', 'kontrol', 'organisation', 'planning', 'agents'] },
    { src: 'inovtec-cross-page-data.js?v=20261001-perf1', modes: ['heures', 'kontrol'] },
    { src: 'inovtec-visual-runtime.js?v=20260917-planning-live3' },
    { src: 'inovtec-info-actions-stable.js?v=20260818-stable2', modes: ['infos'] },
    { src: 'inovtec-orga-scroll-fix.js?v=20261002-drag10', modes: ['organisation'] },
    { src: 'inovtec-orga-archives-modal.js?v=20260818-1', modes: ['organisation'] },
    { src: 'inovtec-planning-pdf-action.js?v=20260814-2', modes: ['planning'] },
    { src: 'inovtec-hide-legacy-headers.js?v=20260814-2' },
    { src: 'inovtec-alphabetical-lists.js?v=20260829-agentstable1' },
    { src: 'inovtec-agent-contract-hours.js?v=20261113-agents-restsave1', modes: ['agents'] },
    { src: 'inovtec-agents-archive.js?v=20261113-agents-restsave1', modes: ['agents'] },
    { src: 'inovtec-conges-nav.js?v=20261012-no-duplicate1' },
    { src: 'inovtec-discipline-referential.js?v=20260816-1', modes: ['discipline'] },
    { src: 'inovtec-empty-initial-selection.js?v=20260927-agentsflow19', modes: ['agents'] },
    { src: 'inovtec-planning-launch-selection.js?v=20260927-planningrestore1', modes: ['planning'] },
    { src: 'inovtec-info-agent-planning.js?v=20260830-agentselector1', modes: ['infos'] },
    { src: 'inovtec-site-management-layout.js?v=20260829-persistence2', modes: ['infos'] },
    { src: 'inovtec-consommables-checklist.js?v=20260819-1', modes: ['infos'] },
    { src: 'inovtec-ampoules-checklist.js?v=20260819-1', modes: ['infos'] },
    { src: 'inovtec-container-schedule.js?v=20260829-persistence2', modes: ['infos'] },
    { src: 'inovtec-container-frequency-edit-fix.js?v=20260910-frequencyedit1', modes: ['infos'] },
    { src: 'inovtec-container-planning-link.js?v=20260927-containerbridge1', modes: ['planning'] },
    { src: 'inovtec-cahier-des-charges.js?v=20260904-observations1', modes: ['infos'] },
    { src: 'inovtec-cdc-source-formats.js?v=20260829-operational1', modes: ['infos'] },
    { src: 'inovtec-cdc-schedule-fields.js?v=20260904-editdays1', modes: ['infos'] },
    { src: 'inovtec-cdc-import-excel.js?v=20260904-excel4', modes: ['infos'] },
    { src: 'inovtec-cdc-import-pdf.js?v=20260815-1', modes: ['infos'] },
    { src: 'inovtec-cdc-importer.js?v=20260904-importui1', modes: ['infos'] },
    { src: 'inovtec-cdc-compact-columns.js?v=20260904-observations1', modes: ['infos'] },
    { src: 'inovtec-cdc-operational-fix.js?v=20261001-perf1', modes: ['infos'] },
    { src: 'inovtec-cdc-ui-hard-fix.js?v=20261001-perf1', modes: ['infos'] },
    { src: 'inovtec-kontrol-cdc-link.js?v=20261110-kontrol-gabarit-general1', modes: ['kontrol'] },
    { src: 'inovtec-info-layout.js?v=20261125-layout-one-observer1', modes: ['infos'] },
    { src: 'inovtec-info-contact-mode.js?v=20260829-idlock1', modes: ['infos'] },
    { src: 'inovtec-info-contract-fields.js?v=20260829-idlock1', modes: ['infos'] },
    { src: 'inovtec-info-persistence-stable.js?v=20261009-performance1', modes: ['infos'] },
    { src: 'inovtec-pdf-cdc-header-white.js?v=20260819-3', modes: ['infos'] },
    { src: 'inovtec-info-agent-pdf-v8.js?v=20261001-perf1', modes: ['infos'] },
    { src: 'inovtec-search-handoff.js?v=20260828-search1' }
  ];

  var html = '';
  var loaded = [];
  for (var i = 0; i < manifest.length; i++) {
    var entry = manifest[i];
    if (entry.modes && entry.modes.indexOf(mode) === -1) continue;
    if (entry.except && entry.except.indexOf(mode) !== -1) continue;
    loaded.push(entry.src);
    html += '<scr' + 'ipt src="' + entry.src + '"></scr' + 'ipt>';
  }

  // Visible en lecture seule depuis la console pour diagnostiquer les modules.
  window.INOVTEC_SHELL_LOADED_SCRIPTS = loaded;
  document.write(html);
})();
