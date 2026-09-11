# JM@Santé — Cahier des charges

**Version 3.7 — 5 septembre 2026 — Document évolutif** *(état applicatif : v1.0.10)*


---

## 🕗 EN ATTENTE — idées validées, non encore codées

> **Cette section est le filet de sécurité du projet.** Toute décision prise en
> discussion mais pas encore implémentée y est consignée avec sa date. Elle survit
> aux compactions de conversation, aux changements de session et aux versions.
> **À relire au début de chaque séance de travail.**

| Date | Sujet | Ce qui a été décidé | État |
|---|---|---|---|
| 5 sept. | Choix définitif du mode de menu | Les deux présentations (tuiles / liste) coexistent le temps d'un test terrain. **Après quelques semaines d'usage, en retirer une** pour simplifier le code. | ⏳ Après test |
| 3 sept. | Tests terrain PWA iOS | Vérifier le parcours Safari → Partager → Sur l'écran d'accueil sur un vrai iPhone. | ⏳ À faire |
| — | Migration ESM / bundler | Étudiée puis écartée : ~188 symboles, ~151 dépendances croisées, risque de cycles. Les modules autonomes + le garde-fou de build couvrent le besoin. **À reconsidérer seulement lors d'une refonte de fond.** | ❄️ Gelé |

*Quand un item est réalisé, il passe dans la feuille de route ci-dessus avec sa version.*

---

## 1. Objet et finalité

**Nom de l'application : JM@Santé** — dans la continuité de JM@Compta, l'outil de comptabilité du même auteur. « TransM IDEL » était le nom de travail du projet.

JM@Santé est une application de collecte et de transmission destinée à un infirmier libéral remplaçant (IDEL) exerçant sur plusieurs tournées organisées par cabinet. Elle sert à noter et répertorier, en direct au domicile des patients, les données utiles à la relève : soins réalisés, constantes, transmissions libres, bilans et rendez-vous, rappels logistiques, ainsi que quelques documents (ordonnances, bilans, photos de plaie). En fin de période de remplacement — ou à tout moment —, elle génère une relève infirmière complète ou sélective, sur la période choisie, que l'utilisateur transmet lui-même par email, WhatsApp ou MMS, accompagnée des documents voulus.

JM@Santé n'est pas un dossier de soins au long cours. C'est un carnet de mission : la donnée y vit le temps de son utilité, puis disparaît. L'application ne conserve aucun historique pluriannuel, ne synchronise rien vers un serveur, et ne stocke rien en dehors de l'appareil de l'utilisateur.

Le chiffrement des envois n'est pas du ressort de l'application : l'utilisateur dispose déjà d'un logiciel de chiffrement santé professionnel pour sécuriser ses transmissions. JM@Santé s'arrête à la production de fichiers propres remis au menu de partage du système.

## 2. Utilisateur et contexte d'usage

