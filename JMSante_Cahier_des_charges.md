# JM@Santé — Cahier des charges

**Version 3.3 — 2 septembre 2026 — Document évolutif** *(état applicatif : v36)*

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
