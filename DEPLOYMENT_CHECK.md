# Contrôle de déploiement

Le workflow `.github/workflows/dashboard-health.yml` vérifie automatiquement :

- la présence des fichiers indispensables du dashboard ;
- la syntaxe JavaScript des scripts locaux et inline ;
- l’accessibilité du site GitHub Pages public ;
- la présence de la nouvelle version du dashboard sur le site public ;
- l’accès aux principales pages métier.

Le contrôle s’exécute à chaque Pull Request vers `main`, à chaque push sur `main`, et peut également être lancé manuellement depuis GitHub Actions.