Utilisateur unique : l'infirmier remplaçant lui-même, sur son propre matériel. Usage debout, souvent d'une main, au domicile de patients, parfois sans réseau, à toute heure (tournées débutant à l'aube et finissant à la nuit). L'interface doit donc être : lisible en pénombre comme en plein soleil, rapide (saisie d'un passage en moins de 30 secondes), tolérante au hors-ligne (100 % fonctionnelle sans réseau), et sobre en manipulations.

## 3. Plateformes cibles, par ordre de priorité

1. **Smartphone Android** — cible principale. APK natif via Capacitor, compilé par GitHub Actions.
2. **Windows** — second temps. Même cœur applicatif, empaqueté via Electron ou installé en PWA. Transfert de données entre appareils par export/import manuel (NAS possible comme pont).
3. **iPhone** — en attente. Le code restera compatible iOS (Capacitor), mais la compilation et la distribution sont gelées tant que le compte développeur Apple (99 €/an) n'est pas souscrit.
4. **Tablette Android** — même APK ; une mise en page adaptée aux grands écrans sera ajoutée au fil de l'eau (pancarte multi-colonnes).

## 4. Architecture fonctionnelle retenue

Le paradigme d'interface validé après comparaison de cinq maquettes d'ergonomie est **la pancarte** : une vue synoptique unique de tous les patients, inspirée du tableau de service hospitalier, avec saisie sur place — la carte du patient se déplie, on saisit, elle se replie — sans changement d'écran.

### 4.1 Pancarte (écran principal)
- Barre de sélection des tournées (par cabinet) : « Toutes » ou une tournée précise ; toute l'application suit ce filtre.
- Synthèse chiffrée : patients à voir / vus / en vigilance / rappels en cours.
- Filtres d'état : tous, à voir, vigilance, vus, absents.
- Grille de cartes patients : nom, âge, dernières constantes connues (valeurs anormales en rouge), badges (tournées, documents, bilans en attente, rappels, absence), statut visuel (point ou bracelet selon le thème), horodatage du dernier passage.

### 4.2 Saisie d'un passage (carte dépliée)
- Soins réalisés : chips du plan de soins libre du patient (marquées ★), soins du catalogue général, et ajout d'un soin sur mesure à la volée (« + autre… »).
- Constantes optionnelles (TA, température, saturation, pouls, glycémie, douleur) avec détection d'alerte en direct selon des seuils cliniques (champ en rouge + message).
- Transmission libre avec dictée vocale (la dictée ajoute au texte, n'écrase jamais) — reconnaissance vocale **native Android**, fonctionnant **hors ligne** si le pack vocal français est installé ; repli Web Speech.
- **Valeurs précédentes en fantôme** : chaque champ de constante affiche la dernière valeur connue en placeholder — l'évolution se lit d'un coup d'œil.
- **Phrases types** : catalogue de ~26 formulations classées en 7 thèmes (État général, Pansements/Plaies, Traitements, Douleur, Diabète, Entourage/Coordination, Devenir), insérables en 3 taps, entièrement personnalisable (ajout de phrases et de catégories, à la dictée possible).
- **Mode DARD** : bascule optionnelle découpant la transmission en 4 champs guidés — Données / Actions / Résultats / Devenir — recomposés automatiquement en note structurée.
- **Tags de priorité** : 4 pastilles par patient (👁️ À surveiller, 🔴 Prioritaire, 🧰 Matériel à apporter, 🩺 Médecin contacté), visibles sur la pancarte et reprises dans la relève.
- **Événements rapides** : chips pré-établies (chute, refus de soin, absence, matériel manquant…).
- **« Pas de passage prévu aujourd'hui »** (v31, dans le déroulé) : saute un patient **sans créer de passage**, donc sans l'inclure dans la relève — pour les tournées où l'on ne passe qu'un jour sur deux ou trois. Distinct de l'**absence**, qui reste un événement à transmettre.
- **Clonage J-1** et **swipe RÀS** pour les passages de routine.
- Barre d'outils du patient : Documents, Bilans/RDV, Rappels, Historique, Courbes, GPS, Annuaire, Fiche.
- **Dictée rapide (FAB)** : bouton micro flottant permanent — dicter une note puis l'affecter à un patient de la tournée en un tap, sans navigation.

### 4.3 Dossier patient
- Fiche : identité, date de naissance, tournées d'affectation, contexte/vigilances permanentes, plan de soins libre (intitulés personnalisés créés par l'utilisateur, pré-proposés à chaque passage).
- Historique des passages, chaque élément supprimable individuellement.
- Documents : photos et PDF (ordonnances, bilans, photos de plaie), avec miniatures, ouverture plein écran, remplacement (validité remise à zéro), galerie chronologique, suppression unitaire. Stockés en clés séparées de l'état (pas de saturation), dans la base chiffrée — jamais dans la galerie publique Android.
- Bilans / RDV médicaux : type, date, précision/résultat, statut cyclable au tap (À faire → Fait → Résultat reçu), échéance dépassée en rouge. **Synchronisation automatique avec les rappels** : un bilan « À faire » daté crée son rappel 🧪 (countdown J-3 → Jour J) ; passage à « Fait » le clôt ; suppression du bilan supprime le rappel.
- **Rappels structurés en deux niveaux** (v31) : 7 catégories métier — 💉 Soin ponctuel · 🧪 Bilan/Prélèvement · 📦 Pharmacie & Matériel · 📋 Ordonnance & Médecin · 🗓️ RDV & Transport · 🚪 Absence patient · 📌 Autre — chacune proposant des **précisions concrètes** (pansement lourd, ECBU, commande pilulier, renouvellement ordonnance, VSL, séjour de répit…) insérables d'un tap dans le détail, puis **complétables librement** (saisie ou dictée). Les types inconnus (anciens rappels ou reçus d'un collègue) sont gérés sans erreur.
- Cycle de vie du dossier : actif → archivé (tout l'historique conservé, dossier hors pancarte, restaurable) → supprimé définitivement.

### 4.4 Rappels
Cinq types : soin ponctuel, RDV, matériel/pharmacie, absence patient, autre. Rattachés à un patient ou généraux (logistique de tournée). Échéance datée, échéances dépassées en rouge. Un rappel « absence » marque visuellement le patient absent sur la pancarte. Les rappels en cours remontent dans la relève (section « À prévoir »).

### 4.5 Relève (moteur de transmissions)
- Périmètre : une tournée/cabinet ou toutes ; période libre (du/au).
- Trois contenus : **complète** (tous les passages), **événements seuls** (alertes de constantes et transmissions écrites ; la routine est résumée en une ligne), **sélection** (choix passage par passage, événements pré-cochés).
- Deux présentations : **narrative** (phrases fluides par passage) ou **structurée** (sections SOINS / CONSTANTES / BILANS-RDV / TRANSMISSIONS par patient).
- Toujours : ordre chronologique par patient, synthèse des points de vigilance en tête, bilans datés dans la période plus tous les bilans encore « à faire », rappels du périmètre.
- Format de sortie restructuré : encadré par patient, emoji fixes par section (✅ soins, 📊 constantes, 📝 transmission, 🧪 bilans, 📌 rappels), heure omise sauf RDV, RÀS en une ligne, synthèse en tête et pied.
- **Aperçu riche** avant envoi : blocs colorés par patient.
- Génération par moteur de règles déterministe ; reformulation par LLM local embarqué envisagée en v2.

### 4.6 Module de partage — ✅ réalisé
Interface unifiée d'envoi : choix du format (🗒️ **.txt** · 📑 **PDF** · 🌐 **HTML** · 📝 **.docx**), cases à cocher des documents à joindre, bouton unique 📤 Envoyer ouvrant le menu de partage natif Android (email, WhatsApp, MMS, logiciel de chiffrement santé…), avec **message d'accompagnement automatique** (période, tournée, effectifs, alertes, logiciel conseillé pour ouvrir).

**Système d'annexes avec liens cliquables** : dans les formats PDF, HTML et DOCX, la relève contient pour chaque document une ligne « 📎 Voir : *fichier* (Annexe N) » **cliquable**, pointant vers l'annexe numérotée regroupée en fin de document — photos affichées en grand, PDF joints convertis en images de pages (pdf.js, 4-5 pages max puis renvoi à la pièce jointe). Un seul fichier transmis, navigation interne.

**Journal des envois** : chaque partage est tracé (date, heure, tournée, format, effectifs) — preuve de transmission consultable dans les réglages.

### 4.7 Rétention et effacement (à développer — priorité 2)
- **Règle de conservation** : constantes, passages et éléments de relève conservés au maximum un an ; documents conservés le temps de leur utilité seulement.
- **Purge automatique paramétrable** (3, 6 ou 12 mois — 12 par défaut) au démarrage : passages/constantes/relèves anciens, bilans clos anciens et rappels traités anciens, avec récapitulatif discret. Les bilans « À faire » et les documents ne sont jamais purgés automatiquement.
- **Effacement manuel à la volée** : toute donnée créée (passage, constante, document, bilan, rappel, dossier) doit pouvoir être supprimée individuellement à tout moment.
- **Nettoyage manuel global** : suppression de tous les passages antérieurs à une date choisie (existant).
- **Remplacement de document** : substitue le fichier, remet le compteur de validité à zéro, efface l'ancien.

### 4.7bis Synchronisation multi-utilisateurs — ✅ réalisé (v28-v29)
Partage dynamique des données de tournée entre plusieurs IDEL, **sans serveur** (échange de fichier).

**Architecture** : chaque app tient un **journal d'opérations** signées (nom+prénom de l'auteur) et horodatées. Le fichier de synchro (`.json`) est **incrémental** (uniquement les changements) et transporte les **échéances** des rappels (countdowns recalculés chez le destinataire).

**Trois natures de données** :
- *Partagées dynamiques* (passages, constantes, rappels, bilans, documents) → fusion automatique
- *Sous validation* (plan de soins) → acceptation/refus individuel à la réception
- *Strictement locales* (ordre de passage, thème, PIN, créneaux, phrases perso) → jamais synchronisées

**Réception** : écran de validation récapitulatif, **conflits tranchés par donnée** (édition simultanée de la même entité), application **tout ou rien**.

**Garde-fou** : **snapshot automatique** de sécurité avant chaque fusion ; « Historique des synchros » permettant de **revenir à l'état d'avant** (marche arrière), avec ménage possible (suppression individuelle ou vidage).

**Durabilité** : le journal s'**élague** (opérations vieilles de 60 jours ET déjà partagées) ; **dédoublonnage** par pair (une opération déjà reçue n'est pas réappliquée).

### 4.7ter Édition de la relève — principes (v35-v36)
**Complète sans être redondante.** Sur la période demandée, ce qui est routinier est mentionné **une seule fois** (« Plan de soins respecté ») ; seuls les écarts sont rendus, **datés et situés** (jour + matin/soir) : soins commentés (💬), soins hors plan (➕), transmissions (📝), constantes retenues (📊).

**Constantes** : toujours enregistrées dans l'historique du patient (traçabilité, urgence, suivi), mais transmises **uniquement sur décision de l'IDEL** (case « 📤 Inclure dans la relève ») — y compris les valeurs hors seuils, car l'appréciation clinique prime sur le seuil théorique.

**DAR** : n'est plus un mode global mais un **marqueur de passage**. Un passage saisi en mode DARD apparaît en bloc structuré isolé, les autres patients conservant la présentation courante.

