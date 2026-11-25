# Architecture INOVTEC Dashboard — phase de stabilisation

## Les trois niveaux

1. **Accueil** : `index.html`, les scripts `dashboard-*.js` et leurs feuilles de style. Les indicateurs lisent les données métier ; ils ne les remplacent pas.
2. **Conteneur des rubriques** : `inovtec-page-shell.html` ouvre la rubrique dans `#legacyFrame`, initialisée par `inovtec-shell.js`.
3. **Rubriques métier** : pages existantes (`AGENTS`, `PLANNINGS`, `KONTROL`, `INFOCHANTIERS`, etc.). Elles conservent leurs données et leurs fonctions.

## Point d'entrée unique des dépendances du conteneur

`inovtec-shell-modules.js` contient **la liste ordonnée** des dépendances du conteneur et les rubriques qui en ont besoin.

- `modes` : script chargé exclusivement sur ces rubriques ;
- `except` : script chargé partout sauf ces rubriques ;
- sans condition : script commun à toutes les rubriques.
- **L'ordre des entrées est fonctionnel** : il garantit les dépendances entre Firebase, référentiels, interface et compléments métier.

Le registre utilise encore `document.write` **uniquement pendant l'analyse initiale du HTML** pour préserver l'exécution synchrone historique. Il ne doit jamais être appelé après le chargement de la page. Un chargeur asynchrone nécessiterait des tests d'intégration supplémentaires.

Le fichier `tests/shell-module-order.baseline.json` décrit l'ordre avant cette refonte. Exécuter `node tests/shell-module-order.mjs` avant de changer ce registre. Le contrôle est intégré à la CI.

## Simplification Infos chantier — 25 novembre 2026

Les deux anciens scripts de mise en page `inovtec-info-save-placement.js`
et `inovtec-info-top-layout.js` sont remplacés par
`inovtec-info-layout.js`. La fiche dispose maintenant d'un seul observateur
DOM, qui repositionne les cartes principales puis le bouton Enregistrer
après l'historique (ou le cahier des charges si l'historique est absent).

La gestion Firebase et l'enregistrement des champs sont **inchangés**.
Le test `tests/info-layout-module.mjs` vérifie le rendu dans une iframe fictive,
les ajouts et suppressions dynamiques, la recharge du cadre et l'absence
de doubles observateurs actifs. Il s'exécute dans `browser-smoke.yml`.
Les scripts supprimés restent consultables dans l'historique Git.

## Règles pour les développements suivants

1. Ne plus ajouter de blocs de chargement conditionnel dans `inovtec-page-shell.html`. Utiliser le registre commun.
2. Pour corriger une fonctionnalité, modifier d'abord son **module propriétaire** au lieu d'ajouter un nouveau script de correction superposé.
3. Conserver les identifiants et les formats des données stockées. Toute migration doit être explicite, réversible et accompagnée d'un test.
4. Tester les rubriques `agents`, `planning`, `kontrol`, `infos`, `organisation`, les sauvegardes Firebase et la navigation mobile pour les modifications transversales.
5. En cas de régression, revenir à la version précédente du shell, sans modifier ni effacer les documents Firebase.

## Dette technique restante (hors de cette première modification)

- Plusieurs rubriques métier portent encore des scripts de correction ajoutés au fil du temps.
- `firebase-config.js` charge des compléments partagés : leur rationalisation devra être faite séparément, avec test Firebase réel.
- Les pages `*-LEGACY.html` et les ponts entre cadres devront être remplacés progressivement, **pas supprimés en masse**.
- Les problèmes de capacité, d'intégrité et de sécurité des données sont **distincts** de cette simplification des dépendances et ne sont pas résolus par elle.

**Ce changement ne modifie aucun document Firebase, aucun champ de données, aucune règle de sécurité et aucune page métier.**
