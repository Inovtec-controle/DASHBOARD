# Inovtec Dashboard

Tableau de bord statique publié avec GitHub Pages.

## Applications

### Synchronisées avec Firebase

- `INFOCHANTIERS.html` : informations et consignes des chantiers.
- `ORGA.html` : tâches, priorités, échéances et archives.
- `DISCIPLINE.html` : dossiers disciplinaires confidentiels, avec possibilité d’ajouter des photos aux dossiers et de les intégrer à l’impression.

Ces pages demandent une connexion Firebase Authentication.

### Enregistrées dans le navigateur

- `KONTROL.html`
- `PLANNINGS.html`
- `HEURE-SUP.html`
- `TEMPS.html`
- `SALAIRE.html`
- `AGENTS.html`

Les données locales peuvent disparaître en cas de suppression des données du navigateur ou de changement d’appareil. Utiliser régulièrement les fonctions d’export disponibles.

## Configuration Firebase

La configuration publique de l’application Web est centralisée dans `firebase-config.js`.

La clé API Firebase présente dans une application Web n’est pas un mot de passe. La protection repose sur :

1. Firebase Authentication ;
2. les règles de sécurité Firestore ;
3. les règles Firebase Storage pour les photos ;
4. la limitation des comptes autorisés ;
5. éventuellement Firebase App Check.

Le fichier `firestore.rules` contient une proposition de règles Firestore. Le fichier `storage.rules` contient les règles prévues pour les photos de la page Discipline : seules les images du dossier de l’utilisateur authentifié sont autorisées, avec une limite de 12 Mo par fichier.

Ces règles doivent être déployées séparément dans Firebase ; GitHub Pages ne déploie ni les règles Firestore ni les règles Firebase Storage.

## Développement

Les pages partagent les styles principaux contenus dans `inovtec-common.css`.

Avant toute mise en production :

- tester les connexions ;
- contrôler les règles Firestore et Firebase Storage ;
- vérifier la génération des PDF ;
- tester sur téléphone et ordinateur ;
- effectuer un export de sauvegarde des outils locaux.
