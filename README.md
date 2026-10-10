# JM@Santé

Application de transmissions infirmières pour IDEL remplaçant.
Développée avec [Capacitor](https://capacitorjs.com/) — même cœur web pour Android, Windows et navigateur.

**Version courante : 1.12.1**

> ⚠️ © 2026 JmCve83. Tous droits réservés. Redistribution, version dérivée et décompilation
> interdites sans autorisation écrite — voir `LICENSE.md`.

---

## Ce que l'application fait

Un **carnet de relève**, pas un dispositif médical. Elle enregistre ce que le soignant saisit et
l'aide à le transmettre. Elle **n'interprète rien** : aucun diagnostic, aucun score, aucune conduite
à tenir. Les seuils réglés servent à faire *ressortir* une valeur à l'écran, pas à donner un avis.

Les données restent **sur l'appareil** : aucun compte, aucun serveur, aucune collecte. Elles ne
partent que lorsque l'utilisateur partage lui-même une relève ou un document.

Tournées et ordre de passage · dossiers patients et fiche de recueil · saisie des passages et
constantes · suivi des plaies · plan de traitement · relève composée et envoyée · DLU · feuilles à
laisser au domicile · documents joints · synchronisation entre collègues · annuaire de cabinet ·
catalogues de soins · bilans · calculs · base des médicaments · alertes datées · sauvegarde chiffrée.
Affichage en cartes ou en listing d'une ligne par patient, dans l'ordre de passage.

---

## Structure du projet

```
jmsante/
├── www/                      ← Cœur applicatif (déployé tel quel dans l'APK)
│   ├── index.html            ← Shell HTML + imports
│   ├── manuel.html           ← Mode d'emploi embarqué (source du livrable)
│   ├── css/app.css           ← Styles + thèmes (variables CSS)
│   ├── js/libs/              ← exceljs, qrcode, jsQR (chargés à la demande)
│   ├── js/app.js             ← ⚠️ GÉNÉRÉ par build.js — ne pas éditer
│   └── js/                   ← 42 modules sources, concaténés dans l'ordre d'ORDER_DEV
├── tests/                    ← Suites de contrôle (node, sans dépendance)
│   └── navigateur/           ← Épreuves Playwright — l'app qui tourne pour de vrai
├── electron/                 ← Coquille Windows
├── scripts/postcap.js        ← Retouches du projet Android après `cap sync`
├── build.js                  ← Concaténation, vérifications, version du manuel
└── .github/workflows/        ← CI → APK signé
```

### Les modules, par rôle

| Rôle | Modules |
|---|---|
| Socle | `globals` · `uikit` · `storage` · `seed` · `init` · `pwa` |
| Écrans et navigation | `ui` · `sheets` · `nav` · `features` · `seq` |
| Dossier patient | `fiche` · `dossier` · `recueil` · `traitement` · `plaies` · `tendances` · `menage` |
| Sortants | `engine` (relève) · `share` · `dlu` · `feuilles` · `docs` · `modeles` · `narratif` |
| Référentiels | `guide` · `guide26` · `dispositifs` · `calculs` · `bilans` · `bilans_fiches` · `medicaments_base` · `medicaments` |
| Échanges | `sync` · `cabinet` |
| Divers | `vocal` · `dictate` · `notes` · `alertes` · `essais` · `detente` · `eggs` |

---

## ⚠️ Compiler — `build.js` fait foi

```bash
node build.js            # dev  : concaténation commentée
node build.js --prod     # prod : minification esbuild si disponible
```

**Chaque module source est volontairement incomplet.** `node --check` sur un module isolé peut
échouer sans que rien ne soit cassé : seul l'assemblage se vérifie. `build.js` contrôle donc la
syntaxe du fichier assemblé, la présence de chaque module par une fonction sentinelle, et l'absence
du piège `async` suivi d'un commentaire — rencontré trois fois, invisible module par module.

`build.js` écrit aussi, depuis `package.json`, **trois numéros de version qui étaient en dur** et
qui avaient tous fini par mentir : celui du manuel (figé à une version ancienne), celui des
ressources (cache-bust), et celui du **pied de page de l'accueil** — qui annonçait `v1.7.3` alors
que l'app était en `1.10.0`. Il régénère aussi **`JMSante_Mode_emploi.html`** depuis
`www/manuel.html` (le livrable avait dérivé de 23 chapitres).

> **La règle que ce dépôt a apprise trois fois :** tout nombre ou toute copie écrits à la main
> finissent par mentir. S'il peut être calculé, il est calculé.

---

## Tests

```bash
cd ../testrun && node ../jmsante/tests/_test_medicaments.js
```

⚠️ Les suites se lancent **depuis un dossier frère** : elles lisent `../jmsante/`.

Elles contrôlent le code source, pas seulement son exécution — notamment les règles qui ne doivent
pas dériver : la note soignante qui ne sort jamais sur la fiche remise au patient, l'absence
d'interaction médicamenteuse dans la base, le défaut sûr d'un paramètre absent.

Des épreuves en **navigateur réel** (Playwright) complètent les suites statiques sur les écrans
sensibles : `tests/navigateur/`, avec son `LISEZMOI.md` — les quatre pièges à connaître avant d'en
écrire une, et la liste de ce qu'elles ont trouvé. C'est ainsi qu'a été trouvé le
`pointer-events:none` qui rendait **tous** les boutons « Annuler » de l'application inopérants, et
le `#board` en grille à deux colonnes qui écrasait le listing sur une demi-largeur.

```bash
node tests/navigateur/pw_v111.js      # nécessite playwright
```

---

## Prérequis locaux (développement)

| Outil | Version minimale | Rôle |
|---|---|---|
| Node.js | 20 | Capacitor CLI, build.js |
| npm | 10 | Dépendances |
| Android Studio | Hedgehog+ | Build local |
| Java JDK | 17 | Gradle |

Pour compiler via GitHub Actions : **aucun prérequis local**, un push sur `main` suffit.

```bash
npm install
node build.js
npx cap sync android     # ⚠️ postcap.js retouche ensuite le projet généré
npx cap open android
```

⚠️ **`scripts/postcap.js` est indispensable** : `cap sync` réécrit le projet Android et perd les
permissions et le `onPermissionRequest` ressource par ressource. Il est rejoué après chaque sync.

---

## APK signé

Le workflow se déclenche sur chaque push sur `main` et sur les tags `vX.Y.Z`.
Quatre secrets GitHub : `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
Procédure complète dans `TUTO_CLE_SIGNATURE.md`.

---

## Documents du dépôt

| Fichier | Contenu |
|---|---|
| `JMSante_Cahier_des_charges.md` | Objet, utilisateur, architecture fonctionnelle, feuille de route |
| `README_TECHNIQUE.md` | Journal technique par version — décisions, pièges, garde-fous |
| `JMSante_Mode_emploi.html` | ⚠️ Régénéré par `build.js` depuis `www/manuel.html` — ne pas éditer |
| `JMSante_Journal_de_creation.md` | Journal de fabrication |
| `CONFORMITE_A_PREPARER.md` | Points de conformité à traiter |
| `A_FAIRE_TESTS_CI.md` | Tests à porter en intégration continue |
| `TUTO_CLE_SIGNATURE.md` | Clé de signature Android |
| `LICENSE.md` | Conditions d'utilisation |

---

## Versionnement

Troisième chiffre au fil de l'eau · deuxième chiffre pour un ensemble cohérent qui change la façon
de travailler · `v2` pour une vraie refonte.

---

## Chantiers ouverts

Tests en intégration continue · dépôt en privé · sandbox de démonstration · planning par patient.

---

*JM@Santé — Transmissions IDEL — par Jmeu*
