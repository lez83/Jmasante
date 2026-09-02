# JM@Santé

Application de transmissions infirmières pour IDEL remplaçant.  
Développée avec [Capacitor](https://capacitorjs.com/) — même cœur web pour Android et Windows.

---

## Structure du projet

```
jmsante/
├── www/                    ← Cœur applicatif (déployé tel quel dans l'APK)
│   ├── index.html          ← Shell HTML + imports des modules
│   ├── css/app.css         ← Styles + 6 thèmes (variables CSS)
│   └── js/
│       ├── globals.js      ← Constantes, helpers, types (RAP_TYPES, APP_THEMES…)
│       ├── storage.js      ← IndexedDB + migrate + purge auto
│       ├── seed.js         ← Données de démonstration
│       ├── ui.js           ← Rendu pancarte, cartes patients, vitals
│       ├── sheets.js       ← Toutes les feuilles modales (patient, docs, rappels…)
│       ├── engine.js       ← Moteur de relève (buildReleve, sheetReleve, sheetSelect)
│       ├── share.js        ← Module de partage (ZIP/DOCX maison, Web Share / Capacitor Share)
│       ├── dictate.js      ← Reconnaissance vocale (Web Speech / Vosk à venir)
│       └── init.js         ← Démarrage, verrou PIN, écouteurs globaux
├── capacitor.config.json   ← Config Capacitor (appId, plugins)
├── package.json
├── .gitignore
└── .github/
    └── workflows/
        └── build-android.yml  ← Pipeline CI → APK automatique
```

---

## Prérequis locaux (développement)

| Outil          | Version minimale | Rôle |
|----------------|-----------------|------|
| Node.js        | 20              | Capacitor CLI |
| npm            | 10              | Dépendances |
| Android Studio | Hedgehog+       | Émulateur / build local |
| Java JDK       | 17              | Gradle |

Pour compiler uniquement via GitHub Actions (recommandé) :  
**aucun prérequis local** — seul un push sur `main` suffit.

---

## Premiers pas

```bash
# 1. Installer les dépendances
npm install

# 2. Ajouter la plateforme Android (une seule fois)
npx cap add android

# 3. Synchroniser le www/ vers le projet Android
npx cap sync android

# 4. Ouvrir Android Studio pour lancer sur émulateur ou appareil réel
npx cap open android
```

Ou simplement pusher sur GitHub → l'APK sera disponible en artefact dans Actions.

---

## Pipeline GitHub Actions (build-android.yml)

Le workflow se déclenche sur chaque push sur `main` et sur les tags `vX.Y.Z`.  
Il produit un **APK debug téléchargeable** (onglet Actions → artifacts).

Pour un APK signé (release) :
1. Générer un keystore : `keytool -genkey -v -keystore jmsante.jks -alias jmsante -keyalg RSA -keysize 2048 -validity 10000`
2. Encoder en base64 : `base64 jmsante.jks | pbcopy` (macOS) ou `base64 -w0 jmsante.jks` (Linux)
3. Ajouter les 4 secrets GitHub (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`)
4. Décommenter le bloc "Sign APK" dans le workflow

---

## Plugins Capacitor prévus

| Plugin | Usage | Statut |
|--------|-------|--------|
| `@capacitor/share` | Remplace Web Share API pour partager la relève + documents | À activer (`shareFiles()` est prête) |
| `@capacitor/filesystem` | Lecture/écriture fichiers locaux (sauvegarde, export) | À intégrer |
| `@capacitor/camera` | Photos de plaies, ordonnances | À intégrer |
| `@capacitor/splash-screen` | Écran de démarrage J♥S | Config OK |
| `@capacitor/status-bar` | Barre de statut assortie au thème | Config OK |
| SQLite chiffré (community) | Remplacer IndexedDB par base chiffrée | v2 |
| Biométrie (community) | Empreinte digitale en lieu du PIN | v2 |
| Vosk / Whisper | Dictée vocale hors-ligne | v2 |

---

## Adaptation de `shareFiles()` pour Capacitor

Dans `www/js/share.js`, la fonction `shareFiles()` utilise actuellement l'API Web.  
Pour la version APK, remplacer le corps par :

```javascript
async function shareFiles(files, title) {
  const { Share } = Capacitor.Plugins;
  // Écrire les fichiers dans le dossier temporaire via @capacitor/filesystem
  // puis appeler Share.share({ title, files: [...chemins] })
  // Voir documentation : https://capacitorjs.com/docs/apis/share
}
```

Le reste de l'app (construction du DOCX, sélection des pièces jointes) ne change pas.

---

## Windows (futur)

Même `www/` ; coquille Electron :

```bash
npm install --save-dev electron electron-builder
# + electron/main.js minimal (BrowserWindow pointant sur www/index.html)
```

Ou PWA installable : ouvrir `www/index.html` dans Edge/Chrome, cliquer « Installer l'application ».

---

*JM@Santé — Transmissions IDEL — par Jmeu*
