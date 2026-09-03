# JM@Santé — Documentation technique

Application Android de relève / transmissions infirmières pour IDEL.
Stack : **Capacitor 6** (WebView) · JavaScript vanilla (pas de framework) · SQLite chiffré / IndexedDB.

---

## Arborescence

```
JMSante/
├── build.js                  ← Concatène www/js/*.js → www/js/app.js
├── package.json              ← Dépendances npm + plugins Capacitor
├── capacitor.config.json     ← Config appId, splash, SQLCipher…
├── resources/icon.png        ← Icône source 1024×1024 (icônes générées en CI)
├── .github/workflows/        ← Pipeline Actions : build APK debug
└── www/
    ├── index.html            ← Page unique, ordre de chargement des scripts
    ├── css/style.css         ← Styles + thèmes (variables CSS)
    └── js/
        ├── libs/
        │   ├── jspdf.min.js      ← Génération PDF côté client
        │   ├── pdfjs.js          ← Lecture PDF (conversion pages → images)
        │   └── pdfjs.worker.js   ← Worker pdf.js
        ├── globals.js        ← Constantes : catalogue soins, RAP_TYPES, seuils, helpers dates
        ├── storage.js        ← Persistance : SQLite chiffré (natif) / IndexedDB (web),
        │                       chiffrement AES-GCM applicatif, PIN, biométrie, export/import
        ├── seed.js           ← Données de démonstration
        ├── ui.js             ← Rendu du Moniteur : cartes patients, formulaire inline,
        │                       brouillon persistant (_formDraft), swipe, barre de progression
        ├── sheets.js         ← Feuilles modales : patient, docs, bilans (sync rappels),
        │                       rappels, réglages/tournées, catalogue
        ├── engine.js         ← buildReleve() : génération du texte de relève
        ├── share.js          ← showReport() : envoi TXT/PDF/HTML/DOCX, système d'annexes
        │                       avec liens cliquables, partage natif, gestionnaire global data-a
        ├── dictate.js        ← Dictée vocale : plugin natif (hors-ligne) + repli Web Speech
        ├── features.js       ← Recherche globale, galerie chrono, bilan de tournée, courbes SVG
        ├── seq.js            ← Mode séquentiel (tournée guidée) + signature canvas,
        │                       bouton « pas de passage prévu » (skip sans enregistrement)
        ├── sync.js           ← Synchro multi-utilisateurs : identité, journal d'opérations,
        │                       fichier .jmsync, analyse/fusion, conflits, snapshots
        └── init.js           ← Boot : openDB → initSqlite → chargement état → verrou → render
```

### Modules clés

| Module | Rôle | Points d'attention |
|---|---|---|
| `features.js` | Fonctionnalités transverses (recherche, galerie, stats) | Dépend de `S` global et des helpers de globals.js |
| `seq.js` | Mode séquentiel : navigation patient par patient dans la tournée du jour, signature | Canvas de signature : ne fonctionne pas en jsdom (tests) |
| `storage.js` | Toute la persistance et la sécurité | Voir « Stockage » ci-dessous |
| `share.js` | Tout l'envoi/partage + **gestionnaire global de clics `[data-a]`** en fin de fichier — ne pas le supprimer ! | Les boutons du header/bottombar passent par lui |

---

## Build

### Développement
```powershell
node build.js          # concatène les modules → www/js/app.js (mode DEV, ~170 Ko)
```
L'ordre de concaténation est défini dans `build.js` (globals → storage → seed → ui → sheets → engine → share → dictate → features → seq → init).

### Production
```powershell
node build.js --prod   # minification via esbuild (npm i -D esbuild requis)
```

### APK (2 méthodes)
1. **GitHub Actions** (release) : push → pipeline `.github/workflows` → APK debug en artifact.
   Les icônes sont générées par script Python **après** `cap add android`.
