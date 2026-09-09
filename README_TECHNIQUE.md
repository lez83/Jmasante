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

**Bandeau PDF des annexes** — « RELEVE INFIRMIERE » et « ANNEXES » étaient tracés à la
même coordonnée (M, 9), donc superposés. « ANNEXES » est désormais aligné à droite
(`{ align:"right" }`) en corps plus petit. Vérifier visuellement toute modification du
bandeau : jsPDF n'avertit jamais d'un chevauchement.

**Mode SÉLECTION** — un patient coché doit **toujours** figurer dans la relève, même sans
passage retenu par le filtre (`keep`). Le `return` anticipé sur `!shown.length && !bils.length`
le faisait disparaître : relève incomplète, et — effet de bord — ses documents n'étaient plus
proposés à l'envoi, puisque `inReleve()` s'appuie sur les patients présents dans le texte.
Quand `shown` est vide en mode select, le bloc se construit sur `vs` (tous les passages de la
période) pour établir « Plan de soins respecté ».

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

**État conservé au réaffichage** — `showReport(text, opts, keepExtras)` : quand `keepExtras`
est vrai (retour depuis 💬 Message ou ✍️ Signer), **trois** états sont restaurés :

```
_keepDocs → sélection de documents      (sinon : décochés en silence)
_keepFmt  → format d'export             (sinon : retour à Texte → mauvais envoi)
_keepText → texte modifié à la main     (sinon : corrections écrasées)
```

⚠️ Tout état visible dans l'écran d'aperçu doit **refléter sa valeur dès le rendu HTML**
(`fmt==="pdf"?"on":""`, `checked.has(i)`) et non seulement au clic — sinon la restauration
est invisible pour l'utilisateur. Toute nouvelle option de cet écran doit être ajoutée à
cette liste, et remise à `null` quand `keepExtras` est faux.

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

## ⚠️ WebView Android : data:/blob: bloqués dans iframe et embed

Le WebView Android **refuse silencieusement** `<iframe src="blob:…">` et
`<embed src="data:…">` : le cadre reste **blanc**, sans erreur. Trois symptômes rencontrés —
aperçu PDF vide dans la visionneuse, encart vide dans la fiche exportée, document non joint.

**La parade** : rendre les PDF en **images** avec `pdfToImagesGlobal(dataUrl, maxPages)`
(pdf.js, déjà embarqué). Utilisé par la visionneuse (`viewDoc`), l'export de fiche
(`buildFiche`) et les annexes de relève. Ne jamais revenir à `<iframe>`/`<embed>`
pour afficher un document stocké.