**Synthèse ciblée** : écran de composition en deux temps — sélection des **patients** (cases à cocher) puis des **données** à inclure (7 filtres). Répond au besoin de transmettre à un médecin sans divulguer les données de patients qui ne le concernent pas.

**Finalisation** : signature manuscrite intégrée aux exports PDF/HTML/Word, et encart de **message libre** en fin de document (signé, horodaté). Les deux sont réinitialisés à chaque nouvelle relève.

### 4.9bis Informations contextuelles — ✅ réalisé (v38)
L'ancien champ « contexte » ressortait intégralement en **⚠ vigilance** dans la relève, quel que soit son contenu — un antécédent d'arthrose y prenait l'apparence d'une alerte, et un code de portail celle d'une information médicale.

Il est remplacé par une **liste d'informations typées**, chacune portant son propre interrupteur d'affichage :

| Type | Usage | Défaut |
|---|---|---|
| 🔑 Accès & domicile | Code portail, clé, étage, chien | — |
| 💊 Traitement | Fiche de traitement, posologies, horaires | — |
| ⚠️ Vigilance | Allergie, risque de chute, contre-indication | — |
| 📋 Antécédents | HTA, diabète, interventions | Masqué |
| 👨‍👩‍👧 Entourage | Aidants, présence familiale | Masqué |
| 📌 Autre | Divers | — |

Le réglage est **permanent, fait une fois dans la fiche patient** : les informations marquées « relève » accompagnent automatiquement chaque transmission de ce patient. Seule la catégorie **Vigilance** conserve la mise en évidence orange.

**Migration** : l'ancien contenu de `p.ctx` devient un antécédent masqué — aucune donnée perdue, relève immédiatement allégée.

### 4.10 Cycle de vie du dossier patient — ✅ réalisé (v38)
Quatre états distincts, du plus léger au plus définitif :

| État | Déclencheur | Effet | Réversible |
|---|---|---|---|
| **Sans passage du jour** | Bouton 🚫 dans le déroulé | Pastille grise, exclu du compteur « À voir », aucun passage créé donc absent de la relève. Vaut **pour la journée seulement**. | Automatiquement le lendemain |
| **Fin de prise en charge** | Bouton 🎗️ dans la fiche | Sort des tournées et du Moniteur ; **mentionné dans la relève couvrant sa date de fin** ; reste cherchable et consultable pendant 3/6/9/12 mois | Oui (reprise des soins) |
| **Archivé** | Bouton 📦 | Sort du Moniteur, conservé dans les Archives | Oui (restauration) |
| **Supprimé** | Corbeille (30 j) ou suppression définitive depuis la liste des PEC | Effacement des passages, documents et bilans | Corbeille : 30 j. Définitive : **non** |

La **suppression définitive** exige **deux confirmations successives** et ne passe pas par la corbeille — l'irréversibilité est annoncée explicitement.

### 4.11 Documentation embarquée — ✅ réalisé (v38)
Le **mode d'emploi illustré complet** (captures d'écran incluses, thème « Hôpital de nuit ») est embarqué dans l'application (`www/manuel.html`, ~600 Ko) et téléchargeable depuis 🦗 Réglages → 📖 Guide d'utilisation :
- **🌐 HTML** : enregistrement ou partage du fichier (utile pour transmettre à un collègue)
- **📑 PDF** : ouverture dans le navigateur puis impression en PDF

Le manuel est mis en cache par le service worker → **consultable hors ligne**.

### 4.9 Identité visuelle — ✅ réalisé (v37)
**Logo** : cigale au trait turquoise portant la croix de santé. Décliné en deux versions :
- **SVG simplifié** (silhouette, croix détourée, traits épais) pour le bouton de réglages du Moniteur — lisible dès 24 px, prend automatiquement la couleur du thème actif.
- **SVG détaillé** (nervures des ailes) pour l'écran de bienvenue, l'écran de verrouillage et l'en-tête des relèves HTML.
- **PNG dérivés du logo original** pour toutes les icônes d'installation (Android, iOS, PWA, maskable), le `.ico` Windows et les écrans de démarrage.

**Slogan** « Tout est dans la cigale » : sous-titre du Moniteur, écrans de bienvenue et de verrouillage, en-têtes de relève, documentation.

**Signature** « JM@Santé by JmCve83 — Toulon production » : pied de page de l'application, des relèves HTML et PDF, et de la documentation.

