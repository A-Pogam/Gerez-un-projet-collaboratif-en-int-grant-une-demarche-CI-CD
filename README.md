## Vue d’ensemble

### Pipeline GitHub Actions orchestrant :

1. **Front** (Angular) : build + tests (Karma/Jasmine, Chrome Headless) + couverture LCOV.
2. **Back** (Spring) : build + tests (JUnit) + couverture JaCoCo.
3. **Qualité** : analyse **SonarCloud** (monorepo front+back) + Quality Gate.
4. **Images Docker** : build & push **Docker Hub** (`bobapp-front`, `bobapp-back`) sur `main`.

### Déclencheurs

- `push` sur toutes branches → Front + Back (tests/coverage).
- `pull_request` → Front + Back (tests/coverage, sans répertoires secrets).
- `push` sur `main` → + **Sonar** + **Docker publish** ( répertoires secrets disponibles).

---

## Étapes du workflow (avec objectif)

### 1) Front-end CI (`jobs.front`)

On prépare l’environnement puis on vérifie qu’il compile et qu’il est testé correctement.

- **actions/checkout**  récupére le code.
- **setup-node** en Node 18 + cache npm.
- **npm ci / build**  vérifierque le projet compile.
- **Tests headless** `npm run test:ci` exécute les tests en Chrome Headless (Puppeteer), produire :
    - **JUnit XML** (`front/reports/karma-junit.xml`) pour l’affichage des tests dans GitHub,
    - **LCOV** (`front/coverage/bobapp/lcov.info`) pour la couverture Sonar.
- **Publication** : Test Reporting dans *Checks* + Upload de la couverture HTML comme artefact.

**L'objectif** est prévenir les régressions UI/TS, produire une couverture exploitable par Sonar.

---

### 2) Back-end CI (`jobs.back`)

On garantit la qualité Java via Maven, JUnit et JaCoCo.

- **setup-java Temurin 17** + cache Maven.
- **`mvn -B clean verify`**  compile, exécute les tests, génére :
    - **JUnit XML** (`back/target/surefire-reports/*.xml`),
    - **JaCoCo** (`back/target/site/jacoco/jacoco.xml`).
- **Publication** : rapport de tests dans *Checks* + Upload des rapports JaCoCo (HTML & XML).

**L'objectif** est de garantir la qualité du code Java et exposer la couverture.

---

### 3) Qualité – SonarCloud (`jobs.sonar`)

La partie qualité (SonarCloud) consolide l’analyse front+back.

- Rebuild **back** (classes + JaCoCo) et **front** (LCOV) dans ce job pour garantir la présence des fichiers.
- **sonarqube-scan-action** qui analyse à la racine (lit `sonar-project.properties`).
    - Sources : `back/src/main/java`, `front/src`
    - Couverture : `back/target/site/jacoco/jacoco.xml` & `front/coverage/bobapp/lcov.info`

**Objectif :** mesurer dette technique, bugs/vulnérabilités, duplications, **coverage global**.

---

### 4) Build & Push Docker images (`jobs.docker-publish`)

- **docker/login-action** → connexion Docker Hub (secrets repo).
- **docker/metadata-action** → tags (`latest`, `main`, `sha-…`).
- **docker/build-push-action** → build & push :
    - `docker.io/<user>/bobapp-front:...` (contexte `./front`)
    - `docker.io/<user>/bobapp-back:...` (contexte `./back`)
- **Condition** : uniquement sur **`push` de `main`** (pas de PR/fork).

**Objectif :** disposer d’artefacts exécutable prêts au déploiement.

---

## KPI proposés (avec cibles)

> Bob souhaite fixer des seuils : on démarre simple avec 2 KPI mesurables dans la pipeline.

### KPIs & Analyse de la qualité (source : SonarCloud)

#### Analyse actuelle (issue de SonarCloud)

- **Coverage global** : **41,4 %** (mesuré par Sonar).
- **Maintainability** : **D** (code smells trop élevés).
- **Security Review Rating** : **E** (points de vigilance majeurs).
- **Reliability** : niveau à améliorer (quelques scénarios non couverts par des tests, peu d’assertions sur les erreurs).

Détail par répertoire (Sonar) :

- **back/src** — *Lines of Code ~116* ; **Bugs : 0**, **Vulnérabilités : 1**, **Code Smells : 6**, **Security Hotspots : 2**, **Coverage : 38,8 %**, **Duplications : 0,0 %**.
- **front/src** — *Lines of Code ~161* ; **Bugs : 0**, **Vulnérabilités : 0**, **Code Smells : 7**, **Security Hotspots : 0**, **Coverage : 47,6 %**, **Duplications : 0,0 %**.

> Ces chiffres servent de référence. Tous les pourcentages de couverture cités ci-dessous sont ceux que SonarCloud calcule à partir de `jacoco.xml` (back) et `lcov.info` (front).

### Analyse rapide & plan d’amélioration (guidé par Sonar)

#### Security (rating E, hotspots & 1 vuln back)

- Court terme : corriger la vulnérabilité identifiée côté back (auth, validation d’input, dépendance vulnérable).
- Hotspots : passer en revue les 2 hotspots et documenter la décision (safe/not safe).
- Prévention : activer le Dependency Check et ajouter des tests qui valident les contrôles d’entrée/sortie.

#### Maintainability (rating D, code smells)