Pour du HTML **généré** (aperçu de fiche, mode d'emploi), `iframe.srcdoc` fonctionne —
contrairement à une URL `data:` ou `blob:`.

**Les trois emplacements corrigés** (audit du 4 sept.) : visionneuse de document
(`viewDoc`), fiche patient exportée (`buildFiche`), annexes PDF de la relève HTML
(`buildHtml`). Tous passent par `pdfToImagesGlobal`. Un `grep '<embed\|<iframe'` doit
rester vide de tout contenu stocké.

## ⚠️ Ne jamais ouvrir d'onglet séparé

`window.open()` dans le WebView **remplace la vue** sans barre d'adresse ni retour :
l'utilisateur est piégé et doit tuer l'app. Tout aperçu ou impression se fait **dans**
l'app, via une couche plein écran avec bouton retour (`showFichePreview`), l'impression
étant déclenchée sur l'iframe (`fr.contentWindow.print()`).

`showFichePreview()` sert aussi au **mode d'emploi** (bouton « Ouvrir pour PDF » du guide) :
`fiche.js` précède `features.js` dans `ORDER_*`, la fonction est donc disponible.

**`window.open` légitimes** : bouton « Ouvrir » de la visionneuse (action explicite, après
tentative d'ouverture native) et lien GPS `_system` (délégué à Maps). Tout autre usage est
à proscrire.

## 🔒 Cloisonnement des synchros par cabinet

**Exigence légale, pas un confort.** `buildSyncFile(tour, docIds)` ne retient que les
opérations du cabinet demandé :

```
patient/visite/bilan/doc → le patient doit appartenir à `tour`
rappel avec r.pid        → son patient doit appartenir à `tour`
rappel avec r.tour       → doit valoir exactement `tour`  (rappel de cabinet)
rappel r.perso === true  → ne part JAMAIS
```

Les rappels portent désormais trois cas : `pid` (patient) · `tour` (cabinet) · `perso`.
Migration : les anciens rappels « généraux » (sans patient) deviennent **personnels** —
on ne peut pas deviner leur cabinet, et un rappel personnel ne fuite pas.

**Le même cloisonnement s'applique à la RELÈVE** (`buildReleve`, bloc `rapBlock`) :
un rappel `perso` n'y figure jamais, un rappel de cabinet seulement dans la relève de
ce cabinet. Le filtre initial `!r.pid || poolIds.has(r.pid)` laissait passer **tous** les
rappels sans patient — y compris ceux des autres cabinets et les personnels.

**Ne jamais rendre `tour` facultatif à l'envoi.** `sheetSendSync()` impose le choix du
cabinet avant de générer le fichier.

**Documents** : aucun par défaut (`sel` vide), chargés depuis IDB au moment de l'envoi
et transportés dans `pkg.docs[]` avec leur `pid`.

**À la réception** (`analyzeSync` + écran de validation) : chaque document reçu a sa case,
décochée d'office s'il existe déjà un fichier de même nom chez le destinataire. À l'import,
**aucun document existant n'est jamais écrasé** — un doublon est ajouté à côté, renommé
« nom (reçu <date>).ext ».

## Saisie d'un passage — trois issues

```
Annuler   → abandonne (confirmation si des soins/notes sont saisis)
💾        → S.drafts[pid] : saisie DURABLE, le patient reste « à voir »
✓ Valider → commitVisit() : crée le passage, consomme S.drafts[pid]
```

⚠️ **Rappel — les actions de la fiche patient** (`.factions`) sont une **colonne**, pas une
rangée. Six boutons en flex débordaient de l'écran (constaté en tournée). Le conteneur ne
doit pas être un `.rowb`. Les actions destructrices sont séparées par `.fsep` + un intitulé
« Retirer ce dossier ».

**Suppression : deux barrières.** `confirm()` puis `prompt()` demandant d'écrire le nom du
patient — un enchaînement machinal de « OK » ne suffit plus. Le libellé dit « Supprimer le
dossier » et non « définitivement » : il part en corbeille, récupérable 30 jours.

⚠️ **`.btn` porte `width:100%`** — dans un conteneur flex, chaque bouton réclame donc
toute la largeur et les suivants sortent de l'écran (constaté sur iPhone : seul « Annuler »
visible). Les barres de plusieurs boutons doivent utiliser une **grille** (`.formbtns`)
avec des colonnes définies, jamais `flex` + `style="flex:1"`.

`_formDraft` est une variable en mémoire : elle ne survit **pas** à la fermeture de l'app.
`S.drafts[pid]` est persisté dans le state — c'est ce qui distingue « 💾 Enregistrer » du
brouillon automatique. À l'ouverture d'une carte, `_formDraft` est réhydraté depuis
`S.drafts[pid]` s'il existe ; la validation le supprime.

**Rien de tout cela ne remonte automatiquement dans la relève** : ce qui y figure suit les
règles habituelles (plan respecté, soins commentés, constantes cochées, infos à interrupteur).
Une saisie enregistrée sans validation n'est **pas** un passage.

⚠️ **Doublons** — `commitVisit()` faisait `p.visits.push()` sans contrôle : valider depuis la
carte **puis** depuis le déroulé créait deux passages le même jour et le même créneau. Un
`confirm()` propose désormais de fusionner (union des soins, fusion des constantes,
concaténation des notes) ; refuser garde les deux passages, cas légitime d'une reprise.

## Navigation (nav.js)

```
navHeader(label, showHome) → en-tête « ‹ Destination » + ✕   (à placer en tête du HTML)
bindNav(backFn)            → branche les boutons ET empile le retour
navBack() / navHome()      → remonter d'un niveau / tout fermer
initBackButton()           → bouton retour du téléphone, appelé au démarrage
```

**Le bouton retour du téléphone quittait l'application**, y compris en pleine saisie.
`initBackButton()` l'intercepte : plugin `App.backButton` en natif, `popstate` en PWA
(une entrée d'historique est toujours réinjectée, sinon le retour suivant sortirait),
et touche Échap sur PC. `navBack()` traite d'abord les couches empilées
(`#typepick`, `#docview`, `#fichePrev`) avant la pile des feuilles.

⚠️ **`bindNav()` doit être appelé après chaque `openSheet()`** portant un `navHeader` :
c'est lui qui alimente `NAV.stack`, donc qui fait que le bouton du téléphone se comporte
comme la flèche. Sans lui, le retour ferme tout d'un coup.

**Vocabulaire** — trois actions, trois formes : `‹ Destination` (revenir),
« Annuler » (abandonner une saisie), `✕` (tout fermer). Ne pas réintroduire
« Fermer », « ← Retour » ou « Retour aux tournées ».

**Poignées** — le glissement vers le bas des feuilles (`.grab-zone`) est **conservé** et
reste le geste principal de fermeture. Ne pas le retirer en refactorant l'en-tête.

**Variante en réserve** — si la flèche + mot s'avère trop encombrante à l'usage, une
variante « flèche longue avec barre » (cercle de 38 px, `M19 12 H6 M11 6 L5 12 L11 18`)
a été maquettée et validée comme repli. Voir l'historique du 5 sept.

## Sélecteur de type d'information

`pickInfoType(current, cb)` sert deux usages selon `current` :
**vide** = ajout, grille large avec les sous-titres `INFO_HINTS` ;
**renseigné** = changement, grille compacte avec le type actuel coché.
Le `＋` appelle le sélecteur **avant** de créer la ligne — plus de retypage après coup.

Sur chaque ligne, `.info-typ` réunit icône et libellé dans une pastille cliquable
(`--tc` porte la couleur du type). L'ancien `.info-ic` (icône seule, sans indice) est retiré.

⚠️ **Pas de `text-transform:uppercase` sur un libellé accentué** — le rendu perdait les
accents (« ACCES » au lieu de « Accès »).

⚠️ **Un `<textarea>` auto-grow dans un panneau masqué a un `scrollHeight` nul.** Les
informations restaient coupées à une ligne parce que l'onglet Infos est en `display:none`
à l'ouverture de la fiche. La hauteur est recalculée au changement d'onglet.

## Fin de tournée

`seqEndScreen(pool, slot)` (seq.js) affiche le récapitulatif : passages, plage horaire,
constantes hors seuils, et chaque ligne rouvre la carte du patient. Appelé à la fin du
déroulé **et** au lancement quand tout est déjà vu.

**Reprise au premier non-vu** : `seqIdx` n'est plus remis à 0 mais calculé — `findIndex`
du premier patient sans visite sur `workDate()` dans le créneau. Calculé plutôt que
mémorisé : un patient validé depuis sa carte ne doit pas être reproposé.

## Dialogues — trois fonctions, plus de boîtes natives

```
askDialog({ic, titre, sub, warn, ton:"danger", saisie, verrou, oui, non})  → Promise<bool|string>
askChoice({ic, titre, sub, options:[{ic,lbl,val}]})                        → Promise<val|null>
askText(titre, {ic, sub, val, ph, aide, oui})                              → Promise<string|false>
```

Remplacent `confirm()` et `prompt()`, dont les boîtes natives détonnent. `ton:"danger"`
donne la variante rouge ; `verrou:"NOM"` éteint le bouton tant que la saisie ne correspond
pas (suppression d'un dossier).

⚠️ **Convertir un `confirm()` oblige à rendre `async` toute la chaîne d'appel** — y compris
les gestionnaires `onclick` en une ligne. Le garde-fou du build attrape l'oubli
(« await is only valid in async functions »), mais la correction doit remonter jusqu'au
gestionnaire, pas seulement à la fonction.

⚠️ **Pas de `requestAnimationFrame`** pour déclencher l'animation d'ouverture : absent de
l'environnement de test, il fait tomber toute la feuille. `setTimeout(…, 16)` fait le même
travail.

**Deux pièges corrigés au passage** — des `confirm()` où « Annuler » déclenchait une action
au lieu d'annuler : le choix photo (« Annuler = galerie ») et le doublon de passage
(« Annuler = garder séparé »). Devenus des `askChoice()` où chaque option porte son nom.

## Dialogues et clôture de tournée

`askDialog({ic, titre, sub, oui, non})` → Promise\<bool\>. **Remplace `confirm()`**, dont la
boîte native Android détonne : carrée, grise, étrangère au reste. Coins ronds, dégradé
d'accent, cigale en filigrane (`CIG_FILI_SVG`), fond flouté.

**Le drapeau `#fab-endtour`** n'est plus permanent : `display:none` par défaut, `.on`
ajouté dans `render()` quand `seqActive` ou qu'un passage existe sur la journée affichée.
Il masquait les libellés des cartes le reste du temps.

⚠️ **Ne pas compter avec `relevePool()`** pour le récapitulatif de clôture : cette fonction
filtre sur la sélection de relève et renvoie 0 quand rien n'a été coché. Le dialogue affichait
« 0 passage » avec trois patients vus. Recalculer depuis `S.patients` et `S.curTour`.

**Un seul écran de fin** : `seqEndScreen(pool, slot, felicit)` — le troisième argument ajoute
le message de félicitations en tête. Le drapeau et la fin du déroulé mènent au même endroit.

## Pastilles patient — état ou événement

```
PATIENT_TAGS[k].kind = "etat" | "evt"
p.tagMeta[k] = { at:"YYYY-MM-DD", note:"…" }
tagAge(p,k) / tagAgeLbl(n)
```

Une pastille **état** (à surveiller, prioritaire) décrit le patient et reste. Une pastille
**événement** (médecin contacté) retient sa date d'activation : la relève affiche
l'ancienneté et la pastille passe en `.old` (opacité .62) au bout de 3 jours. **Rien ne
disparaît** — décision explicite : une pastille qui s'efface toute seule trahirait la
confiance qu'on lui accorde.

**Appui long** = commenter (même geste que pour un soin). Le commentaire part dans la
relève avec la pastille : « 🩺 Médecin contacté (hier) — Dr Blanc prévenu de la TA ».
Éteindre une pastille efface son `tagMeta`.

⚠️ **`materiel` a été retiré** de `PATIENT_TAGS` : c'était un rappel déguisé. La migration
le convertit en rappel (`_fromTag:"materiel"`) plutôt que de le perdre.

## Adresse et téléphone du patient

`adresseComplete(p)` assemble `address` + `cp` + `ville` — utilisé par le GPS, le DLU et
l'export de fiche. Les adresses existantes restent dans `address` et fonctionnent
inchangées ; les deux nouveaux champs se remplissent au fil de l'eau.

`p.tel = { fixe, mobile }` — le patient était le seul qu'on ne pouvait pas joindre.

## Étoile du plan de soins

⚠️ **L'étoile était ambre par défaut** (`.chip.star::before`), ce qui la rendait
indistinguable de l'ambre « matin ». Elle est désormais **neutre** sans créneau défini :
`.s-am` ambre, `.s-bl` bleu, rien = les deux. Graisse 900 et taille 1.2em pour que la
distinction soit franche. La légende `.slotleg` n'apparaît que si au moins un créneau est
défini.

## Pièges d'affichage sur mobile

⚠️ **Les caractères qui basculent en emoji.** Le `▶` du bouton Déroulé s'affichait
correctement en test mais **masquait son libellé sur Android** : le système le rend comme
emoji, bien plus grand que prévu, ce qui pousse le texte hors du bouton. Remplacé par un
SVG (`.tb-svg`). Vaut pour tout caractère technique — `▶ ◀ ✕ ★ ⚙` — dans un bouton dont la
hauteur est contrainte.

⚠️ **Un nom long dans une grille** doit avoir `overflow-wrap:anywhere` et
`word-break:normal` : sans le premier il déborde, avec `break-all` il se coupe au milieu
d'un mot. Les colonnes de posologie de la fiche de traitement sont passées de 30 à 28 px
pour laisser plus de place au nom.

**Zoom par pincement** — autorisé jusqu'à 3× (`user-scalable=yes, maximum-scale=3.0`).
Il était interdit par défaut, ce qui privait ceux qui ont besoin d'agrandir ponctuellement.
Le plafond garde un retour rapide en tournée.

## Navigation — une barre sur chaque feuille

`openSheet()` **branche automatiquement** la barre si elle est présente :

```js
if ($("#sheet .navbar") && typeof bindNav === "function") bindNav(closeSheet);
```

Avant, seules 5 feuilles sur 43 avaient `navHeader()` — le bouton retour du téléphone ne
fermait proprement que celles-là et pouvait **quitter l'application** ailleurs. Le
branchement centralisé évite d'oublier un `bindNav()` sur une nouvelle feuille.

Un `bindNav()` explicite posé **après** `openSheet()` écrase ce branchement par défaut :
c'est ainsi qu'un écran indique une destination particulière plutôt que la simple fermeture.

**Vocabulaire** — « Fermer » et « ← Retour » faisaient la même chose sous deux noms
(46 occurrences). Les boutons de bas de feuille sont retirés : la barre du haut suffit, et
un seul chemin vaut mieux que deux. Les gestionnaires correspondants sont protégés
(`const _e = $("#id"); if (_e) …`) — un `.onclick` sur un bouton retiré lève une erreur qui
casse tout l'écran.

## Mode d'emploi — données de démonstration

⚠️ **Le jeu de démonstration ne doit contenir AUCUNE donnée réelle.** Les captures partaient
de noms repris des échanges — patients réels. Corrigé : préfixe `Démo-` sur tous les noms,
adresse « 1 rue de la Démonstration, 00000 Villeneuve », téléphones à zéro, tournées et
identité neutres.

`/tmp/mkstate.py` construit le jeu, `manual/gen.py` génère le document depuis
`/tmp/shots_b64.json`. **Régénérer TOUTES les captures** après une correction de ce type :
une capture ancienne garde les anciens noms même si le jeu est propre.

Vérification systématique par OCR (`pytesseract`) sur chaque capture avant publication.

## Consigne des feuilles domicile

```
consigneDefaut(p, type)              → texte par défaut, seuils du patient inclus
feuilleHtml(p, type, dens, consigne) → consigne remplace le défaut ; "" = aucune
```

La consigne de bas de feuille était figée dans `rappels[type]`. Elle est désormais
modifiable avant impression, dans l'écran des feuilles — **ponctuellement** : la variable
`consigne` vit dans `sheetFeuilles()`, rien n'est enregistré. Changer de type la remet à
`null`.

⚠️ **Le texte saisi doit être échappé** (`esc()`) : les consignes par défaut contiennent
leurs entités HTML (`&gt;`, `&lt;`), pas la saisie libre. Un `<` non échappé casserait la
mise en page de la feuille imprimée.

⚠️ `oninput` sur le textarea met à jour la variable **sans redraw** — un `draw()` à chaque
frappe ferait perdre le curseur.

## Suppression — inventaire et principe

**Tout ce que l'IDEL crée est supprimable.** Vérifié type par type : patients (corbeille
30 j), passages, documents, bilans, rappels, informations, médicaments, tournées, phrases
types — et désormais **soins du catalogue** et **soins ajoutés à un passage**.

```
usagesSoin(orig)          → { passages, plans, total }
retirerSoinCatalogue(orig) → retire du catalogue ET des plans, PAS de l'historique
menuSoin(chip, p, f)      → menu d'appui long sur un soin de passage
```

⚠️ **Le catalogue est une liste de choix, pas une source de vérité.** Un passage
enregistré stocke le **texte** du soin, pas une référence : retirer une ligne du catalogue
ne touche donc à aucun historique. C'est le principe qui rend la suppression sûre.

En revanche le **plan de soins est nettoyé** (avec `planSlots` et `planRythme`) — sinon
l'app proposerait un soin qui n'existe plus.

Soin personnalisé → effacé de `catalog.custom`. Soin d'origine → ajouté à
`catalog.disabled`, donc réactivable.

⚠️ **Un soin renommé garde son nom d'origine comme clé** (`catalog.overrides`) : toujours
comparer sur les deux, sinon le comptage d'usages et le nettoyage manquent leur cible.

**L'appui long sur un soin** ouvrait directement le commentaire — un soin ajouté par erreur
n'avait aucun moyen d'être retiré. Il ouvre maintenant un menu, sauf s'il n'y a qu'une
option (soin du plan sans commentaire) : dans ce cas il va droit au commentaire.

## Rappel fait → information de relève

```
r.resultat   = "Récupéré : le médicament à la pharmacie"
r.resultatAt = "YYYY-MM-DD"
resultatPropose(txt) → propose le résultat depuis le libellé du rappel
```

Un rappel coché **disparaissait sans laisser de trace** : le collègue ne savait pas s'il
était fait ou supprimé. Cocher ouvre désormais un `askText()` pré-rempli ; le résultat
s'affiche en `✅` dans la relève, à côté des `📌` restants.

L'information **reste jusqu'à suppression manuelle** (choix explicite, pas d'expiration
automatique). L'écran Rappels la range dans une section « Notés dans la relève ».
Décocher efface `resultat` et `resultatAt`.

⚠️ **Accorder un participe passé en français demande le genre et le nombre** — impossible
sans dictionnaire. « Récupérer le médicament » → « Médicament récupéré » marchait, mais
« Commander des compresses » → « Compresses commandé » était faux. La forme retenue est
**impersonnelle** : « Récupéré : le médicament », toujours correcte quel que soit le
complément. Le texte reste modifiable avant validation.

**En pause** : l'échéance avec décompte sur une information épinglée (option A) ou la
création d'un rappel de suite (option B) — à trancher.

## Bouton du déroulé — ne jamais écraser un bouton structuré

⚠️ `exitSeqMode()` faisait `bouton.textContent = "▶"`, ce qui **efface tout le contenu** :
l'icône SVG *et* le `<span>` du libellé. Le mot « Déroulé » disparaissait au premier
lancement et ne revenait jamais. À l'entrée, `textContent = "⏹"` produisait le même effet
avec un carré d'emoji.

`majBoutonSeq(actif)` remplace **seulement** l'icône (`outerHTML` du svg) et le texte du
`<span>`, en conservant la structure. Le libellé bascule « Déroulé » ↔ « Quitter » et le
bouton prend la classe `.primary` en mode actif.

**Règle** : sur un bouton composé (icône + libellé), utiliser `textContent` sur le bouton
lui-même détruit sa structure. Toujours cibler l'élément précis.

## Impression — window.print() ne marche pas sur Android

⚠️ **Le WebView Android n'implémente pas `window.print()`.** L'appel ne fait rien et **ne
lève aucune erreur** — le `catch` n'attrapait donc rien, et le bouton restait muet sans le
moindre message. Le défaut touchait cinq écrans : feuilles domicile, DLU, fiche de
traitement, export de fiche, export des constantes.

`imprimerDocument(html, base)` (fiche.js) sépare les deux cas :
- **navigateur** → `window.open()` puis `print()` (une fenêtre s'imprime mieux qu'une iframe)
- **app Android** → écriture en cache puis `FileOpener.open()` : le service d'impression du
  système prend le relais et propose imprimantes et « Enregistrer en PDF ». Repli sur
  `Share.share()` si FileOpener manque, puis message honnête.

**Toujours tester l'impression dans l'app, pas seulement en navigateur** — c'est
exactement l'écart qui a laissé passer ce défaut.

## Filtre « Aucune » (curTour === "none")

Vide la liste des patients sans changer de tournée. `pool = []` en amont, et un `uiEmpty()`
dédié plutôt que le message générique. Sert à retrouver un écran net ; **ne masque pas les
compteurs ni les rappels** — ce n'est pas un mode confidentialité.

## Dossier d'enregistrement (dossier.js)

```
dossierPossible()  → "web" | "natif" | "auto" | "aucun"
choisirDossier()   → ouvre le sélecteur adapté
dossierLabel()     → libellé affiché dans les réglages
ecrireDansDossier(fname, data, opts) → chemin, ou null si repli
oublierDossier()   → revient au comportement par défaut
```

Trois capacités selon la plateforme, **on ne promet jamais plus que ce qui existe** :

| Plateforme | Choix du dossier | Mécanisme |
|---|---|---|
| Android (app) | ✓ mémorisable | `JMSaveFile.pickFolder()` |
| Windows Chrome/Edge | ✓ mémorisable | `showDirectoryPicker()`, poignée en IndexedDB |
| iPhone Safari | ✗ impossible | téléchargement + menu de partage |

`saveToDevice()` tente le dossier choisi **en premier** ; en cas d'échec (autorisation
expirée, dossier supprimé) il reprend la voie normale sans rien perdre — l'incident est
journalisé.

⚠️ **La poignée web n'est pas sérialisable** : elle vit dans IndexedDB sous `__dossier__`,
pas dans le state. Et l'autorisation peut expirer entre deux sessions : `queryPermission`
puis `requestPermission` avant chaque écriture.

⚠️ **Les sauvegardes ne sont PAS chiffrées.** `exportBackup()` produit un `JSON.stringify`
en clair : noms, dates de naissance, adresses, transmissions, et le contenu base64 des
documents. Un avertissement le dit désormais à la première sauvegarde (`S.bkAvertiVu`).
Une option « protéger par mot de passe » reste à faire — nécessaire pour qu'une sauvegarde
déposée dans un nuage soit restaurable depuis un autre appareil.

## Sauvegarde — la fenêtre de perte

⚠️ **`save()` était différée de 300 ms sans filet.** Le scénario de perte : valider un
passage puis ranger le téléphone → Android suspend l'app → le `setTimeout` ne part jamais →
la donnée reste en mémoire. **Aucune alerte** : l'app n'a jamais su qu'elle devait écrire.

```
save()          → différée 300 ms (frappe)
save(true)      → écrit immédiatement (gestes lourds)
flushSave()     → force l'écriture en attente
_saveDirty      → une écriture est-elle en attente ?
```

L'app force elle-même l'écriture sur `visibilitychange` (hidden), `pagehide`, `freeze` et
`blur`. Les gestes qu'on ne veut jamais perdre — valider un passage, supprimer, importer,
faire le ménage — appellent `save(true)`.

## save(true) — la liste complète

Tout geste qui **crée ou détruit une donnée** doit écrire immédiatement. La liste, à tenir
à jour :

| Geste | Fichier |
|---|---|
| Valider un passage (carte) | ui.js |
| **Valider un passage (déroulé ▶)** | seq.js |
| Annuler un passage | ui.js |
| Ajouter un document | sheets.js |
| Créer un rappel · un bilan | sheets.js |
| Corbeille, suppression, ménage | sheets.js, menage.js |
| Ajouter/retirer un médicament | traitement.js |
| Importer une sauvegarde | storage.js |

⚠️ **Une recherche par motif ne suffit pas.** La validation du déroulé appelle
`form._commitVisit(true)` puis `save()` — aucun `visits.push` sur la ligne, donc invisible
à une recherche sur ce motif. Elle est restée différée une version de plus que les autres.
Pour vérifier : chercher les `save()` **sans argument** situés à moins de 10 lignes d'une
modification de `S`.

## Journal des incidents

`logIncident(source, message, err)` — les 27 `catch` vides avalaient les erreurs sans
trace. Le journal garde 50 entrées, **sans aucune donnée patient** : date, origine, message
technique. Consultable dans Réglages → Données → 🩺 Santé de l'application.

## Santé de l'application (features.js)

`sheetSante()` : contenu (patients, passages, documents), stockage occupé via
`navigator.storage.estimate()`, dernière sauvegarde, incidents récents, et
`verifierIntegrite()` qui repère les incohérences — tournée référencée mais supprimée,
rappel pointant vers un dossier disparu, passage sans date. **La vérification ne modifie
rien**, elle signale.

## Numérotation et signature Android

```
package.json : version "1.0.01"  ·  androidVersionCode 78
```

Deux nombres distincts : **le numéro affiché** (v1.0.01, lisible) et le
**versionCode Android** (78, technique). Android refuse une installation dont le
versionCode est inférieur ou égal à celui installé — il ne doit **jamais reculer**, même
quand le numéro affiché reste en 1.0.

⚠️ **Les mises à jour échouaient** parce que chaque dossier Android neuf régénère une
**clé de débogage différente**. Android refuse d'installer par-dessus quand la signature
change. Une clé permanente, rangée hors du projet et déclarée dans `keystore.properties`,
règle le problème — marche à suivre dans `TUTO_CLE_SIGNATURE.md`.

## Écran de démarrage (#boot)

⚠️ **Le splash NATIF d'Android est une image fixe** : ni animation, ni thème. `#boot` prend
le relais dès que le CSS est chargé, retiré par `hideBoot()` une fois l'app prête, avec un
filet à 3,5 s si le démarrage échoue.

⚠️ **Fond opaque obligatoire** : `background-color:var(--bg)` en plus du dégradé. Sans la
couleur pleine, l'écran est translucide et l'application se voit au travers.

**L'icône Android ne peut être ni animée ni changée selon l'heure** — question posée, réponse
technique négative. Les icônes alternatives existent mais cassent le raccourci de
l'utilisateur.

## Manuel — le sommaire figé sur téléphone

⚠️ `nav{position:sticky}` convient à un écran d'ordinateur. Sur un téléphone, ce sommaire
de **20 entrées occupait 685px sur 900**, soit 76 % de la hauteur, en restant figé : le
texte défilait derrière une barre plus grande que lui.

```
@media (max-height:820px), (max-width:600px){
  nav{ position:static }  nav .wrap{ display:none }  nav.open .wrap{ display:flex }
}
@media (min-height:821px) and (min-width:601px){ nav .toc-btn{ display:none } }
```

Résultat : **42px** au lieu de 685, un bouton « 📑 Sommaire » qui déplie au tap, et
l'ordinateur inchangé.

⚠️ **L'ordre des règles CSS compte** : le media query doit venir **après**
`nav .wrap{display:flex}`, sinon la règle générale l'emporte. Premier essai raté pour cette
raison. Vérifié par `_test_manuel`.

⚠️ **Attention aux f-strings de `gen.py`** : y insérer du CSS casse la génération, les
accolades étant interprétées. Le bloc doit aller dans la chaîne de style, pas dans le
gabarit.

## Aperçu en iframe — les ancres du sommaire

⚠️ **`fr.srcdoc = html` donne une iframe SANS URL de base.** Un lien `#intro` du sommaire
n'y trouve pas sa cible : le WebView le résout au niveau du document parent et **recharge
l'application** — l'utilisateur se retrouve sur l'écran principal.

`showFichePreview()` injecte donc dans le `<head>` :
- `<base target="_self">` pour garder la navigation dans le cadre
- un écouteur qui intercepte les `a[href^="#"]` et fait le `scrollIntoView` à la main

Vérifié : un clic sur « 2. L'écran principal » fait défiler de 2689px dans le manuel, sans
sortir de l'aperçu.

⚠️ **Les boutons d'export du guide** ne figuraient qu'en bas de page, après tout le
contenu — introuvables sans le savoir. Doublés en tête (`guide-dl-html2`, `guide-dl-pdf2`).

## Largeurs de champs — le nom a besoin de plus de place qu'un numéro

⚠️ L'annuaire d'urgence donnait **71px au nom** (`flex:1` dans une grille à deux colonnes)
et **110px fixes au téléphone**. Rapport inversé : « Mme Malguent » s'affichait « elguent ».

```
Avant : grid 1fr 1fr · nom flex:1 · tél width:110px
Après : flex column  · nom flex:2.2 · tél flex:1    → 246px / 127px
```

**Ne jamais figer un champ texte en pixels** dans un conteneur flexible : il vole la place
au champ voisin qui en a plus besoin.

Mesure d'un champ : créer un `<span>` invisible avec la même police, y mettre la valeur ou
le placeholder, comparer `offsetWidth + 26` à la largeur réelle. C'est ce que fait
`_test_largeurs` sur la structure du code.

## ⚠️ Un bouton sans gestionnaire est muet et silencieux

Poser un `<button id="f-x">` sans `$("#f-x").onclick = …` produit un bouton **visible,
cliquable, et qui ne fait rien** — aucune erreur en console. C'est arrivé au bouton
« Fiche de recueil » : le remplacement du gestionnaire avait échoué silencieusement parce
que le motif cherché ne correspondait pas au code réel.

**Toujours vérifier après avoir ajouté un bouton** : `_test_boutons` parcourt les quatre
onglets de la fiche patient et signale ceux dont `onclick` est nul.

## Nomenclature des documents (docs.js)

```
DOC_FAMILLES              → 5 familles, 17 types, chacun avec ses précisions
docType(cle)              → { lbl, court, prec[], garderImage }
docNomCompose(t,p,date)   → 2026-09-08_Ordo-medecin_Renouvellement
docLabel(d) · docAQualifier(d)
imagesVersPdf(dataUrls)   → assemble en A4 200 dpi, ~85 % plus léger
qualifierDoc(nb,poids,mime) → Promise<{type,precision,format,nom}|null>
d.type · d.precision      → nouveaux champs du document
```

⚠️ **La synchronisation comparait les documents par NOM DE FICHIER.** Deux confrères
scannant la même ordonnance créaient deux entrées ; deux documents distincts au même nom
s'écrasaient. `sync.js` compare désormais **type + date**, avec repli sur le nom pour les
documents antérieurs.

⚠️ **Le nom composé n'a ni accent ni espace** : il sert aussi de nom de fichier au partage.
`normalize("NFD")` puis suppression des diacritiques.

⚠️ **`garderImage:true` sur le type plaie** : la conversion PDF réduit la définition et
l'original n'est pas conservé. Sur une plaie, le zoom sert au suivi — jamais de conversion
par défaut.

Les documents sans `type` restent valides et portent une pastille « à qualifier ». Aucune
migration forcée.

## Fiche de recueil (recueil.js)

```
sheetRecueil(pid)              → l'écran, tout à la suite
recueilInfo(p, type)           → informations d'un type groupées par « · »
recueilSetInfo(p, type, txt)   → réécrit UNE information de ce type
recueilAvance(p)               → { remplis, total } pour la barre
imprimerRecueil(p, vierge)     → une page remplie · trois pages vierges
```

⚠️ **Ce n'est PAS un document séparé** : c'est une autre vue du dossier. Écrire dans la
fiche écrit dans `p.*` directement, sans copie intermédiaire. Décision prise pour éviter
deux sources de vérité qui divergent — un piège classique quand deux écrans détiennent la
même information.

⚠️ **`recueilSetInfo` conserve le `show` de la première information existante.** Sans ça,
un simple passage dans la fiche ferait disparaître une vigilance de la relève.

⚠️ **`fmtFR` est un format court sans année** — correct pour une date de passage, faux pour
une date de naissance. La fiche imprimée utilise `dob.split("-").reverse().join("/")`.

La chaîne reste : **recueil → fiche patient → DLU**. Le DLU n'est pas touché, il continue
de puiser dans le dossier comme avant.

## Note vocale (vocal.js)

```
voicePossible()          → MediaRecorder + getUserMedia disponibles ?
voiceStart(onTick, onStop) / voiceStop() / voiceEnCours()
voiceGarder(note)        → conserve en IndexedDB "voice_<id>"
voicePurge()             → ménage selon S.voiceRetention
VOICE_MAX_S = 180, VOICE_MAX_NB = 2, VOICE_MENTION
```

⚠️ **Les blobs audio vivent dans IndexedDB, jamais dans le state** : non
sérialisables en JSON, et ils feraient exploser la taille des sauvegardes. Seules les
métadonnées (`S.voiceNotes`) sont dans le state.

⚠️ **Libérer le micro** : `flux.getTracks().forEach(t => t.stop())` dans `onstop`, sinon
l'indicateur d'enregistrement reste allumé sur le téléphone.

⚠️ **`URL.revokeObjectURL`** après envoi ou suppression, sinon les blobs s'accumulent en
mémoire pendant la session.

Format : `audio/mp4` (m4a) si l'appareil sait l'encoder, repli webm/ogg. `voiceExt()`
donne l'extension du fichier joint.

**La mention de secret professionnel** est ajoutée au message de partage dès qu'une note
est jointe. Elle ne protège pas techniquement — elle engage le destinataire, ce qui manque
quand la relève passe par une messagerie ordinaire. L'app efface la note **chez
l'expéditeur** uniquement : ne jamais laisser croire le contraire.

## Chiffrement — état réel

```
_aChiffrer(k) → k === "state" || k.startsWith("doc_")
```

**Chiffré en AES-GCM** (clé dérivée par PBKDF2, 100 000 itérations) : le dossier patient
**et les documents** — ordonnances, comptes-rendus, photos de plaies.

⚠️ **`__secret__` reste en clair** : c'est la clé elle-même. Qui accède au système de
fichiers l'obtient. Le vrai remède est de **rendre le code PIN obligatoire**, ce qui fait
entrer un secret que l'appareil ne détient pas. Noté dans `CONFORMITE_A_PREPARER.md`.

⚠️ **Les documents antérieurs restent en clair** et sont lisibles tels quels : `idbGet` ne
déchiffre que si `_enc` est présent. Ils se rechiffrent à la première réécriture. Pas de
migration forcée — elle bloquerait l'app au démarrage sur un dossier volumineux.

⚠️ **Le fichier de synchronisation circule toujours en clair.** Point ouvert, à trancher
avec le juriste : une messagerie sécurisée rendrait peut-être le chiffrement par mot de
passe superflu.

## Jeux de test — aucune donnée réelle

⚠️ 15 tests contenaient encore des noms de patients réels, et ils sont **livrés dans le ZIP
et poussés sur un dépôt public**. Nettoyés.

⚠️ **Ne jamais écrire les vrais noms dans un fichier du dépôt**, pas même dans une commande
de vérification — ils y seraient exposés exactement comme dans les tests qu'elle contrôle.
La liste des noms à chercher se garde hors du projet.

À vérifier avant chaque livraison :

```bash
grep -riE "nom de patient réel" tests/ www/js/   # tenir la liste HORS du dépôt
```

## Anniversaire

```
ANNIV_AVANT = 3 · ANNIV_APRES = 1
annivJours(p, refISO)  → -1..3, ou null hors fenêtre
annivTexte(p, refISO)  → "86 ans aujourd'hui" · "anniversaire demain"
```

Affiché sur la carte patient, dans le déroulé et dans la relève — l'IDEL ne passe pas
forcément le jour J, et le collègue doit pouvoir souhaiter.

⚠️ **Le 29 février n'existe pas les années ordinaires** : repli sur le 28, sinon ces
patients n'auraient jamais d'anniversaire.

⚠️ **Anniversaire en début janvier vu depuis fin décembre** : la date de l'année courante
est déjà passée, il faut chercher celle de l'année suivante.

## J-1 — reprendre le bon créneau

⚠️ `[data-clone]` prenait **le dernier passage tout court**. Le matin, il ressortait le soir
de la veille — pilulier du soir et coucher dans un passage du matin.

Le filtre porte maintenant sur `v.slot === créneau courant`, avec repli sur le dernier
passage connu si le créneau n'a jamais eu de passage.

## Annulation dans le déroulé

⚠️ `openId = null; render()` referme la carte **sur l'écran principal**. Dans le déroulé, le
formulaire n'est pas une carte : il restait affiché avec son texte, alors que le brouillon
était bien effacé. `renderSeq()` quand `seqActive`.

## Surveillance des selles

```
SELLES_VAL           → 0 · + · ++ · +++ · ++++ · diarrhee
c.selles             → clé dans v.consts, comme temp ou puls
joursSansSelle(p)    → jours consécutifs RENSEIGNÉS à "0"
seuilSelles(p)       → p.seuilSelles, défaut 3
alerteSelles(p)      → n si n >= seuil, sinon 0
```

⚠️ **`"0"` est une VALEUR**, pas l'absence de saisie. Toute la logique repose sur cette
distinction : `c.selles !== undefined && c.selles !== ""` pour tester la présence, jamais
un test de vérité (`if (c.selles)` exclurait le 0).

⚠️ **Un jour non renseigné remet le compteur à zéro.** Décision de l'IDEL : sans relevé, on
ne peut pas distinguer « pas de selle » de « pas noté ». Mieux vaut rater une alerte que
d'en lever une fausse. `joursSansSelle` s'arrête au premier jour absent en remontant.

Le seuil est **réglable par patient** (`p.seuilSelles`) : le transit varie, 5 jours peut
être la norme.

## Tendances (tendances.js)

```
trendOf(p, "poids"|"ta") → { delta, jours, n, debut, fin, depuis, jusqu } | null
trendsOf(p)              → toutes les tendances du patient
trendTexte(t)            → « Poids en baisse : -2.4 kg en 22 jours »
trendHtml(p)             → encart pour la fiche
```

Les seuils alertent sur **une valeur** hors bornes. Ils ne voient pas une dérive lente où
chaque mesure reste normale : six pesées au-dessus du seuil, et pourtant −2,4 kg en trois
semaines.

**Garde-fous** : au moins 4 mesures, sur 14 jours minimum, fenêtre bornée à 90 jours, et la
dernière mesure de moins de 30 jours. Sous ces conditions on signalerait du bruit.
Seuils de déclenchement : 2 kg pour le poids, 1,5 point de systolique.

⚠️ **Formulation neutre, jamais un diagnostic.** L'app dit « le poids a baissé de 2,4 kg » —
pas « dénutrition probable ». L'interprétation revient à l'IDEL, et l'encart le rappelle.

**Poids et TA seulement** : la glycémie varie trop d'un jour à l'autre, la température n'a
de sens qu'en valeur absolue.

## Batterie de tests (tests/)

23 tests automatisés, livrés avec le projet. Chacun charge l'app dans un navigateur simulé
(jsdom + fake-indexeddb), joue un scénario et vérifie le résultat. Mode d'emploi complet
dans `tests/README_TESTS.md`.

```bash
cd tests && npm install jsdom fake-indexeddb
node _test_selles.js          # un test
```

**Chacun existe parce qu'un défaut réel est passé.** Le README des tests détaille lequel —
c'est ce qui les rend lisibles pour qui reprend le projet.

⚠️ **Ce qu'ils ne voient pas** : le rendu sur un vrai appareil (le `▶` qui bascule en emoji),
les limites du WebView (`window.print()`), et les zones cliquables recouvertes. Les captures
d'un usage réel restent irremplaçables.

## ⚖️ Conformité — avant toute diffusion

**Voir `CONFORMITE_A_PREPARER.md`** — note complète pour la consultation juridique.

En résumé, trois questions ouvertes :

1. **Statut de dispositif médical.** Les seuils d'alerte, les tendances et l'alerte de
   transit **interprètent** les données au lieu de les afficher. C'est la frontière décrite
   par la réglementation. Un avertissement est envisagé, mais ne tranchera pas la question.
2. **Base légale du dossier patient.** Un consentement rétractable serait contradictoire
   avec l'obligation de conserver le dossier. Piste retenue : export du dossier pour
   répondre à une demande d'accès, sans case à cocher.
3. **Canal de transmission** des relèves et notes vocales.

⚠️ **Rien n'a été codé sur ces points.** L'app reste à usage personnel jusqu'à l'avis
juridique.

**Ce qui joue en faveur du projet** : aucun serveur distant, base locale chiffrée. La
certification HDS vise ceux qui hébergent pour le compte d'un tiers — ce n'est pas le cas
ici.

**Le point faible connu** : la sauvegarde exportée est **en clair**.

## À revoir plus tard

**Suivi de plaie.** Proposé et retenu le 7 septembre 2026, puis oublié dans l'enchaînement —
à reprendre. Aujourd'hui les photos de plaie vivent dans les Documents du patient, sans
lien entre elles : impossible de voir l'évolution d'un escarre sur trois semaines.

Piste envisagée : un objet `p.plaies = [{ id, nom, localisation, stade, protocole,
releves:[{ date, docId, larg, long, note }] }]`. Les photos datées côte à côte, les mesures
en regard, le protocole en cours. Utile pour le médecin et pour justifier la cotation.

À décider si on le reprend : une plaie par patient ou plusieurs, et si les photos existantes
doivent pouvoir être rattachées après coup.


**Signaler les soins du plan non réalisés.** Idée écartée en septembre 2026 : le plan
contient des soins non quotidiens (pilulier hebdomadaire, bas de contention selon le choix
du patient), et signaler leur absence créerait du bruit. Une piste existe — s'appuyer sur
`p.planRythme`, aujourd'hui purement décoratif, pour ne signaler qu'un soin *attendu ce
jour-là*, avec un réglage « selon le besoin » par défaut qui ne déclenche rien. À reprendre
si le besoin se confirme à l'usage. En attendant, l'IDEL note manuellement dans la relève.

## Adoption du kit — état

Les rangées titrées sont maintenant employées dans **7 fichiers sur 11** : ui, sheets,
menage, seq, feuilles, traitement, dlu.

**Comment convertir un écran** : un `<div class="lab">Titre</div>` en tête de section
devient `<div class="rowlab TON"><span>Titre</span><i></i></div>`, suivi d'un
`<div class="rowbox TON">` qui enveloppe le contenu — c'est lui qui porte le liseré.
Un `<span class="lab">` **dans un `.field`** reste une étiquette de champ : ne pas le
convertir.

Tons par nature : `ac` accent (choix principal) · `bl` bleu (paramètre) · `am` ambre
(temporalité, alerte douce) · `vi` violet (format, sortie) · `nt` neutre.

Restent `features`, `share`, `fiche`, `engine` — leurs écrans sont surtout des documents
imprimés, où le kit ne s'applique pas.

## Mode déroulé — ce qu'il faut masquer

⚠️ **La signature est un bloc SÉPARÉ de `.footer-note`.** Masquer seulement `.footer-note`
laissait « JM@Santé by JmCve83 » visible au milieu de l'écran, avec le déroulé affiché
loin en dessous.

```
enterSeqMode() masque : #board, #synth, #filters, .footer-note, .signature
body:has(#seq-mode.on) .wrap{ padding-bottom:0; }   /* sinon 110px de vide */
```

Résultat : 11px entre la rangée Affichage et l'écran séquentiel, au lieu de 200.

## Mode déroulé — la barre fixe masquait le bouton Enregistrer

⚠️ **`#seq-mode` est HORS de `.wrap`** : il n'hérite pas de ses `padding-bottom:110px`.
Sans réserve propre, le dernier bouton du formulaire passait **sous `.bottombar`**
(`position:fixed`, `z-index:50`) — visible mais intapable. Symptôme trompeur : l'écran
s'affiche normalement, les soins se cochent, mais « Enregistrer » ne répond pas.

```
#seq-mode.on{ padding:0 12px calc(118px + env(safe-area-inset-bottom)); }
```

**Règle générale** : tout conteneur plein écran placé hors de `.wrap` doit réserver au
moins 110px en bas, plus `env(safe-area-inset-bottom)`. Vérifié par `_test_seq_clic`.

**Méthode de diagnostic** : `document.elementFromPoint(x, y)` au centre d'un élément dit
qui reçoit réellement le clic. Si ce n'est pas l'élément lui-même, quelque chose le
recouvre.

## Cache du WebView — marqueur de version

Les ressources portent `?v=VERSION`, ajouté par `build.js` à chaque build. Sans lui, le
WebView Android peut servir le CSS d'une ancienne installation avec le nouveau JS.
`sw.js` utilise `caches.match(req, { ignoreSearch:true })` pour que le cache hors ligne
continue de fonctionner malgré le marqueur.

## Rangées de filtres — ne jamais forcer une seule ligne

⚠️ `.filters .rowbox{ flex-wrap:nowrap }` écrasait les boutons : un nom de tournée long
recevait 65 px pour un contenu de 161 px, le texte **sortait du cadre** et se superposait au
libellé suivant. Illisible.

```
.filters .rowbox{ flex-wrap:wrap; }
.filters .rowbox .fchip{ flex:0 1 auto; min-width:0; max-width:100%;
                         white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
```

Chaque bouton garde sa largeur naturelle, la rangée passe à la ligne. `text-overflow`
tronque proprement si un seul nom dépasse la largeur de l'écran.

**Toujours vérifier `scrollWidth > clientWidth`** sur les boutons après un changement de
disposition — un débordement ne se voit pas sur des libellés courts.

## Échelles typographique et de rayons

```
--fs-xl 23px · --fs-lg 17px · --fs-md 14px · --fs-sm 12px · --fs-xs 10.5px · --fs-lab 9px
--r-sm 8px · --r-md 11px · --r-lg 16px · --r-full 99px
```

L'app comptait **32 tailles de police** (de 7 à 30 px) et **22 rayons**. Un écart de 0,5px
ne se voit pas mais empêche l'œil de hiérarchiser. Ramenés à 6 et 4 ; 79 tailles et 81
rayons alignés automatiquement, avec une tolérance de 1px / 2px — au-delà, la valeur est un
choix délibéré qu'on ne touche pas.

⚠️ **Ne jamais descendre sous `--fs-lab` (9px)** dans l'interface. Les libellés de la barre
d'outils étaient à 7,5px : illisibles au bras tendu, en tournée.

## Couleurs figées — ce qui est légitime et ce qui ne l'est pas

Le décompte brut donnait 169 couleurs en dur dans le JS. En réalité, **la quasi-totalité est
volontaire** :

| Contexte | Nombre | Verdict |
|---|---|---|
| Documents imprimés (`*Html()`) | ~150 | **légitime** — une feuille sort noire sur blanc quel que soit le thème écran |
| Palette des thèmes (`globals.js`) | 6 | **légitime** — ce sont les pastilles du sélecteur |
| Signature manuscrite (canvas) | 2 | **légitime** — encre noire sur fond blanc |
| Boutons d'interface | 2 | **corrigés** — le rouge du DLU devenait un bloc sombre sur thème clair |

Leçon : **compter ne suffit pas**, il faut regarder le contexte. Un `#fff` dans un document
imprimé n'est pas le même défaut qu'un `#fff` dans un bouton d'écran.

## UI-kit — le vocabulaire visuel commun (uikit.js)

```
uiRow(label, ton, html, extra)   → rangée titrée : mot-repère + dégradé + liseré
uiListRow({ic,titre,detail,etat,ton,data})  → gabarit unique de ligne de liste
uiEmpty(ic, titre, aide, action) → écran vide qui dit quoi mettre là
uiActions(annuler, valider, danger) → pied de feuille normalisé
uiCat(ic, nom, n, html, i)       → section de catalogue, couleur par famille
UI_TONS = ["ac","bl","am","vi","nt"]
```

Le langage introduit sur le Moniteur (mot-repère, liseré coloré, dégradé) ne vivait que là :
les 39 autres écrans gardaient des titres bruts empilés. Ces fonctions le rendent disponible
partout — **un seul endroit à corriger** pour toute l'application.

Chargé **tôt** dans l'ordre du build (juste après `globals`) puisque tous les modules
s'en servent.

**Conventions posées** : action secondaire à gauche, principale à droite et 1,4× plus large
(`.uiact` en grid) ; les actions destructrices restent séparées en dessous (`.uidanger`) ;
le liseré d'une ligne de liste porte son **état** — turquoise fait, ambre à faire, gris en
attente.

## Bandeau de marque

`.brand` en tête du Moniteur : la cigale porte l'identité de l'application plutôt que d'être
un bouton parmi cinq. Elle reste cliquable (`data-a="tours"`) — la pastille `.brand-gear` ⚙
le signale — et **« Cigale » demeure dans la barre d'outils** pour ceux qui la cherchent là.
Le nom `JM@Santé` passe devant « Moniteur », le slogan quitte l'en-tête.

Trois couches : le filigrane `.brand-fili` (silhouette seule, sans yeux ni croix, opacité
.07), le logo animé, et le texte. L'animation `cg-wing` + `cg-glow` en CSS, avec repli
`prefers-reduced-motion`.

⚠️ **La croix médicale de la cigale ne doit pas être blanche en dur.** Elle se découpe dans
la couleur du support : `.cig-x` prend `--surface` dans la barre d'outils et `--bg` sur le
logo du bandeau. Un `#fff` figé la rendait invisible sur les thèmes clairs et déformait le
dessin sur le bandeau teinté.

## En-tête du Moniteur — frise et rangées

**`friseSvg(theme)`** (features.js) rend la bande animée sous la barre d'outils :
`hopital` le tracé ECG d'origine (v49) qui défile · `reunion` vagues + baleine et aileron
qui traversent · `tubes` tube de néon dégradé · `bloc`/`verre` un tracé cardiaque fixe.

⚠️ **Animations en CSS, jamais en SMIL.** Un `<animateTransform>` dans un SVG injecté par
`innerHTML` ne démarre pas : les silhouettes restaient figées à leur position de départ,
et le dégradé du néon ne glissait pas. Les classes `.fr-ecg`, `.fr-whale`, `.fr-fin`,
`.fr-neon` portent des `@keyframes`, avec un repli `prefers-reduced-motion`.
Redessinée **seulement si `S.theme` a changé** (`#frise` porte `dataset.th`), sinon chaque
`render()` relancerait les animations.

⚠️ **Piège SVG — boîte englobante de hauteur nulle.** Une `<line>` horizontale a une bbox
plate : un `linearGradient` ou un `filter` en unités relatives (le défaut) ne s'y applique
pas — le trait reste gris et le halo disparaît. Les deux doivent être en
`gradientUnits="userSpaceOnUse"` / `filterUnits="userSpaceOnUse"` avec des coordonnées
explicites. Vaut pour toute future frise linéaire. **Trois fois** le cas s'est présenté :
le dégradé du néon, son filtre de halo, et le trait sobre de bloc/verre — invisible pour
la même raison.

⚠️ L'ancien tracé ECG était un `background` animé sur `.header` (thème hôpital) — retiré,
sinon il fait doublon avec la frise.

**Rangées de réglages** — chacune est précédée d'un `.rowlab` (mot-repère + dégradé) et
enveloppée dans un `.rowbox` à liseré coloré : `ac` accent, `am` ambre, `bl` bleu, `nt`
neutre. Les couleurs viennent des variables de thème, donc les cinq thèmes suivent.

**Compteurs = filtres** — « À voir », « Vus » et « Vigilance » existaient en double
(compteur + bouton), ce qui allongeait la barre jusqu'au défilement horizontal. Les `.spill`
portent maintenant `data-f` ; un second tap sur le filtre actif remet « Tous ». La barre
`.filters` ne garde que Tous · Sans passage · Absents · compact, en `flex-wrap:nowrap`.

## Fiche de traitement structurée (traitement.js)

```
p.traitement = { lignes:[{id,nom,m,mi,s,c,sibesoin,forme,note}], maj, prescripteur }
sheetTraitement(pid)  → écran de saisie (18ᵉ module)
traitTexte(p)         → texte compact ; REPLI sur l'info « traitement » si vide
traitHtml(p)          → fiche imprimable A4
RX_ANTICOAG           → détection des anticoagulants (partagée avec le DLU)
```

**Le texte libre n'est jamais effacé** : l'ancienne info de type « traitement » reste dans
`p.infos`. `traitTexte()` renvoie la fiche structurée si elle contient au moins une ligne,
sinon le texte libre. Aucune migration automatique — décision explicite, l'IDEL ressaisit
quand il veut.

⚠️ `dlu.js` appelle `traitTexte()` et `RX_ANTICOAG` définis dans `traitement.js`, chargé
**après** lui dans l'ordre du build. Sans conséquence : l'appel est à l'exécution, pas au
chargement. Ne pas transformer ces appels en initialisation de niveau module.

**Table imprimée** — `table-layout:fixed` avec largeurs explicites, sinon la colonne des
noms se réduit et coupe les libellés.

## Plan de soins par créneau

```
p.planSlots[soin] = { matin:true, soir:false }   // absent ⇒ les deux
planFor(p, slot)  → soins proposés à ce créneau
```

**Rétrocompatible par construction** : un soin sans entrée dans `planSlots`, ou dont les
deux cases sont décochées, reste proposé aux deux créneaux. Un patient existant ne change
pas de comportement. Si `S.slotsEnabled` est faux, `planFor` renvoie le plan entier et la
fiche affiche la liste de chips d'origine (pas la grille).

⚠️ **La relève doit comparer au plan DU CRÉNEAU du passage**, pas au plan entier : sinon un
soin du soir apparaît « hors plan » dans un passage du matin. Trois emplacements dans
`engine.js` utilisent `planFor(p, v.slot || defaultSlot())` — mode synthétique, mode
structuré et mode sélection.

`planList()` lit `.chip[data-p]` **et** `.pg-r[data-p]` : les deux présentations coexistent.

⚠️ **Ne jamais appeler `sheetPatient(p)` pour refléter un changement dans la fiche** — cela
rouvre tout et ramène au premier onglet. Cocher plusieurs cases devenait impraticable.
`bindPlanRow(row)` met à jour la case sur place et `addToPlan` insère une ligne complète
(avec ses deux cases) puis la lie. Même règle pour le rythme et le retrait d'un soin.

## Date de travail — saisie différée

```
workDate()        → date affichée (aujourd'hui par défaut)
isToday()         → sommes-nous sur aujourd'hui ?
setWorkDate(iso)  → borné à MAX_RECUL (30 j) ; null ⇒ aujourd'hui
shiftWorkDate(n)  → flèches ‹ ›
workDateLabel()   → « hier », « il y a 3 jours »
```

⚠️ **`todayISO()` ne doit plus décider de « aujourd'hui » dans l'interface.** Tout ce qui
dépend du jour affiché utilise `workDate()` : `statusOf()`, l'étiquette « vu à », le
rechargement d'un passage, la détection de doublon, la date d'une visite créée, `S.noVisit`,
et les dates par défaut de la relève. `todayISO()` reste pour ce qui est réellement lié au
présent (horodatage d'un envoi, calcul d'échéance d'un rappel).

**Le futur est interdit** : `setWorkDate` ignore toute date ≥ aujourd'hui, la flèche droite
est `disabled` sur aujourd'hui.

**Non persistée** : `init.js` appelle `setWorkDate(null)` au démarrage — la date choisie ne
survit pas à une fermeture, pour éviter de saisir dans le passé sans s'en rendre compte.

**Document daté** — `docDate`, initialisée à `workDate()` dans `sheetAddDoc()`, modifiable
par un champ dédié. Permet de dater une ordonnance reçue plus tôt sans changer la date du
Moniteur.

## Ménage dans l'historique (menage.js)

```
sheetMenage(pid|null)  → écran unifié (17ᵉ module) ; pid ⇒ étape « patients » masquée
collecte(sel,bornes,doP,doC,solo)
exportArchive(data, fmt, bornes)   → html · txt · csv · json
faireLeMenage(...)                 → suppression effective
importArchive(txt)                 → réimport JSON avec choix par patient
```

**Archiver AVANT de supprimer** : `mn-del` reste `disabled` tant que `archiveFaite` est faux.
Un lien `mn-skip` permet de passer outre après confirmation. Toute modification d'un critère
(quoi, période, patients, format) **remet `archiveFaite` à faux** — sinon on supprimerait un
périmètre différent de celui archivé.

**Passages et constantes indépendants** : supprimer les constantes seules vide `v.consts`
sans retirer la visite. Documents, bilans et rappels ne sont jamais touchés (décision
explicite : aucune protection automatique sur les transmissions ou les valeurs anormales).

**Réimport** — `importBackupText` détecte `_jmarchive` et route vers `importArchive`, qui
compare les `uid` de visite pour ignorer les doublons et propose un choix par patient.

## Vocabulaire : archiver ≠ exporter

Trois actions distinctes, à ne pas confondre dans les libellés :

| Action | Effet |
|---|---|
| 📦 **Mettre de côté** (ex-« Archiver ») | `p.archived` — sort du Moniteur, **aucun fichier** |
| 📄 **Exporter la fiche** | Fichier pour **un** patient, historique en option |
| 🧹 **Ménage** | Archive **multi-patients par période**, puis suppression |

Le mot « archiver » est réservé à ce qui produit réellement un fichier.

## Vue Journée et fiche en onglets

**Vue Journée** — `activeSlot()` peut valoir `"jour"` : `inTourSlot()` renvoie alors vrai pour
les deux créneaux, et `render()` groupe les cartes en sections repliables (`.slotsec`,
état dans `S.slotFold`). `slotsOf(p, tour)` donne les créneaux d'un patient — un patient
matin **et** soir figure dans les deux sections.

⚠️ `.board` est une grille 2 colonnes : la vue Journée passe en `display:block`
(`.board.byslot`) et chaque `.slotsec-b` reprend la grille. Sans cela les sections
s'affichent côte à côte.

**Fiche en 4 onglets** — `.ftabs` / `.fpane`, une couleur par onglet. **Tous les champs
existants sont conservés**, seulement répartis : aucun `id` n'a changé, donc
l'enregistrement, le DLU et le bouton d'appel fonctionnent sans modification. Vérifié par
test : 10/10 champs présents et persistés après enregistrement depuis n'importe quel onglet.

⚠️ Les onglets sont une **grille** (`grid-auto-columns:1fr`), pas un flex — même raison que
partout ailleurs.

**Modification d'un passage** — rouvrir la carte d'un patient déjà vu recharge son passage
dans `_formDraft` avec `_editUid`. `commitVisit()` met alors à jour la visite existante au
lieu d'en créer une seconde, et le bouton devient « Enregistrer les modifications ».

**toast(msg, {label, action, ms})** — forme à deux arguments affichant un lien d'action.
Utilisée pour annuler un passage validé par erreur (6 s).

**Rythme d'un soin** — `p.planRythme[soin]`, facultatif, défini par appui long dans le plan.
Affiché à côté du soin dans la fiche et à la saisie.

⚠️ `decorateChip()` dans `bindInline` **réécrit tout le contenu** d'un chip de soin (pour
poser ✏️ ou 💬). Elle doit donc reconstruire le rythme elle aussi, sinon il s'affiche puis
disparaît dès la première décoration — invisible dans le code de `inlineForm`, qui est
pourtant correct. Toute décoration future du chip doit passer par cette fonction.

## Menu principal (bouton cigale)

`sheetTours()` affiche **6 rubriques** en deux présentations au choix, mémorisées dans
`S.menuMode` (`"tiles"` par défaut, ou `"list"`). L'interrupteur ▦ / ☰ est en haut à droite.

```
sheetTours()          ← menu, les deux vues
menuGo(sec)           ← routage unique des rubriques
menuSheet(t,html,sub) ← ossature d'un sous-écran (titre + retour + handlers)
bindMenuHandlers()    ← gestionnaires communs, TOLÉRANTS aux éléments absents
```

⚠️ `bindMenuHandlers()` redéfinit localement `$` pour renvoyer un objet inerte quand
l'élément n'existe pas : chaque sous-écran ne contient qu'une partie des boutons, et
un `$("#absent").onclick = …` planterait sinon toute la liaison.

Les six sous-écrans (`sheetToursList`, `sheetSharePanel`, `sheetPatientsPanel`,
`sheetDataPanel`, `sheetCatalogPanel`, `sheetAppPanel`) sont construits **explicitement** —
une première tentative par masquage dynamique du menu complet s'est révélée trop fragile.

**Après test terrain, un des deux modes sera retiré** — ne pas empiler de fonctionnalités
sur cette bascule tant que le choix n'est pas tranché.

## Feuilles domicile + export constantes (feuilles.js)

```
sheetFeuilles(pid)          → choix feuille + densité   (16ᵉ module)
feuilleHtml(p, type, dens)  → feuille VIERGE A4
sheetExportConst(pid)       → export de l'historique (bouton dans 📈 Courbes)
constHtml() / constTexte()  → courbes + tableau
```

**⚙️ `FEUILLE_CSS` en tête du module concentre toute la mise en page** — hauteur de ligne,
tailles de police. Si l'impression papier s'avère trop serrée ou trop petite, ce sont les
**seules valeurs à changer** ; la structure ne bouge pas. Valeurs actuelles calibrées pour
remplir une A4 sans déborder : `serre` 8.1 mm/ligne (31 lignes sur une page),
`confort` 15.5 mm (16 lignes recto + 15 verso).

⚠️ **Ne pas mettre `flex:1` sur la table** : la première ligne (l'en-tête) absorbait tout
l'espace disponible et occupait un tiers de la page. Un `<div class="sp">` vide en flex:1
pousse le pied de page vers le bas sans étirer le tableau.

**Grille mensuelle** — jours 1 à 31 pré-imprimés, sauf sur la feuille Poids où la date est
libre (la pesée n'est pas quotidienne). Le mois s'écrit à la main.

**Seuils** — `p.thresholds` du patient s'ils existent, sinon repères généraux. Pas de mention
du cabinet en pied de page (retirée à la demande).

## DLU — Dossier de liaison d'urgence (dlu.js)

```
sheetDLU(pid)            → écran de saisie (15ᵉ module, après fiche.js)
dluOutput(p, day, mode)  → "show" | "share" | "print"
dluHtml(p, day)          → le document
```

**Trois couches** : ① repris de la fiche (identité, `nir`, `prevenir`, `appareillages`,
contacts, et les `infos` typées vigilance/traitement/atcd/acces) ② autonomie, propre au DLU
③ constantes + motif du jour.

⚠️ **L'autonomie repart vierge à chaque ouverture** — décision explicite : un état recopié
machinalement pourrait être faux le jour où ça compte. Ne pas la persister.

**Bandeau de vigilances** — allergies + appareillages + détection d'anticoagulant par
expression régulière sur le traitement (`eliquis|xarelto|previscan|kardégic|lovenox…`).
Compléter cette liste si de nouvelles molécules apparaissent.

**Seuils du DLU** — codés dans `dluHtml` (TA ≥16 ou ≤9, pouls ≥100 ou ≤50, sat ≤92,
T° ≥38 ou ≤35.5, glyc ≥2.5 ou ≤0.7). Volontairement indépendants des seuils personnalisés
du patient : en urgence, ce sont des repères généraux qui parlent à l'urgentiste.

**Dates en toutes lettres** — `fmtFR()` abrège (« 30 juin ») ; le DLU utilise le format
JJ/MM/AAAA, indispensable pour une date de naissance.

## Export de fiche patient

```
www/js/fiche.js  ← 13ᵉ module (après share.js : dépend de zipStore)
sheetExportFiche(pid) → composition   |   buildFiche(p, inc, docIds, fmt, print)
ficheHtml() / ficheTexte() → rendus   |   shareText() / shareDocx()
```

12 blocs sélectionnables (`FICHE_BLOCS`, avec leur valeur par défaut) + choix individuel
des documents à intégrer. PDF **et** impression passent par le HTML imprimable
(`window.print()`) : rendu fidèle et photos intégrées, sans dépendre de jsPDF qui ne gère
ni les accents ni les mises en page riches.

⚠️ `fiche.js` doit rester **après** `share.js` dans `ORDER_*` : il utilise `zipStore()`
pour le Word. Le garde-fou du build vérifie sa présence via `function sheetExportFiche`.

**Compteur des fins de PEC** — la liste et le compteur incluent les dossiers **archivés**
(mention « 📦 archivé »). Les exclure donnait un compteur à 0 alors que les PEC existaient.

## Documents joints

```
inputs : #camerafile · #galleryfile · #docfile (PDF) · #wordfile (.doc/.docx/.odt/.rtf)
tous branchés sur handleDocFile ; stockage IDB sous la clé doc_<id>
docIcon(d) → 🖼️ image · 📄 PDF · 📝 Word · 📎 autre
```

`sheetAddDoc(pid, replaceId)` présente les 4 provenances en grille 2 × 2 (`.srcgrid`),
puis déclenche le `click()` de l'input correspondant après fermeture de la feuille
(délai de 120 ms : sur mobile, ouvrir un sélecteur de fichiers pendant la fermeture
d'un overlay le fait avorter).

**Word non intégrable** — contrairement aux images et aux PDF (rendus via jsPDF/pdf.js),
les .docx partent en **pièce jointe séparée** dans toutes les relèves. Ne pas tenter de
les intégrer aux annexes cliquables.

**⚠️ La sauvegarde DOIT embarquer les contenus** — `exportBackup()` sérialisait `S` seul,
donc uniquement les *références* aux documents. Après réinstallation + import, la fiche
affichait des noms de fichiers dont le contenu n'existait plus (« contenu introuvable »).
Corrigé : les contenus sont collectés depuis IDB et joints sous la clé `_docs` du fichier
de sauvegarde ; `importBackupText()` (désormais `async`) les réécrit dans IDB avant
d'appliquer l'état, puis supprime `_docs` du state.

**Ne jamais sérialiser `S` seul pour une sauvegarde.** Toujours `{ ...S, _docs }`.

**Stockage du contenu** — le binaire d'un document va **toujours** dans IndexedDB sous
`doc_<id>` (via `idbSet`), **jamais** dans la fiche patient. Un bug du remplacement (🔁)
écrivait `d.data` dans la fiche : `idbGet` ne trouvait rien et l'aperçu affichait
« document introuvable ». `viewDoc` récupère désormais ces documents cassés à la volée
(migration de `d.data` vers IDB), mais la règle reste : **le contenu ne va jamais dans le state**.

**Écrans d'erreur** — tout écran de la visionneuse doit contenir un `.dv-close`. Un écran
d'erreur sans bouton de fermeture piège l'utilisateur (obligé de tuer l'app). Un `ov.onclick`
sur le fond sert de filet de sécurité supplémentaire.

**Visionneuse** (`viewDoc`) — s'appuie sur le conteneur `#docview` dans `index.html`.
⚠️ Ce conteneur avait disparu du HTML : `viewDoc` sortait sur `if (!ov) return`, donc
**taper un document ne faisait rien**. Vérifier sa présence après toute refonte du HTML.

Trois rendus selon le type : image affichée, PDF en `<iframe>` (avec repli si le navigateur
refuse), autres formats en écran d'information. Deux actions dans tous les cas :
`openDocExternal()` (FileOpener si présent, sinon partage Android qui propose « Ouvrir avec »)
et `shareDoc()` (Filesystem + Share en natif, `<a download>` en web).

⚠️ `.dv-wrap` est en flex **ligne** par défaut (pour centrer une image) : les écrans verticaux
doivent forcer `flex-direction:column`, et le bouton « Fermer » de la barre doit annuler le
`position:fixed` hérité de `.dv-close`.

## Informations contextuelles du patient

```
p.infos = [{ id, type, txt, show }]
INFO_TYPES = acces | vigilance | atcd | entourage | autre
shownInfos(p)  ← les entrées show:true et non vides
```

Remplace l'ancien champ `p.ctx`, qui ressortait **systématiquement en ⚠ vigilance** dans la
relève — y compris pour des antécédents ou un code de portail.

**Migration** (dans `migrate()`) : si `p.infos` est absent, l'ancien `p.ctx` devient une entrée
de type `atcd` avec `show:false`. Rien n'est perdu et la relève s'allège immédiatement.
`p.ctx` continue d'être écrit à l'enregistrement (compatibilité ascendante avec les synchros
venant d'anciennes versions), mais **ne doit plus être lu pour l'affichage**.

**Affichage** — toujours via `shownInfos(p)` + `infoType(it.type)` : carte patient, déroulé,
relève (texte, PDF, HTML), feuille de route et écran de sélection. L'icône et la couleur
viennent du type, jamais codées en dur.

## Cycle de vie du dossier patient

Quatre marqueurs, à ne pas confondre :

```
S.noVisit[pid] = "YYYY-MM-DD"   ← « pas de passage prévu » ce jour-là
p.pec = {end, motif, keepMonths} ← fin de prise en charge
p.archived = "YYYY-MM-DD"        ← dossier archivé
S.trash[]                        ← corbeille 30 jours
```

**`activeP()` exclut `archived` ET `pec`** — mais les dossiers clôturés restent dans
`S.patients`, ce qui les garde trouvables par la recherche. Ne jamais les filtrer en amont.

⚠️ **`sheetPatient(p)` accepte un id OU un objet.** Plusieurs appels (liste des PEC,
recherche, annulations) passaient un identifiant : la fonction le traitait comme « pas de
patient » et ouvrait une **fiche vide** intitulée « Nouveau patient ». La conversion est
maintenant faite en tête de fonction.

⚠️ **Restaurer un dossier doit le rendre VISIBLE.** Trois conditions le masquent
indépendamment : `archived`, `pec`, et l'absence de tournée. Ne lever que l'archivage
laissait le patient invisible partout — ni au Moniteur (à cause de la PEC ou du manque de
tournée), ni dans les Archives (plus archivé). La restauration lève l'archivage, propose de
reprendre la prise en charge, et réaffecte une tournée si `p.tours` est vide. Vaut pour les
Archives **et** la Corbeille.

⚠️ **La fin de PEC doit être annoncée même si le dossier est archivé.** Le filtre
`p.pec && !p.archived` excluait les patients clôturés *puis* archivés — leur fin de prise
en charge n'apparaissait dans aucune relève. Le test porte désormais sur `p.pec` seul.

**`relevePool(tour, start, end)`** réintègre les patients dont `pec.end` tombe dans la période :
c'est ce qui fait apparaître la mention « FIN DE PRISE EN CHARGE » dans la relève du jour
concerné, même si le patient est déjà sorti des tournées.

**Piège rencontré** : dans `sheetFinPEC()`, la fonction locale de rafraîchissement de la feuille
s'appelle `draw()` et **non** `render()` — sinon elle masque le `render()` global et le Moniteur
n'est jamais rafraîchi après la clôture.

**Suppression définitive** (`supprimerPECDefinitif`) : deux `confirm()` successifs, purge des
documents en IndexedDB (`_rawDel("doc_"+id)`), pas de passage par la corbeille.

## Mode d'emploi embarqué

```
www/manuel.html   ← manuel illustré complet (~600 Ko, captures en JPEG base64)
```

Généré par `/home/claude/manual/gen.py`, qui lit les captures depuis `/tmp/shots_b64.json`.
Les captures sont produites par Playwright sur l'app réelle, **thème « Hôpital de nuit »**,
avec des patients fictifs.

`downloadManuel(mode)` dans `features.js` : `"html"` partage/enregistre le fichier,
`"pdf"` l'ouvre dans le navigateur et déclenche l'impression (aucun moteur PDF embarqué
ne rend correctement un HTML de cette complexité).

Le manuel est listé dans `sw.js` → **consultable hors ligne**.
⚠️ À chaque refonte du manuel, penser à régénérer `www/manuel.html` **et** à incrémenter
le nom du cache du service worker.

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