2. **Local** (test rapide, ~15 s) :
   ```powershell
   node build.js ; npx cap copy android ; npx cap run android
   ```
   Prérequis Windows : JDK 21 (`$env:JAVA_HOME`), Android SDK, appareil USB en mode débogage.
   Après chaque `npx cap add android` :
   - **`node scripts/postcap.js`** → installe le splash jour/nuit ET le plugin natif
     `JMSaveFile` (enregistrement local via `MediaStore.Downloads`, sans permission,
     fichiers dans Téléchargements/JMSante). Le CI l'exécute automatiquement.
   - `android/local.properties` → `sdk.dir=<chemin SDK>`
   - `android/gradle.properties` → `org.gradle.java.home=<chemin JDK21>`
   - `gradle-wrapper.properties` → `gradle-8.12-all.zip`

   Pourquoi un plugin natif : sur Android 11+, le stockage cloisonné refuse l'écriture
   directe dans Documents (`FILE_NOTCREATED`) et rend Téléchargements imprévisible via
   l'API File. `MediaStore.Downloads` est la voie officielle (celle de Chrome).
   `saveToDevice()` (storage.js) l'utilise en priorité, avec repli Filesystem.

---

## Stockage & sécurité

```
┌─ État applicatif S (patients, visites, rappels…)
│    └─ chiffré AES-GCM 256 (clé PBKDF2 : secret local + hash PIN)
│         └─ stocké sous la clé "state"
├─ Documents (photos/PDF) : clés séparées "doc_<id>" (dataURL base64)
└─ Backend physique :
     • Android natif → SQLite + SQLCipher (@capacitor-community/sqlite,
       passphrase = secret local, table kv(k,v), migration auto depuis IDB)
     • Web / tests  → IndexedDB "transm_d2", store "kv"
```

Le routeur `idbGet/idbSet/idbDel` (storage.js) choisit le backend automatiquement.
**Ne jamais appeler `_rawGet`/`_sqlGet` directement.**

### Verrouillage
- PIN 4 chiffres : hash SHA-256, renforce la clé AES.
- Biométrie (`S.bioLock`) : plugin `@aparajita/capacitor-biometric-auth`,
  proposée automatiquement à l'ouverture du verrou + touche 👆 du pavé.
  Nécessite un PIN actif (repli si biométrie échoue).

---

## Plugins Capacitor

| Plugin | Usage |
|---|---|
| @capacitor/camera | Photos de plaies (sheetDocs) |
| @capacitor/filesystem | Enregistrement fichiers, partage annexes |
| @capacitor/share | Menu de partage natif Android |
| @capacitor/clipboard | Copie de la relève |
| @capacitor/local-notifications | Rappels J-3 → Jour J |
| @capacitor-community/sqlite | Base chiffrée SQLCipher |
| @capacitor-community/speech-recognition | Dictée native (hors-ligne si pack FR installé) |
| @aparajita/capacitor-biometric-auth | Empreinte / visage |

### Dictée hors-ligne
Le plugin utilise le `SpeechRecognizer` Android. Pour un fonctionnement **sans réseau**,
l'utilisateur doit installer le pack vocal : *Réglages Android → Google → Saisie vocale →
Reconnaissance vocale hors connexion → Français*. Repli automatique sur Web Speech API (en ligne).

---

## Version Windows (Electron)

```
electron/main.cjs        ← Processus principal : fenêtre, téléchargements → Téléchargements,
                           liens externes → navigateur, zoom Ctrl+/-, F11, F5, instance unique
electron-builder.yml     ← Config installateur : NSIS (Setup) + Portable, icône .ico
.github/workflows/build-windows.yml ← CI : runner windows-latest → 2 .exe en artifacts
```

Même cœur `www/` que l'APK. Pas de plugin Capacitor sur desktop : l'app détecte
l'absence de `window.Capacitor` et bascule sur les replis web — IndexedDB
(persistée dans `%APPDATA%/jmsante`), `<input type=file>` pour les documents,
téléchargement direct des relèves/sauvegardes. Le chiffrement AES-GCM applicatif
reste actif. Pont de données Android ↔ Windows : export/import JSON.