- Refactoring ciblé des 6 (code smells back) + 7 (front) : duplication, fonctions trop longues, conditions imbriquées : réduire la complexité cyclomatique, extraire des fonctions pures testables.
- Règles Sonar : corriger en priorité Major/Critical, puis le reste ensuite.

#### Reliability (tests & erreurs)

- Tester les chemins d’erreur pour éviter les régressions invisibles.
- Stabilité front : continuer en ChromeHeadless avec Puppeteer et flags CI ; identifier et corriger les tests flaky.

#### Coverage (41,4 % → 50 % Sprint 1)

- Front : viser les services et pipes (logique pure), puis les composants avec logique (mocks d’API).
- Back : viser les services et controllers avec des tests unitaires et slice tests (MockMvc/WebTestClient).
- E2E minimal : 2 parcours critiques pour sécuriser l’essentiel (ex. “suggestion de blague”, “post vidéo”).

### KPI #1 — Coverage minimal

- **Cible Sprint 1** : **≥ 50 %** global (vs. ~41,4 % actuel).
- **Cible Sprint 2** : **≥ 75 %**.
- **Cible Sprint 3** : **≥ 95 %** *(à n’atteindre que si la base de code reste simple et fortement testable ; sinon, ajuster à 80–85 % réalistes)*.

#### Pourquoi un objectif “agile” pour les tests ?

- En agile, on livre par petites itérations : des objectifs de couverture progressifs (50 % → 75 % → 95 %) permettent d’améliorer la qualité sans bloquer la livraison.
- Chaque user story inclut des tests (unitaires et, si besoin, e2e).
- La boucle feedback rapide (CI + Sonar + Test Reporting) permet de corriger au fil du temps et de prévenir la dette technique (au lieu de la rembourser tard).

### KPI #2 — Taux de réussite de la pipeline 

On mesure, sur une fenêtre glissante de 14 jours, la part des exécutions du workflow CI sur la branche `main` qui se terminent en succès.

- Formule : `success_rate = (#runs CI “success”) / (#runs CI “success” + “failure”)`
- Seuil cible : ≥ 95 %.

Interprétation :

- ≥ 95 % : pipeline stable (tests fiables, infra OK).
- < 95 % : instabilité (temps d’attente, manque de mocks, etc.). À analyser dans l’onglet Actions et les logs de jobs

---

## Notes & avis (retours utilisateurs)

La note moyenne (≈ 2,0/5) et le ton des messages indiquent une insatisfaction forte. Les plaintes sont répétées, orientées fiabilité et support. Le risque principal est la perte d’utilisateurs (désabonnement / suppression des favoris) et une dégradation de l’image.

## Thèmes majeurs

- **Stabilité / crash**

    « Impossible de poster une suggestion de blague, le bouton tourne et fait planter le navigateur. »

    -  Problème critique sur le flux d’ajout (boucle de chargement, freeze/crash). Impact direct sur l’engagement.
- **Bogue persistant non résolu**

    « Bug sur le post de vidéo remonté il y a 2 semaines, toujours présent. »

    - Défaut de triage ou de priorisation, cycle de correction trop long.
- **Absence de réponse / support**

    « Une semaine sans recevoir de réponse à mon email. »

    -  Service technique inexistant ou non respecté, perception d’abandon.
- **Perte d'utilisateur**

    « J’ai supprimé ce site de mes favoris. »

    -  Perte d’utilisateurs avérée liée aux points ci-dessus.

## Priorités (P0/P1) et actions proposées

**P0 – Corriger et empêcher le retour des crashs**

- Corriger le flux “suggestion de blague” : gérer timeout, afficher un message d’erreur, désactiver le bouton pendant l’envoi, retry contrôlé.
- Corriger le post de vidéo : validation côté front, limites de taille/type, gestion d’upload en chunks si besoin ; côté back, limites & messages d’erreur clairs.

**P1 – Mettre sous contrôle le support et les délais**

- Mettre en place un service technique opérationelle (ex. < 48 h ouvrées), auto-accusé de réception, template de suivi.
- Centraliser les retours (Formulaire In-app → Jira)avec tag “User-Reported” + étiquette priorité.
- Activer un changelog visible quand un correctif est déployé (restaure la confiance).

---

## Problèmes/priorités identifiés

1. **Coverage faible (~30%)** → prioriser des tests unitaires sur :
    - services Angular (logique pure),
    - contrôleurs/services Spring (API, erreurs).

        **Objectif** : atteindre 35% d’ici le prochain sprint (puis 50%).

1. **Stabilité des tests front** → garder Puppeteer & flags CI ; surveiller tests flaky (réexécutions).
2. **Qualité Sonar** → corriger en priorité règles *Blocker/Critical* et duplications si signalées.
3. **Docker**
    - Vérifier ports exposés (front/back) pour éviter conflits en local.
    - (Option) Limiter la taille des images via Dockerfiles multi-stage.

---

## Annexes

### Secrets requis

- **Sonar** : `SONAR_TOKEN`, `SONAR_HOST_URL=https://sonarcloud.io`
- **Docker Hub** : `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

### Fichiers clés

- **Workflow** : `.github/workflows/ci.yml`
- **Sonar config** : `sonar-project.properties` (à la racine)
- **Front** : `front/karma.conf.js`, `front/package.json` (`test:ci`)
- **Back** : `back/pom.xml` (JaCoCo), `back/target/site/jacoco/jacoco.xml`
- **Dockerfiles** : `front/Dockerfile`, `back/Dockerfile`



