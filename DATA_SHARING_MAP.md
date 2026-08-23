# Inovtec Dashboard — modèle de données partagé

Ce document décrit les sources uniques à utiliser entre les pages du Dashboard.

## Sources maîtres

### Agents — Classeur agents
Source canonique : module `agents` (`kontrol_agents_classeur_v2` / `moduleSyncV1.agents`).

Identifiant commun : `agentRefId` / `agentId` = ID du Classeur agents.

À réutiliser dans : Planning, Congés, Heures sup., Discipline, KONTROL, Organisation, Infos chantier (affichage dérivé du planning).

Données maîtres : identité, coordonnées, contrat, poste, date d'entrée, disponibilité, informations administratives et documents agent.

### Chantiers — Infos chantier
Source canonique : collection Firestore `chantiers` (documents métier non `_hidden`).

Identifiant commun : `chantierId`.

À réutiliser dans : Planning, Heures sup., Discipline, KONTROL, Organisation.

Données maîtres : nom, adresse/GPS, accès, contacts, dates contrat, consignes, gestion technique, consommables, cahier des charges et planning conteneurs.

### Affectations — Planning
Source canonique : module `planning`.

Chaque intervention doit référencer `agentRefId` et `chantierId`. Infos chantier déduit les agents affectés depuis le planning ; il ne maintient pas une seconde affectation indépendante.

### Congés et absences
Source canonique : module `conges`.

Chaque période référence `agentRefId`. Les remplacements et la couverture sont calculés à partir du Planning.

### Heures supplémentaires
Source canonique : module `heures`.

Chaque ligne doit conserver `agentRefId` et `chantierId` en plus des libellés historiques. La liste des employés vient du Classeur agents ; la liste des sites vient d'Infos chantier.

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