### 4.8 Sécurité — ✅ réalisé
- Verrouillage par code PIN (haché SHA-256) **et biométrie** (empreinte/visage, proposée automatiquement à l'ouverture, touche 👆 du pavé, PIN en secours).
- **Double chiffrement** : état applicatif chiffré AES-GCM 256 (clé PBKDF2 renforcée par le hash du PIN), stocké dans une base **SQLite chiffrée SQLCipher** sur Android (migration automatique depuis IndexedDB ; IndexedDB en repli web).
- Sauvegarde/restauration par export/import JSON : export natif vers Documents + menu de partage (Drive, mail, PC) ; **indicateur de fraîcheur** dans les réglages (alerte au-delà de 7 jours) ; import compatible ancien format « Suivi Infirmier ».
- Aucune donnée transmise à un serveur ; aucune télémétrie.

## 5. Thèmes visuels (direction artistique close)

Six thèmes commutables dans les réglages, choix mémorisé :

| Thème | Ambiance |
|---|---|
| Original | Sombre menthe clinique (défaut provisoire) |
| Bloc | Signalétique hospitalière claire, bleu scrub, angles nets |
| Réunion | Scène illustrée (volcan, palmiers, case créole, baleine) ; fond changeant selon l'heure : matin / journée / coucher de soleil |
| Verre fumé | Glass sombre, halos colorés, cartes translucides |
| Tubes néon | Noir pur, enseigne encadrée, statuts en tubes lumineux |
| Hôpital de nuit | Transparence foncée teal, bracelets patients, croix médicale, tracé ECG réaliste défilant dessinant un cœur |

Contraintes retenues : pas de thème clair éblouissant ; ambiances marquées (fond et iconographie liés au thème). Thèmes abandonnés : Carnet, Néon v1, Transparent clair, Moniteur (son ECG vit dans Hôpital de nuit).

**Identité visuelle** : logo « bulle de dialogue + cœur tracé ECG + croix de vie + courbe ascendante », signature « Logiciel de relève pour IDEL ». Deux déclinaisons : **sombre** (argenté sur anthracite) et **claire** (teal sur blanc). L'écran de démarrage Android sélectionne automatiquement la version adaptée au thème système de l'appareil (ressources `drawable` / `drawable-night`).

## 6. Données et vie privée

Données traitées : identité patient minimale (nom, prénom, date de naissance), affectations de tournées, contexte de soins, plan de soins, passages horodatés (soins, constantes, notes), bilans/RDV, rappels, documents (images/PDF). Stockage : exclusivement local (IndexedDB en maquette ; SQLite chiffré en version Android). Principes appliqués : minimisation, limitation de conservation (cf. §4.7), maîtrise totale de l'utilisateur sur l'effacement, aucun flux réseau applicatif. La sécurisation des transmissions sortantes relève de l'outil de chiffrement santé de l'utilisateur.

## 7. Architecture technique

- **Cœur applicatif** : HTML/CSS/JavaScript vanilla, monofichier en phase maquette, découpé en modules (interface, moteur de transmissions, stockage, thèmes) lors de la structuration Capacitor. Thèmes implémentés en jeux de variables CSS commutés par attribut `data-app-theme`.
- **Android** : Capacitor 6 (WebView native) ; `appId: fr.jmsante.app`. Plugins actifs : Share, Filesystem, Camera, Clipboard, SplashScreen, StatusBar, LocalNotifications, **SQLite (SQLCipher)**, **SpeechRecognition** (dictée native hors-ligne), **BiometricAuth**. Bibliothèques embarquées : jsPDF (génération PDF), pdf.js (conversion de pages PDF en images pour les annexes). Compilation par GitHub Actions sans Android Studio : push sur `main` → APK debug en artefact ; tags `vX.Y.Z` → Release GitHub. Développement local : cycle court « build → cap copy → cap run » (~15 s) sur PC avec JDK 21.
- **Windows** : même cœur, coquille Electron ou PWA installée.
- **iOS** : projet Capacitor prêt, gelé (cf. §3).

## 8. Livrables

1. Application Android (APK), puis déclinaison Windows.
2. **Cahier des charges** (le présent document, tenu à jour).
3. **Mode d'emploi** utilisateur (rédigé à la fin de la construction).
4. **Documentation technique** (architecture, formats de données, chaîne de compilation).
5. **Making-of / journal de création** (idées, décisions, essais, abandons — tenu au fil de l'eau).

## 9. Feuille de route

| Étape | Contenu | Statut |
|---|---|---|
| Maquettes d'ergonomie | 5 concepts comparés (cockpit, GPS, journal, pancarte, plan de soins) | ✅ Fait — pancarte retenue |
| Base fonctionnelle (Pancarte D.2) | Patients, tournées/cabinets, passages, constantes+alertes, docs, bilans, rappels, archives, nettoyage, relève 3 modes × 2 présentations | ✅ Fait |
| Direction artistique | 6 thèmes validés, unifiés avec sélecteur (JM@Santé v3) | ✅ Fait |
| Module de partage | Menu natif, formats txt/docx, pièces jointes | ✅ Fait (maquette web ; bascule plugin natif au packaging) |
| Rétention & documents | Purge auto paramétrable (3/6/12 mois), remplacement d'ordonnance (validité à zéro), dates/ancienneté sur documents, effacement à la volée complété (rappels) | ✅ Fait |
| Sécurité | PIN haché SHA-256 + export/import JSON (avec conversion ancienne app) ✅ ; biométrie et base chiffrée reportées au packaging Capacitor | ✅ Fait (part web) |
| Structuration Capacitor | Monofichier découpé en 9 modules JS, projet Capacitor `fr.jmsante.app`, pipeline GitHub Actions → APK debug, README de démarrage | ✅ Fait (prêt pour `npx cap add android`) |
| Système d'annexes | Relève + liens cliquables vers docs regroupés en fin de document (PDF/HTML/DOCX) | ✅ Fait (v18) |
| Sync bilan → rappel | Rappel 🧪 auto créé/clos/supprimé avec le bilan | ✅ Fait (v19) |
| Dictée hors-ligne | Reconnaissance native Android (pack FR hors connexion), repli Web Speech | ✅ Fait (v19) |
| Biométrie | Empreinte/visage à l'ouverture, PIN en secours | ✅ Fait (v19) |
| Base chiffrée | SQLite + SQLCipher, migration auto depuis IndexedDB | ✅ Fait (v19) |
| Documentation technique | README_TECHNIQUE.md (architecture, build, pièges) | ✅ Fait (v19) |
| Confort de saisie | Phrases types par catégories, valeurs fantômes, mode DARD, tags priorité, FAB dictée rapide | ✅ Fait (v20) |
| Traçabilité | Journal des envois, rappel de sauvegarde, aperçu riche | ✅ Fait (v20) |
| Logos jour/nuit | Splash adaptatif au thème système Android | ✅ Fait (v20) |
| Créneaux Matin/Soir | Composition et ordre indépendants par créneau, bascule Moniteur/déroulé | ✅ Fait (v26-v27) |
| Commentaire par soin | Appui long sur un soin → commentaire du jour, avec accès aux phrases types | ✅ Fait (v22-v27) |
| Synchro multi-utilisateurs | Journal, fichier dynamique, fusion, conflits par donnée, marche arrière, élagage | ✅ Fait (v28-v29) |
| Bouton Terminer la tournée | Clôture + message de fin (matin/soir) | ✅ Fait (v29) |
| Salutations | Message d'accueil quotidien + message de fin de tournée | ✅ Fait (v29) |
| Rappels structurés | 7 catégories métier + précisions insérables + détail libre | ✅ Fait (v31) |
| Rattachement cabinet | Distinction « rattaché au cabinet » / « dans la tournée du moment » | ✅ Fait (v35) |
| Relève synthétique | Une mention globale du plan respecté ; seuls les écarts sont datés et situés (matin/soir) | ✅ Fait (v35-v36) |
| Constantes sur décision | Enregistrées systématiquement, transmises uniquement si l'IDEL le coche | ✅ Fait (v36) |
| DAR par passage | Le mode DARD marque le passage ; bloc structuré isolé dans la relève | ✅ Fait (v36) |
| Synthèse ciblée | Composition sur mesure : choix des patients ET des données (confidentialité inter-médecins) | ✅ Fait (v36) |
| Signature dans les exports | Signature manuscrite en pied de PDF/HTML/Word | ✅ Fait (v36) |
| Message de fin de relève | Encart libre en fin de document, signé et horodaté | ✅ Fait (v36) |
| Ordre de passage dans la relève | Tri selon la séquence configurée (référence : ordre du matin) | ✅ Fait (v36) |
| Passages non effectués | Marquage du jour « pas de passage prévu » : pastille dédiée, exclu du compteur « À voir », filtre propre | ✅ Fait (v38) |
| Fin de prise en charge | Clôture datée et motivée, sortie automatique des tournées, mention dans la relève, conservation 3/6/9/12 mois, suppression définitive à double validation | ✅ Fait (v38) |
| Contexte subdivisé | Informations typées (accès, vigilance, antécédents, entourage, autre) avec choix individuel d'affichage dans la relève, réglé une fois dans la fiche | ✅ Fait (v38) |
| 🔒 **Cloisonnement des synchros** | Un fichier de synchro ne contient que les patients du cabinet choisi. Rappels typés patient / cabinet / personnel. Documents choisis à l'envoi (aucun par défaut, poids affiché) et triés à la réception (rien n'est jamais écrasé). | ✅ Fait (v41) |
| 🔢 Numérotation v1.0.xx | Numéro affiché lisible, compteur de build Android séparé et croissant | ✅ Fait (v1.0.01) |
| 🐛 Mises à jour impossibles | Chaque dossier Android neuf régénérait une clé différente — clé permanente à créer une fois (TUTO_CLE_SIGNATURE.md) | 🔵 À faire avant le binôme |
| 🦗 Icône Android recentrée | La cigale débordait du cercle de découpe ; réduite, éclaircie, fond dégradé | ✅ Fait (v1.0.01) |
| ✨ Écran de démarrage animé | Cigale battant des ailes aux couleurs du thème | ✅ Fait (v1.0.01) |
| ⚖️ Statut de dispositif médical | Seuils, tendances et alerte de transit interprètent les données — question à trancher avec un juriste avant diffusion (voir CONFORMITE_A_PREPARER.md) | 🔴 Bloquant avant diffusion |
| 📄 Politique de confidentialité | Écran dans l'app et page publique, exigée par le magasin Google | 🔵 À faire |
| 🔒 Verrouillage imposé | Aujourd'hui facultatif ; devrait être obligatoire sur un appareil contenant des dossiers patients | 🔵 À faire |
| 📤 Export du dossier d'un patient | Droit d'accès RGPD — un export lisible, sans case de consentement | 🔵 À faire |
| ⚠️ Avertissement sur les alertes | « Ces seuils sont des repères, leur interprétation relève du professionnel » — sur les trois fonctions concernées | 🔵 À faire |
| 🏪 Publication sur le magasin | À traiter avec la conformité juridique et déontologique d'une app de santé | 🔵 En réserve |
| 📖 Accès au manuel corrigé | Les boutons Télécharger / Ouvrir pour PDF n'étaient qu'en bas de page ; le sommaire du manuel renvoyait à l'écran principal de l'app | ✅ Fait (v77) |
| 🐛 Crayon absent après J-1 | Les soins repris n'avaient ni crayon ni appui long — quatre endroits créaient des soins sans les armer | ✅ Fait (v1.0.13) |
| 🐛 Échec de sauvegarde après chiffrement | La conversion en base64 dépassait la pile d'appels sur les gros documents — corrigé par tranches | ✅ Fait (v1.0.12) |
| 🔐 Documents chiffrés | Ordonnances, comptes-rendus et photos de plaies étaient en clair dans le stockage — chiffrés en AES-GCM, transparent à l'usage | ✅ Fait (v1.0.10) |
| 🗑 Historique GitHub à purger | Les anciens noms restent dans les versions précédentes du dépôt public — procédure dans GITHUB_REMISE_A_ZERO.md | 🔵 À faire |
| 🧹 Tests anonymisés | 15 jeux de test contenaient des noms de patients réels, livrés dans le ZIP et sur GitHub public | ✅ Fait (v1.0.10) |
| 🔐 Synchronisation chiffrée | Le fichier circule en clair par messagerie — à trancher avec le juriste | 🔵 En réserve |
| 🐛 Annulation sans effet dans le déroulé | Le texte restait affiché après « Abandonner » — l'écran séquentiel n'était pas redessiné | ✅ Fait (v1.0.09) |
| 🔁 J-1 par créneau | Le matin, il reprenait le passage du soir de la veille ; il cherche maintenant le même créneau | ✅ Fait (v1.0.09) |
| 🎂 Pastille d'anniversaire | Sur la carte, dans le déroulé et la relève ; 3 jours avant, 1 jour après | ✅ Fait (v1.0.09) |
| 📱 Sommaire du manuel sur téléphone | Il occupait 76 % de la hauteur en restant figé ; replié derrière un bouton sous 820px | ✅ Fait (v1.0.08) |
| 📖 Mode d'emploi à jour | Quatre chapitres ajoutés : fiche de recueil, surveillance des selles, note vocale, nomenclature des documents — 40 captures, versions alignées | ✅ Fait (v1.0.07) |
| ✏️ Libellé du bouton d'ajout | Il disait « Ajouter » alors qu'il ouvre la qualification — devenu « Qualifier et ajouter » | ✅ Fait (v1.0.06) |
| 📎 Nomenclature des documents | Type et précision obligatoires, nom composé automatique, 5 familles dont Libre ; la synchro compare des types datés au lieu de noms de fichiers | ✅ Fait (v1.0.05) |
| 🗜 Conversion des photos en PDF | Proposée à la prise comme à l'import, ~85 % plus léger ; jamais sur une photo de plaie | ✅ Fait (v1.0.05) |
| 📏 Champs tronqués dans la fiche | L'annuaire donnait 71px au nom contre 110px au téléphone ; une ligne par contact, 246px pour le nom | ✅ Fait (v1.0.04) |
| 🐛 Genre et matériel non repris | Le recueil écrivait « H » là où la fiche attend « M », et un type d'information inexistant | ✅ Fait (v1.0.04) |
| 🐛 Bouton Fiche de recueil muet | Posé sans gestionnaire — corrigé, et test de garde ajouté sur tous les boutons de la fiche | ✅ Fait (v1.0.03) |
| 📋 Fiche de recueil | Tous les champs à la suite pour la saisie chez le patient ; vue du dossier, pas document séparé ; impression remplie (1 page) ou vierge (3 pages à cases) | ✅ Fait (v1.0.02) |
| 🤖 Lecture automatique de la fiche | Testée via Google Lens : ~70 % seulement, et ML Kit ferait moins bien — abandonnée au profit de la saisie numérique directe | ⏸ Écarté |
| 🎙 Note vocale jointe à la relève | Deux notes de 3 min max, réécoutables avant et après envoi ; mention de secret professionnel jointe ; effacement automatique réglable | ✅ Fait (v76) |
| 💩 Surveillance des selles | Rangée 0 · + · ++ · +++ · ++++ · Diarrhée dans les constantes ; alerte après N jours à 0, seuil réglable par patient | ✅ Fait (v75) |
| 📍 Déroulé remonté | La signature restait visible au milieu et le déroulé s'affichait 200px plus bas ; il suit maintenant directement la rangée Affichage | ✅ Fait (v74) |
| 🐛 Bouton Enregistrer inatteignable | En mode déroulé, la barre fixe du bas recouvrait le bouton — visible mais intapable ; réserve d'espace ajoutée | ✅ Fait (v73) |
| 🔄 Marqueur de version sur les ressources | Évite que le WebView serve un ancien CSS avec le nouveau JS | ✅ Fait (v73) |
| 📐 Boutons de tournée adaptatifs | Un nom long sortait du bouton et se superposait au suivant ; largeur naturelle et passage à la ligne | ✅ Fait (v72) |
| 🔒 Mode d'emploi anonymisé | Les captures montraient des noms de patients réels — jeu de démonstration entièrement fictif, 31 captures régénérées et vérifiées par OCR | ✅ Fait (v71) |
| 🐛 Crayon absent après J-1 | Les soins repris n'avaient ni crayon ni appui long — quatre endroits créaient des soins sans les armer | ✅ Fait (v1.0.13) |
| 🐛 Échec de sauvegarde après chiffrement | La conversion en base64 dépassait la pile d'appels sur les gros documents — corrigé par tranches | ✅ Fait (v1.0.12) |
| 🔐 Documents chiffrés | Ordonnances, comptes-rendus et photos de plaies étaient en clair dans le stockage — chiffrés en AES-GCM, transparent à l'usage | ✅ Fait (v1.0.10) |
| 🗑 Historique GitHub à purger | Les anciens noms restent dans les versions précédentes du dépôt public — procédure dans GITHUB_REMISE_A_ZERO.md | 🔵 À faire |
| 🧹 Tests anonymisés | 15 jeux de test contenaient des noms de patients réels, livrés dans le ZIP et sur GitHub public | ✅ Fait (v1.0.10) |
| 🔐 Synchronisation chiffrée | Le fichier circule en clair par messagerie — à trancher avec le juriste | 🔵 En réserve |
| 🐛 Annulation sans effet dans le déroulé | Le texte restait affiché après « Abandonner » — l'écran séquentiel n'était pas redessiné | ✅ Fait (v1.0.09) |
| 🔁 J-1 par créneau | Le matin, il reprenait le passage du soir de la veille ; il cherche maintenant le même créneau | ✅ Fait (v1.0.09) |
| 🎂 Pastille d'anniversaire | Sur la carte, dans le déroulé et la relève ; 3 jours avant, 1 jour après | ✅ Fait (v1.0.09) |
| 📱 Sommaire du manuel sur téléphone | Il occupait 76 % de la hauteur en restant figé ; replié derrière un bouton sous 820px | ✅ Fait (v1.0.08) |
| 📖 Mode d'emploi à jour | Régénéré pour la v70 : 37 captures neuves, six chapitres ajoutés (cigale, tendances, santé de l'app, dossier d'enregistrement, retrait de soins, consigne des feuilles) — consultable dans l'app et exportable | ✅ Fait (v70) |
| ✏️ Consigne des feuilles modifiable | Le texte de bas de feuille s'ajuste avant impression ; ponctuel, avec retour au défaut ou aucune consigne | ✅ Fait (v69) |
| 🗑 Retirer un soin d'un passage | Menu d'appui long : commenter, effacer le commentaire, retirer un soin ajouté par erreur | ✅ Fait (v68) |
| 🗑 Supprimer un soin du catalogue | Avec avertissement s'il est utilisé ; l'historique conserve le texte du soin | ✅ Fait (v68) |
| 📌 Rappel fait → information | Cocher un rappel propose de noter le résultat dans la relève ; il y reste jusqu'à suppression manuelle | ✅ Fait (v67) |
| ⏳ Échéance avec décompte | Information épinglée qui compte à rebours, ou rappel de suite programmé | 🔵 En réflexion |
| ▶ Libellé du déroulé conservé | Entrer en mode déroulé écrasait tout le bouton — icône et libellé ; il bascule maintenant « Déroulé » ↔ « Quitter » | ✅ Fait (v66) |
| 💾 Écriture immédiate généralisée | La validation du déroulé ▶ et huit autres gestes écrivaient encore en différé | ✅ Fait (v65) |
| 🖨️ Impression corrigée | `window.print()` ne fonctionne pas dans le WebView Android — passage par le service d'impression du système ; corrigé sur les cinq écrans concernés | ✅ Fait (v64) |
| 🗺️ Aperçu de la feuille de route | S'affiche avant l'envoi, avec Imprimer et Partager | ✅ Fait (v64) |
| 🚫 Filtre « Aucune » | Vide l'affichage des patients sans changer de tournée | ✅ Fait (v64) |
| 📁 Dossier d'enregistrement | Sélecteur natif sur Android, « Enregistrer sous » sur Windows, partage sur iPhone ; chemin mémorisé, repli automatique en cas d'échec | ✅ Fait (v63) |
| 🔐 Avertissement de sauvegarde | Le fichier contient les dossiers en clair — c'est désormais dit avant d'enregistrer | ✅ Fait (v63) |
| 🔑 Sauvegarde par mot de passe | Pour qu'une sauvegarde déposée dans un nuage soit restaurable ailleurs | 🔵 En réserve |
| 💾 Sauvegarde sécurisée | L'écriture était différée de 300 ms : ranger le téléphone après une validation pouvait perdre la donnée. Forcée au passage en arrière-plan, immédiate sur les gestes lourds | ✅ Fait (v62) |
| 🩺 Santé de l'application | Contenu, stockage, dernière sauvegarde, incidents et vérification d'intégrité | ✅ Fait (v62) |
| 📉 Tendances poids et tension | Détecte une dérive lente que les seuils ne voient pas ; constat chiffré dans la fiche et la relève, jamais un diagnostic | ✅ Fait (v61) |
| 📎 Ménage des documents | Filtres combinables — type, patient, âge, poids — et suppression par lot ; les plaies ouvertes protégées | 🔵 En réserve |
| 🎙 Micro refusé dans l'app Android | Permission MODIFY_AUDIO_SETTINGS manquante et WebView n'accordant pas RESOURCE_AUDIO_CAPTURE — corrigé dans postcap.js, à vérifier sur appareil | ⏳ Livré, à tester |
| 📖 Documentation à jour | Trois chapitres ajoutés au manuel illustré : suivi de plaie, anniversaires, relève sans redondance — 44 captures | ✅ Fait (v1.0.24) |
| 📋 Relève sans redondance | « Plan de soins respecté du X au Y » en une ligne ; seuls commentaires, notes et alertes sont datés à part | ✅ Fait (v1.0.23) |
| 🎨 Bouton ＋ Patient aligné | Il paraissait actif en permanence (classe primary) | ✅ Fait (v1.0.23) |
| 🏠 Retour au Moniteur | Ramène à la vue Journée, cartes repliées | ✅ Fait (v1.0.23) |
| 📱 Partage sans Messages | Android masque les SMS quand un fichier est joint — à trancher : proposer un envoi texte seul ? | 🔵 À décider |
| 🔧 Déploiement PWA bloqué | Artefact « github-pages » en double après une tentative interrompue ; overwrite ajouté et actions mises à jour | ✅ Fait (v1.0.22) |
| 🎯 Cartes muettes — cause trouvée | `decorateChip` appelée hors de sa portée depuis `_restoreDraft` ; ne touchait que les patients ayant un passage du jour | ✅ Fait (v1.0.21) |
| 🐛 Bouton « Annuler » inerte | Quatre écrans dessinaient l'en-tête sans câbler la navigation ; le zoom du schéma passait sous le voile | ✅ Fait (v1.0.20) |
| 🔁 Câblage sans devinette | bindInline câble désormais TOUS les formulaires du patient, avec recâblage automatique si des boutons restent muets | ✅ Fait (v1.0.19) |
| 🎯 bindInline cible le bon formulaire | Le même écran servant à la liste et au déroulé, les gestionnaires pouvaient partir sur le formulaire masqué | ✅ Fait (v1.0.16) |
| 🛡 Câblage de la carte sécurisé | Une panne sur un élément rendait TOUS les boutons muets ; chaque outil est désormais indépendant, avec trace de diagnostic | ✅ Fait (v1.0.15) |
| 🐛 Bouton « Déclarer une plaie » muet | Le câblage n'avait jamais été posé — remplacement de code échoué en silence ; test de garde sur les 10 boutons de la carte | ✅ Fait (v1.0.18) |
| 🩹 Plaies dans la carte patient | Déplacé d'Actions vers la carte, entre constantes et transmission ; une ligne quand il n'y a rien | ✅ Fait (v1.0.17) |
| 🎨 Schéma corporel en régions | Chaque partie du corps est la zone cliquable et se colore ; nom affiché hors du SVG (bug du zoom) | ✅ Fait (v1.0.17) |
| 🩹 Suivi de plaie | Plaies regroupant leurs photos datées, schéma corporel dos/face avec 54 localisations, stade et mesures facultatifs, déclaration de cicatrisation | ✅ Fait (v1.0.14) |

| 📥 Différentiel à la réception | Nouveau / plus récent / déjà là, groupé par famille avec le poids — garde-fou contre un confrère peu rigoureux | 🔵 En réserve |
| 🎙 Micro refusé dans l'app Android | Permission MODIFY_AUDIO_SETTINGS manquante et WebView n'accordant pas RESOURCE_AUDIO_CAPTURE — corrigé dans postcap.js, à vérifier sur appareil | ⏳ Livré, à tester |
| 📖 Documentation à jour | Trois chapitres ajoutés au manuel illustré : suivi de plaie, anniversaires, relève sans redondance — 44 captures | ✅ Fait (v1.0.24) |
| 📋 Relève sans redondance | « Plan de soins respecté du X au Y » en une ligne ; seuls commentaires, notes et alertes sont datés à part | ✅ Fait (v1.0.23) |
| 🎨 Bouton ＋ Patient aligné | Il paraissait actif en permanence (classe primary) | ✅ Fait (v1.0.23) |
| 🏠 Retour au Moniteur | Ramène à la vue Journée, cartes repliées | ✅ Fait (v1.0.23) |
| 📱 Partage sans Messages | Android masque les SMS quand un fichier est joint — à trancher : proposer un envoi texte seul ? | 🔵 À décider |
| 🔧 Déploiement PWA bloqué | Artefact « github-pages » en double après une tentative interrompue ; overwrite ajouté et actions mises à jour | ✅ Fait (v1.0.22) |
| 🎯 Cartes muettes — cause trouvée | `decorateChip` appelée hors de sa portée depuis `_restoreDraft` ; ne touchait que les patients ayant un passage du jour | ✅ Fait (v1.0.21) |
| 🐛 Bouton « Annuler » inerte | Quatre écrans dessinaient l'en-tête sans câbler la navigation ; le zoom du schéma passait sous le voile | ✅ Fait (v1.0.20) |
| 🔁 Câblage sans devinette | bindInline câble désormais TOUS les formulaires du patient, avec recâblage automatique si des boutons restent muets | ✅ Fait (v1.0.19) |
| 🎯 bindInline cible le bon formulaire | Le même écran servant à la liste et au déroulé, les gestionnaires pouvaient partir sur le formulaire masqué | ✅ Fait (v1.0.16) |
| 🛡 Câblage de la carte sécurisé | Une panne sur un élément rendait TOUS les boutons muets ; chaque outil est désormais indépendant, avec trace de diagnostic | ✅ Fait (v1.0.15) |
| 🐛 Bouton « Déclarer une plaie » muet | Le câblage n'avait jamais été posé — remplacement de code échoué en silence ; test de garde sur les 10 boutons de la carte | ✅ Fait (v1.0.18) |
| 🩹 Plaies dans la carte patient | Déplacé d'Actions vers la carte, entre constantes et transmission ; une ligne quand il n'y a rien | ✅ Fait (v1.0.17) |
| 🎨 Schéma corporel en régions | Chaque partie du corps est la zone cliquable et se colore ; nom affiché hors du SVG (bug du zoom) | ✅ Fait (v1.0.17) |
| 🩹 Suivi de plaie | Photos datées côte à côte, mesures et protocole en cours ; les photos existent déjà dans Documents mais rien ne les relie entre elles | 🔵 En réserve |
| ⏸ Soins non réalisés | Signaler un soin du plan non coché — écarté : trop de bruit avec les soins non quotidiens. Piste conservée dans la doc technique | 🔵 En réserve |
| 🎨 Kit étendu aux écrans restants | Rangées titrées avec liseré coloré dans les feuilles domicile, la fiche de traitement et le DLU | ✅ Fait (v60) |
| 📐 Échelles typographique et de rayons | 32 tailles → 6, 22 rayons → 4 ; libellés d'outils remontés de 7,5px à 9px | ✅ Fait (v59) |
| 🎨 Couleurs de thème | Boutons DLU passés aux variables : ils devenaient des blocs sombres sur thème clair | ✅ Fait (v59) |
| 💬 Dialogues habillés | Les boîtes natives d'Android remplacées par des cartes aux couleurs de l'app : rouge pour les suppressions, options nommées, saisie intégrée, verrou de confirmation | ✅ Fait (v58) |
| 🏁 Drapeau conditionnel | N'apparaît que pendant le déroulé ou dès qu'un passage existe ; il flottait en permanence et masquait les cartes | ✅ Fait (v57) |
| 💬 Dialogue habillé | Remplace la boîte native d'Android : coins ronds, cigale en filigrane, récapitulatif de ce qu'on clôture | ✅ Fait (v57) |
| 🏁 Écran de fin unifié | Le drapeau et la fin du déroulé mènent au même écran : félicitations + récapitulatif + passages modifiables | ✅ Fait (v57) |
| ☎️ Téléphone du patient | Fixe et mobile dans l'onglet Identité, avec bouton Appeler | ✅ Fait (v56) |
| 📍 Adresse détaillée | Rue, code postal et ville séparés ; assemblés pour le GPS et le DLU | ✅ Fait (v56) |
| ⭐ Étoile colorée par créneau | Ambre matin, bleu soir, neutre les deux, avec légende | ✅ Fait (v56) |
| 🏷️ Pastilles commentables et datées | Appui long pour préciser ; « Médecin contacté » retient sa date et s'atténue après 3 jours ; « Matériel » retiré et converti en rappel | ✅ Fait (v56) |
| 📋 Formulaire de passage structuré | Quatre rangées titrées avec liseré coloré : Ce passage · Soins réalisés · Constantes · Transmission | ✅ Fait (v55) |
| 🔍 Zoom par pincement | Autorisé jusqu'à 3× (interdit auparavant) | ✅ Fait (v55) |
| ▶ Libellé du Déroulé | Le caractère ▶ basculait en emoji sur Android et masquait le libellé — remplacé par un SVG | ✅ Fait (v55) |
| 💊 Noms de médicaments longs | Retour à la ligne au lieu d'une coupure | ✅ Fait (v55) |
| ↩️ Navigation cohérente | Barre « ‹ Destination · ✕ » sur toutes les feuilles (5/43 auparavant), branchée automatiquement ; le bouton retour du téléphone ferme partout ; « Fermer » retiré au profit d'un seul chemin | ✅ Fait (v54) |
| 🎨 Uniformisation de l'interface | Vocabulaire visuel commun étendu à tous les écrans : rangées titrées, gabarit unique de liste, écrans vides explicites, pieds de feuille normalisés, catalogue coloré par famille avec compteurs | ✅ Fait (v53) |
| 🦗 Bandeau de marque | La cigale devient le logo de l'application : grande, animée, sur un bandeau dédié avec le nom et le slogan, cigale en filigrane dans le fond ; reste cliquable (pastille ⚙) et « Cigale » demeure dans la barre d'outils | ✅ Fait (v52) |
| 📋 Type d'information explicite | Grille des six types à l'ajout, pastille cliquable avec ▾ sur chaque ligne existante | ✅ Fait (v51) |
| 🏁 Fin de tournée | Écran récapitulatif avec passages modifiables, retour au Moniteur ; le déroulé reprend au premier patient non vu | ✅ Fait (v51) |
| 🔍 Fermeture de la recherche | Barre de navigation en haut, en plus du bouton en bas | ✅ Fait (v51) |
| 🎨 En-tête du Moniteur repensé | Outils nommés (Cigale, Chercher, Déroulé, Rappels, Patient), disquette réalignée à droite du titre, rangées avec mot-repère + liseré coloré + dégradé, compteurs devenus filtres (plus de défilement horizontal), frise animée par thème (ECG, vagues avec baleine et aileron, tube de néon) | ✅ Fait (v50) |
| 💊 Fiche de traitement structurée | Une ligne par médicament, posologie matin/midi/soir/coucher, traitements « si besoin », forme et remarques ; fiche imprimable A4 ; détection automatique des anticoagulants ; reprise par le DLU ; texte libre conservé tant qu'il n'est pas ressaisi | ✅ Fait (v49) |
| ☀️🌙 Plan de soins par créneau | Chaque soin du plan porte deux cases (matin/soir) ; aucune cochée = proposé aux deux ; la saisie et la relève ne retiennent que les soins du créneau concerné ; liste simple si les créneaux sont désactivés | ✅ Fait (v48) |
| 📅 Saisie différée | Flèches ‹ › sur la date du Moniteur (30 j de recul), bandeau orange explicite, toute l'app suit la date choisie, retour à aujourd'hui à l'ouverture ; date modifiable à l'ajout d'un document | ✅ Fait (v47) |
| 🧹 Ménage dans l'historique | Archive (HTML/texte/CSV/JSON) puis supprime passages et/ou constantes, par période et par patient ; suppression bloquée tant que l'archive n'est pas produite ; JSON réimportable avec choix | ✅ Fait (v46) |
| 📦 Vocabulaire clarifié | « Archiver » renommé « Mettre de côté » (ne produit aucun fichier), avec explication ; le mot archive réservé aux exports réels | ✅ Fait (v46) |
| 📅 Vue Journée | 3ᵉ bouton de créneau affichant toute la tournée en sections repliables par créneau, compteurs sur la journée entière | ✅ Fait (v45) |
| 👤 Fiche en 4 onglets | Identité · Infos · Soins · Actions, une couleur par onglet, aucun champ perdu | ✅ Fait (v45) |
| ✏️ Modifier un passage validé | Rouvrir une carte recharge le passage du jour pour ajouter/retirer un acte ; lien « Annuler » de 6 s après validation | ✅ Fait (v45) |
| 🗓️ Rythme d'un soin | Facultatif, par appui long dans le plan de soins (quotidien, lundi, 2×/semaine…) | ✅ Fait (v45) |
| 🖨️ Feuilles domicile | Trois feuilles vierges A4 à l'en-tête du patient (Constantes avec douleur · Poids · Glycémies), grille mensuelle 1-31, seuils du patient rappelés, deux densités (recto seul ou recto-verso) | ✅ Fait (v44) |
| 📄 Export de l'historique des constantes | Courbes d'évolution avec seuils + tableau détaillé, période au choix, PDF/HTML/texte | ✅ Fait (v44) |
| 🚑 DLU (dossier de liaison d'urgence) | Document pré-rempli depuis la fiche patient (identité, n° sécu, accès, à prévenir, médecin, allergies, traitement, antécédents, appareillages) + autonomie et variables du jour (constantes, motif). Bandeau de vigilances avec détection d'anticoagulant. Trois sorties : afficher, partager, imprimer. Multipage. | ✅ Fait (v43) |
| Enregistrer sans valider | 💾 conserve une saisie durablement sans marquer le passage ; repère sur la carte ; anti-doublon à la validation | ✅ Fait (v42) |
| Sauvegardes complètes | Le contenu des documents est joint au fichier et restauré à l'import ; poids affiché dans Mes données | ✅ Fait (v41) |
| Navigation unifiée | Bouton retour du téléphone géré · en-tête « ‹ Destination » constant · ✕ de fermeture · vocabulaire unifié · poignées conservées | ✅ Fait (v42) |
| Menu réorganisé | 6 rubriques (tournée · partage · patients · données · catalogues · application), deux présentations au choix (tuiles / liste) | ✅ Fait (v40) |
| 🔴 **Cloisonnement des tournées à la synchro** | **À FAIRE — priorité haute.** Aujourd'hui `buildSyncFile()` envoie **tout** le journal : un collègue du Cabinet A reçoit aussi les modifications des Cabinets B et C. **Violation du secret professionnel.** Prévu : sélecteur de tournée à l'envoi, filtrage du journal, vérification en miroir à la réception. | ⏳ À faire |
| Export de fiche patient | Composition à la carte (12 blocs + documents individuels), 3 formats, impression directe | ✅ Fait (v39) |
| Type « Traitement » | 6ᵉ catégorie d'information contextuelle | ✅ Fait (v39) |
| Sélecteur de type | Liste des catégories avec description, au lieu du défilement en boucle | ✅ Fait (v39) |
| Documents Word | Ajout de .docx/.doc/.odt/.rtf en plus des photos et PDF ; icône dédiée, pièce jointe séparée dans les relèves | ✅ Fait (v38) |
| Ajout de document en 2 temps | Un bouton « ＋ Ajouter un document » puis choix de la provenance (Photo · Galerie · PDF · Word) en grille 2 × 2 | ✅ Fait (v38) |
| Sélection des documents | Regroupement par patient, choix document par document, seuls les patients présents dans la relève sont proposés | ✅ Fait (v38) |
| Mode d'emploi embarqué | Manuel illustré téléchargeable depuis l'app (HTML ou impression PDF) | ✅ Fait (v38) |
| Identité visuelle | Logo cigale (icône SVG adaptative + logo grand format), slogan « Tout est dans la cigale », signature JmCve83 / Toulon production | ✅ Fait (v37) |
| Pas de passage prévu | Sauter un patient dans le déroulé sans l'inclure dans la relève | ✅ Fait (v31) |
| Ergonomie de saisie | Boutons flottants masqués pendant la frappe, champs élargis, zéro débordement écran (320→1024 px) | ✅ Fait (v30-v31) |
| v2 intelligence | LLM local optionnel pour la reformulation des transmissions | Horizon v2 |
| Windows | Electron (installateur + portable) | ✅ Fait (v20) |
| PWA multi-plateformes | Application web installable sur iPhone, Android et PC ; fonctionne hors ligne (service worker) ; avertissements renforcés sur iOS non installé | ✅ Fait (v32-v34) |
| Qualité du code | Modules autonomes + garde-fou de build (12 modules vérifiés) | ✅ Fait (v33) |
| Import non destructif | Choix fusion / remplacement avec snapshot de sécurité | ✅ Fait (v33) |
| Synthèse médecin | Export filtré : alertes, plaies, traitements, demandes d'avis | ✅ Fait (v33) |
| Mode compact | Affichage dense du Moniteur pour grosses tournées | ✅ Fait (v33) |
| Rappel déontologique | Information sur les messageries sécurisées de santé au 1er partage | ✅ Fait (v33) |
| Mode d'emploi | Rédaction utilisateur final | Fin de construction |
