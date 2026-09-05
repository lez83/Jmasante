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

**Ne jamais rendre `tour` facultatif à l'envoi.** `sheetSendSync()` impose le choix du
cabinet avant de générer le fichier.

**Documents** : aucun par défaut (`sel` vide), chargés depuis IDB au moment de l'envoi
et transportés dans `pkg.docs[]` avec leur `pid`.

**À la réception** (`analyzeSync` + écran de validation) : chaque document reçu a sa case,
décochée d'office s'il existe déjà un fichier de même nom chez le destinataire. À l'import,
**aucun document existant n'est jamais écrasé** — un doublon est ajouté à côté, renommé
« nom (reçu <date>).ext ».

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
