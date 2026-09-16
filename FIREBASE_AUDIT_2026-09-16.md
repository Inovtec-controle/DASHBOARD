# Audit des connexions Firebase — 16 septembre 2026

## Portée et niveau de preuve

Audit des fichiers du dépôt `Inovtec-controle/DASHBOARD`, des parcours de navigation et de tests Chromium avec des données fictives. **Aucun accès authentifié au projet Firebase réel ni aux données de production n'a été utilisé** : la présence d'un accès dans le code, la réussite des tests GitHub et un déploiement GitHub Pages ne prouvent pas une écriture puis une relecture effectives pour chaque rubrique. Les règles `firestore.rules` et `storage.rules` présentes dans le dépôt ne prouvent pas que ces mêmes règles sont publiées dans Firebase.

| Rubrique | Connexion prévue dans le code | Portée et observations |
| --- | --- | --- |
| Classeur agents | Firestore `kanban/{uid}.moduleSyncV1.agents` et espace partagé, référentiel `InovtecDataHub` | Identifiants d'agents repris dans les autres rubriques ; les suppressions utilisent des marqueurs `_deleted`. Aucun essai connecté au compte réel. |
| Planning / heures | Firestore `kanban/{uid}.moduleSyncV1`, mécanismes de partage et copie locale | Parcours navigateur et modification / report pair-impair testés avec données fictives. La sauvegarde réelle sur un autre appareil n'a pas été vérifiée. |
| Infos chantier / cahier des charges | Collection Firestore `chantiers`, scripts du référentiel et de persistance | Source commune des chantiers et de leurs cahiers des charges. Les anciennes copies locales sont des solutions de repli ; aucune vérification réelle de cohérence multi-appareils. |
| Congés / absences | Firestore `kanban/{uid}.moduleSyncV1.conges` et relais dans l'espace partagé | Lecture et écriture programmées, **risque restant** : un instantané distant remplace la liste locale sans résoudre une modification en attente ; une fusion naïve ferait réapparaître des suppressions. |
| Variables agents | Firestore `kanban/{uid}.moduleSyncV1.variables`, relié aux agents et aux congés | Lecture/écriture prévues ; dashboard et accès à l'éditeur testés en navigateur sans données réelles. |
| Organisation | Tâches personnelles `kanban/{uid}.tasks` et tâches du document partagé `chantiers/__inovtec_shared_workspace_v1__` | **Correctif appliqué** : migration de tâches locales vers le document personnel seulement si aucune liste personnelle ni partagée n'existe. Quatre scénarios automatisés avec fausse connexion Firebase passent, y compris une liste partagée volontairement vide. |
| Matériel / fournisseurs | Firestore `kanban/{uid}.moduleSyncV1.materiel` | **Personnel au compte Firebase** : la connexion ne signifie pas que l'inventaire est partagé entre comptes distincts. **Risque restant** : une réponse distante peut remplacer une modification locale avant son envoi différé. |
| KONTROL / historique / photos | Documents et fragments Firestore `chantiers` (`kontrolControlRecord`, `kontrolPdfMeta`, fragments de PDF/photos) + copie PDF Storage `kontrol/{uid}/pdfs/...` | L'historique partagé dépend de la confirmation de l'écriture Firestore ; le PDF conservé dans Storage appartient au compte auteur selon les règles du dépôt. L'application peut afficher « PDF archivé, mais historique chantier non confirmé » si l'écriture partagée échoue. |
| Discipline | Document partagé `chantiers/__inovtec_shared_discipline_v1__` et Storage personnel pour pièces jointes | Chemins de partage présents dans le code. L'accès aux fichiers par un autre compte doit être vérifié selon les règles réellement déployées et le parcours de lecture. |
| Tableaux de bord / données communes | Lectures Firestore des modules et documents de référence | Indicateurs dérivés des données récupérées ; ce ne sont pas des écritures indépendantes pour chaque compteur. |
| Calculatrices de temps, salaire, essence | Calcul dans le navigateur | Pas de sauvegarde Firebase requise pour un résultat ponctuel selon le fonctionnement actuel ; ne pas confondre absence de synchronisation avec un bug. |

## Corrections et vérifications appliquées

- `inovtec-firebase-indicator.js` : un simple utilisateur authentifié ne suffit plus pour annoncer une connexion opérationnelle ; l'état « Firebase accessible » nécessite une lecture Firestore confirmée par `inovtec-firebase-operational-guard.js`. Même dans ce cas, le voyant ne garantit pas qu'un **enregistrement de la rubrique** a réussi.
- `ORGA-LEGACY.html` : la récupération de tâches locales vers Firebase n'est plus bloquée par le drapeau de réception distante, et les listes déjà présentes (y compris une liste partagée vide) ne sont pas remplacées par la copie locale.
- `tests/firebase-org-migration.mjs` est intégré au workflow `browser-smoke.yml` : reprise locale, préservation du partagé, non-réapparition d'une suppression et priorité aux tâches personnelles existantes. Tous les scénarios utilisent des données fictives et un service Firebase simulé.
- Les contrôles statiques `firebase-operational-health.yml`, les audits de pages et les tests navigateur ont passé sur le commit de test du 16/09/2026. Leur portée est le code et la simulation, pas la production.

## Points non certifiés ou à traiter sans risque sur les données

1. Effectuer, dans **une session réelle autorisée**, une écriture suivie d'une lecture depuis un second appareil pour chaque rubrique métier. Tester également la déconnexion, la reconnexion, deux modifications concurrentes et la suppression. Ne pas utiliser les données réelles comme jeu de test destructif.
2. Vérifier dans la console Firebase les règles Firestore/Storage **effectivement publiées**, les permissions de chaque compte, la capacité Storage et les erreurs de la console navigateur ; les fichiers de règles dans GitHub ne constituent pas une preuve de déploiement.
3. Matériel et Congés : définir une résolution de conflits qui préserve les modifications en attente **et** les suppressions (révisions, opérations atomiques ou marqueurs de suppression) avant de modifier leur fusion. L'audit a identifié le risque mais n'a pas appliqué de fusion potentiellement destructrice.
4. Confirmer si le matériel doit être commun à **tous les comptes** ou uniquement synchronisé entre appareils d'un même compte. Le code actuel correspond au second cas.
5. Tester un PDF KONTROL avec photos créé sous un compte puis consulté depuis un autre compte autorisé : vérifier distinctement le document partagé Firestore et la copie Storage personnelle.

**Conclusion limitée à ce qui a été vérifié :** les chemins Firebase existent pour les modules métier inventoriés, mais il serait incorrect de déclarer que « tout est synchronisé sans erreur » en l'absence de test connecté, de contrôle des règles effectivement déployées et de résolution des risques de concurrence signalés.
