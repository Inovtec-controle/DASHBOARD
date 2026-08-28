# Inovtec Dashboard — modèle de données partagé

Ce document décrit les sources uniques à utiliser entre les pages du Dashboard.

## Sources maîtres

### Agents — Classeur agents
Source canonique : module `agents` (`kontrol_agents_classeur_v2` / `moduleSyncV1.agents`).

Identifiant commun : `agentRefId` / `agentId` = ID du Classeur agents.

À réutiliser dans : Planning, Congés, Variables agents, Discipline, KONTROL, Organisation, Infos chantier (affichage dérivé du planning).

Données maîtres : identité, coordonnées, contrat, poste, date d'entrée, disponibilité, informations administratives et documents agent.

Une suppression crée une trace technique `_deleted` datée dans le module `agents`. Cette trace n'est jamais affichée comme un agent, mais elle est synchronisée afin d'empêcher une ancienne copie personnelle, partagée ou historique de restaurer la fiche supprimée.

### Chantiers — Infos chantier
Source canonique : collection Firestore `chantiers` (documents métier non `_hidden`).

Identifiant commun : `chantierId`.

À réutiliser dans : Planning, Variables agents, Discipline, KONTROL, Organisation.

Données maîtres : nom, adresse/GPS, accès, contacts, dates contrat, consignes, gestion technique, consommables, cahier des charges et planning conteneurs.

### Affectations — Planning
Source canonique : module `planning`.

Chaque intervention doit référencer `agentRefId` et `chantierId`. Infos chantier déduit les agents affectés depuis le planning ; il ne maintient pas une seconde affectation indépendante.

### Congés et absences
Source canonique : module `conges`.

Chaque période référence `agentRefId`. Les remplacements et la couverture sont calculés à partir du Planning. La page Variables agents lit et met à jour cette même source pour les éléments de paie liés aux absences, afin d'éviter une deuxième saisie.

### Variables agents
Source canonique des variables horaires : module `variables` (`inovtec_variables_v1` / `moduleSyncV1.variables`).

Chaque ligne conserve `agentRefId` et, lorsqu'il existe, `chantierId`. Les catégories gérées sont notamment : heures complémentaires, heures supplémentaires, dimanche, jour férié et nuit. Les absences restent stockées dans le module `conges` et sont affichées dans Variables agents comme une source liée.

La liste des agents vient du Classeur agents et la liste des sites d'Infos chantier. Les dimanches et jours fériés peuvent être proposés à partir du Planning avant validation manuelle. Les anciennes lignes du module Heures supplémentaires (`HSUPP_DUR_APP_V1`) peuvent être reprises dans Variables agents sans recréer les agents.

### Discipline
Source canonique : document partagé `chantiers/__inovtec_shared_discipline_v1__`, répliqué vers le stockage compatible de chaque compte.

Chaque dossier est relié au Classeur agents et, s'il existe, au chantier concerné via le référentiel partagé.

### KONTROL
Source canonique métier : contrôle local en cours + archives PDF partagées (`kontrolPdfMeta` dans `chantiers`).

Le chantier vient d'Infos chantier. Le cahier des charges chargé dans KONTROL vient du chantier sélectionné. Les métadonnées d'archive conservent `chantierId` et les IDs des agents reconnus.

### Organisation
Source canonique : tâches `tasks`, synchronisées dans l'espace partagé.

Une tâche peut être reliée à un agent et/ou un chantier via le référentiel partagé.

## Données qui restent indépendantes

- Conversion du temps (`TEMPS`) : calculateur, aucune donnée métier à partager.
- Salaire (`SALAIRE`) : calculateur, aucune donnée métier à partager.

## Règles de cohérence

1. Ne pas recréer un agent dans une page métier si le Classeur agents le contient déjà.
2. Ne pas recréer un chantier en texte libre si Infos chantier le contient déjà.
3. Conserver les IDs (`agentRefId`, `chantierId`) même si le libellé affiché change.
4. Les données historiques sans ID sont rapprochées par nom/adresse puis enrichies automatiquement.
5. Les liens inter-pages sont stockés dans le référentiel partagé, pas seulement dans le navigateur ou dans l'UID d'un utilisateur.
6. Les documents techniques `_hidden` de la collection `chantiers` ne sont jamais comptés comme des chantiers métier.
7. Les absences affichées dans Variables agents ne doivent pas être dupliquées : leur source reste `conges`.
8. Une trace de suppression d'agent (`_deleted:true`) est prioritaire sur toute ancienne copie portant le même ID ; elle ne doit jamais être réinjectée dans les listes ou référentiels visibles.