Limites desktop connues : dictée vocale inactive (le SpeechRecognizer est Android ;
la Web Speech API de Chromium exige des clés Google absentes d'Electron),
pas de biométrie (PIN fonctionnel), pas de menu de partage (remplacé par le
téléchargement du fichier).

Build local (optionnel) : `npm install --no-save electron@33 electron-builder@25`
puis `npm run win` (test) ou `npm run dist:win` (installateurs dans `dist-electron/`).
En pratique : pousser sur GitHub suffit, le workflow Windows produit les .exe.

## PWA (iPhone / Android / PC)

```
www/manifest.webmanifest  ← nom, icônes, standalone, couleurs
www/sw.js                 ← service worker : cache-first, app utilisable hors ligne
www/icons/                ← 11 tailles + 1 maskable, générées depuis resources/icon.png
www/js/pwa.js             ← détection iOS/standalone, bannière d'avertissement,
                            écran d'installation, invite native Android, persist()
.github/workflows/deploy-pwa.yml ← publication automatique sur GitHub Pages
```

**Activation (une fois)** : GitHub → Settings → Pages → Source : *GitHub Actions*.
L'URL devient `https://<user>.github.io/<repo>/`.

**Versionnage du cache** — `CACHE = "jmsante-vNN"` dans `sw.js` **doit changer à chaque
version publiée**, sinon les utilisateurs conservent l'ancienne app en cache.

**iOS** — le stockage d'une PWA non installée sur l'écran d'accueil peut être purgé par
iOS après ~7 jours d'inactivité. `pwa.js` affiche donc une bannière permanente, un écran
d'installation au premier lancement, un rappel toutes les 24 h et un avertissement de
sauvegarde dès 3 jours. Ces messages ne s'affichent **que** sur iOS non installé.

**Hors ligne** — les polices Google sont mises en cache par le SW ; les piles de repli
CSS sont des polices système (rendu correct même sans réseau au tout premier chargement).

## Tests

Tests jsdom dans un dossier séparé (`_test_*.js`) : `fake-indexeddb` + `JSDOM({runScripts:'outside-only'})`.
Limitations connues : variables de script inaccessibles via `w.eval` (tester via l'UI),
canvas absent, save() débounce + chiffre (lire l'état via l'UI, pas via IDB).

## Points structurants à connaître

**Concaténation des modules — désormais sûre (v33)**
Historiquement, chaque fichier se terminait par le mot-clé `function` qui complétait la première
ligne du fichier suivant. Cette astuce rendait le build **silencieusement cassable** : retirer un
module de `ORDER_*` détruisait les suivants en cascade (bug réel : écran vide au premier lancement,
`seed.js` exclu du build PROD).

Depuis la v33, **chaque module est autonome** : ses déclarations sont complètes, plus aucun
fichier ne dépend du précédent pour être syntaxiquement valide. Retirer un module ne casse
plus que ce module.

Double protection en place :
1. **Modules autonomes** — la chaîne ne peut plus se briser en cascade
2. **Garde-fou dans `build.js`** — après chaque compilation, vérifie la syntaxe du fichier produit
   et la présence des 12 modules ; le build **échoue avec un message explicite** si l'un manque
   (au lieu de produire une app cassée).

Une migration vers les modules ES (`import`/`export`) a été étudiée : elle impliquerait ~188
symboles à exporter et ~151 dépendances croisées, avec un risque de cycles (ui ↔ sheets ↔ engine).
Le rapport risque/bénéfice ne la justifie pas tant que les deux protections ci-dessus tiennent.
À reconsidérer lors d'une refonte de fond, pas en cours de développement fonctionnel.

**Synchro multi-utilisateurs** (`sync.js`) — journal d'opérations signées/horodatées, fichier
`.json` incrémental, fusion avec conflits tranchés par donnée, snapshots de sécurité
(marche arrière), élagage à 60 jours des opérations déjà partagées, dédoublonnage par pair.
Données strictement locales (jamais synchronisées) : ordre de passage, thème, PIN, créneaux,
phrases perso.

**Synchro — catégories d'opérations** : `analyzeSync()` classe en 5 groupes —
`auto` (fusion silencieuse), `newPatients` (admissions du collègue : validation, acceptées
par défaut, appliquées **avant** les ops qui les concernent), `delPatients` (suppressions :
**refusées par défaut**, double confirmation, passage par la corbeille via `trashPatient`),
`plans` (plans de soins : validation individuelle), `conflicts` (édition simultanée :
tranchage par donnée).

**Moteur de relève** (`engine.js`) — le bloc narratif et `patientStructured()` font une
**passe d'analyse sur toute la période** avant de produire du texte : `planTenu` (booléen) et
un tableau `evenements[]`. Résultat : une seule mention « Plan de soins respecté », puis les
écarts datés via `moment(v)` (date + créneau). Ne jamais revenir à un rendu passage-par-passage,
c'est ce qui rendait les relèves illisibles sur une semaine.

**Marqueurs portés par la visite** — `v.constRel` (constantes à publier dans la relève),
`v.dar` (passage saisi en mode DARD → bloc structuré), `v.slot` (matin/soir),
`v.soinNotes{}` (commentaire par soin). Ces marqueurs sont posés à la saisie (`ui.js`) et
lus par le moteur ; ils ne sont jamais recalculés.

**Synthèse ciblée** — `sheetSyntheseCiblee()` puis `buildSyntheseCiblee(patients, start, end, inc)`.
Le document ne contient **que** les patients cochés : c'est une exigence de confidentialité
(un médecin ne doit pas recevoir les données de patients qui ne sont pas les siens), pas un confort.

**Signature et message de fin** — `_sigData` (dataURL) et `_finalMsg` dans `share.js`,
**réinitialisés dans `showReport()`** à chaque relève pour éviter de réémettre le mot de la veille.
Insérés dans les trois formats (jsPDF `addImage`, `<img>` HTML, texte encadré pour le DOCX).

**Import de sauvegarde** — `sheetImportChoice()` propose **fusion** (union non destructive :
dossiers manquants ajoutés, passages/bilans/docs complétés par uid, tournées et tags en union)
ou **remplacement**. Snapshot de sécurité systématique avant l'opération (récupérable via
l'historique des synchros). Le PIN, le thème et la rétention restent toujours locaux.

**Rappels** — accès aux types **toujours** via `rapType(t)` (jamais `RAP_TYPES[t]` directement) :
un rappel peut porter un type inconnu (ancien, ou reçu d'un collègue sur une autre version).

**Responsive** — `overflow-x:hidden` global, header en grille sur écran étroit (titre sur sa
ligne, boutons dessous), écran de bienvenue hors grille adapté en largeur ET hauteur.
Vérifié de 320×568 à 1024×768.

**Saisie** — la classe `body.typing` (posée au focus d'un champ) masque les boutons flottants
🏁 et 🎤 pour qu'ils ne recouvrent pas les champs.

## Identité visuelle

```
www/icons/cigale.svg        ← icône bouton (silhouette, croix détourée)
www/icons/cigale-large.svg  ← version détaillée (bienvenue, verrouillage)
www/icons/icon-*.png        ← icônes d'installation, dérivées du logo original
resources/icon.png|.ico     ← sources Capacitor / electron-builder
resources/splash*.png       ← écrans de démarrage Android
```

**SVG inline plutôt que fichiers** — les icônes sont écrites directement dans le HTML/JS.
Elles héritent ainsi de `currentColor` (donc du thème actif : turquoise sur sombre, vert
foncé sur clair), restent nettes à toute densité et ne coûtent aucune requête.

**Croix détourée** — la croix blanche est tracée deux fois : d'abord épaisse dans la couleur
du fond (`.cig-x-bg`), puis fine en blanc. Sans ce liseré elle se fond dans le corps de la
cigale en dessous de ~32 px. Ne pas supprimer le premier tracé.

**Régénérer les icônes d'installation** — depuis le PNG source du logo : détourage par
seuil de luminance (le fond très sombre devient transparent), recadrage sur la bbox, puis
composition centrée sur le fond `#0D1413` avec une marge de 14 % (26 % pour la version
*maskable*, dont les bords sont rognés par les lanceurs Android).

**Slogan et signature** — « Tout est dans la cigale » (`.slogan`, `.wc-slogan`,
`.lock-slogan`) et « JM@Santé by JmCve83 — Toulon production » (`.signature`) apparaissent
dans l'app, les relèves HTML/PDF et la documentation.

## Pièges connus

- PowerShell n'accepte pas `&&` → utiliser `;`
- jsPDF ne supporte que Latin-1 → `cl()` nettoie émojis/box-drawing avant écriture
- Le texte de relève utilise des caractères Unicode (─ = U+2500) → les regex de découpage
  doivent cibler `┌` littéral, pas `[-]`
- Édition Python des fichiers JS : passer par bytes ou échappements `\uXXXX` pour les émojis
