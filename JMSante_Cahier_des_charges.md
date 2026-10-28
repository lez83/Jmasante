# JM@Santé — Cahier des charges

**Version 6.4 — 24 octobre 2026 — Document évolutif** *(état applicatif : v1.32.0)*


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

### 4.12 Référentiel des médicaments — ✅ réalisé (v1.9.0)

**Besoin** : un remplaçant lit sur l'ordonnance d'un patient qu'il ne connaît pas un nom commercial
qui ne lui dit rien. Il lui faut, en quelques secondes et sans réseau, savoir à quoi sert la
molécule, par quelle voie elle passe, et ce qu'il doit surveiller.

**Contenu** : 226 molécules en 14 chapitres. Sept champs — DCI, noms commerciaux, famille
thérapeutique, voie, indication, surveillance infirmière, modalité d'administration.

**Accès** : Réglages → Mes outils → Médicaments, et une **loupe sur chaque ligne du plan de
traitement** qui ouvre la base avec la recherche déjà remplie. Un seul écran pour les deux chemins.

**Recherche** : sur la DCI, **tous** les noms commerciaux, la famille et l'indication, sans tenir
compte des accents ni de la casse, avec surlignage de la correspondance. Sans la recherche par nom
commercial le référentiel n'a pas d'usage : on lit « TAHOR », pas « atorvastatine ».

**Limites assumées — ce qui n'y entre pas, et pourquoi :**

| Exclu | Raison |
|---|---|
| **Interactions médicamenteuses** | Une liste partielle laisse croire qu'on a vérifié : plus dangereux qu'une absence de liste. Renvoi vers la base publique des médicaments, en le disant. |
| **Posologies** et adaptations de dose | C'est la prescription ; elle est sur l'ordonnance du patient. |
| **Contre-indications** | Raisonnement de prescripteur, pas d'exécutant. |
| Codes de remboursement, montants | Hors périmètre du projet. |

La frontière, en une phrase : **ce que le soignant fait au moment de l'administration, oui ; ce que
le médecin décide, non.** « À jeun, 30 minutes avant le petit-déjeuner » entre ; « à distance du
calcium » est une interaction et reste dehors. Des contrôles automatisés refusent qu'une entrée
franchisse cette limite.

**Fraîcheur assumée** : les noms commerciaux sont datés dans l'application et dans le classeur
exporté. Une base qui dit son âge est honnête ; une base muette vieillit en silence. La première
vérification (07/10/2026) a écarté six spécialités inexistantes ou arrêtées.

**Appropriation par l'utilisateur** : chaque fiche se corrige, de nouvelles s'ajoutent, et un
classeur à huit colonnes s'importe et s'exporte. La liste d'origine reste en place et revient à la
demande, en entier ou fiche par fiche — même principe que les valeurs de bilans et les modèles de
documents.

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

**Signature de l'utilisateur (v1.33.0).** Le tracé enregistré dans « Ma fiche » est rangé sous la clé `doc_masignature`, donc chiffré par le coffre au même titre que les documents. Il est **exclu des sauvegardes et des fichiers de synchro** : une signature est un élément d'identification personnelle, et elle n'a aucune raison de voyager avec les dossiers. Sur un appareil neuf, l'utilisateur la retrace une fois. Il peut l'effacer à tout moment depuis « Ma fiche », à double validation.

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
| 🩸 Tension en mm Hg | 130/70 accepté partout ; mélange d'unités signalé ; corrige un faux « hors seuil » du DLU | ✅ Fait (v1.0.34) |
| 🩹 Notes de plaie dans la relève | Cochées une à une depuis le fil, filtrées par période, effacées après envoi | ✅ Fait (v1.0.40) |
| 📷 Photo de plaie jointe | Dernière de la période pré-cochée, les autres au choix | ✅ Fait (v1.0.40) |
| 🏪 Prêt pour le Play Store | API 36 forcée, bundle .aab produit, avertissement au premier lancement | ✅ Fait (v1.0.55) |
| 🔑 APK signé durablement | Clé permanente injectée par postcap, workflow en release, mises à jour installables par-dessus | ✅ Fait (v1.0.52) |
| 📈 Les mesures survivent au passage | Supprimer un passage n'efface plus le point des courbes ; archives purgeables par le Ménage | ✅ Fait (v1.0.51) |
| 🕐 Historique replié par mois | Mois en cours ouvert, un seul à la fois, alertes annoncées | ✅ Fait (v1.0.50) |
| 🔍 Filtres de l'historique | 30 jours / 3 mois / dates précises + recherche dans soins et transmissions | ✅ Fait (v1.0.50) |
| ⚠️ Suppression qui emportait les constantes | Choix « transmission seulement » ou tout, constantes nommées avant perte | ✅ Fait (v1.0.50) |
| 💅 Annuaire illisible | Le bouton Appeler écrasait le texte, replié mot à mot | ✅ Fait (v1.0.49) |
| 📎 Documents pliés par patient | Un bouton par patient sur l'écran d'envoi, compte des pièces retenues visible même replié | ✅ Fait (v1.0.48) |
| 🎤 Dictée confiée au clavier | La reconnaissance du navigateur lâchait ; le bouton ouvre le clavier sur le champ | ✅ Fait (v1.0.47) |
| 📞 Numéro du patient dans l'annuaire | Le patient manquait dans sa propre liste d'appels ; bouton absent s'il était seul | ✅ Fait (v1.0.47) |
| 💅 Croix de suppression décentrées | Centrage flex de tous les boutons d'icône, case à la hauteur du champ | ✅ Fait (v1.0.46) |
| 🐛 Curseur à l'ajout d'une information | Sélecteur :last-of-type qui renvoyait la première ligne | ✅ Fait (v1.0.45) |
| 📄 Antécédents depuis la fiche | Rattachement de documents et lecture de PDF aussi depuis Fiche → Infos | ✅ Fait (v1.0.45) |
| 💊 Prescripteur par médicament visible | Bloc masqué tant qu'aucun spécialiste n'était enregistré | ✅ Fait (v1.0.45) |
| 🧍 Nouvelle cartographie corporelle | 5 vues (face, dos, 2 profils, tête agrandie) × 2 genres, 109 localisations, zones découpées dans la silhouette | ✅ Fait (v1.0.44) |
| ↕️ Ordre des passages en glisser-déposer | Appui long sur ☰, la liste s'écarte, défilement auto ; flèches conservées | ✅ Fait (v1.0.43) |
| 📄 Documents rattachés | Ordonnances du traitement et comptes rendus des antécédents, 5 max, lien vers les Documents | ✅ Fait (v1.0.43) |
| 📄 Lecture d'un PDF | Propositions à cocher pour les antécédents ; allergies dirigées vers les vigilances ; rien d'écrit sans accord | ✅ Fait (v1.0.43) |
| 🐛 Déroulé bloqué sur formulaire vide | ← → et Quitter refusaient de naviguer depuis la v1.0.38 ; naviguer n'enregistre plus rien | ✅ Fait (v1.0.42) |
| 🧭 Nouvelle barre du déroulé | Vrais boutons Préc./Suiv., position « 3 / 12 », progression segmentée, barre collée qui se compacte | ✅ Fait (v1.0.42) |
| 🐛 Bouton 🧍 trop large | .btn impose width:100% : la rangée de la carte de plaie était cassée | ✅ Fait (v1.0.41) |
| 🧍 Voir la plaie sur le schéma | Depuis la carte de plaie, localisation corrigeable | ✅ Fait (v1.0.40) |
| 🐛 Transmission en double | Fusion recollant un texte identique + deux passages séparés non dédoublonnés | ✅ Fait (v1.0.40) |
| 🔢 Fusion : ordre conservé | patientOrder, slotOrder et slotMembers repris ; les nouveaux dossiers à leur rang | ✅ Fait (v1.0.39) |
| ☑️ Fusion : choix des dossiers | Écran montrant ce que chaque dossier apporte, cases à cocher | ✅ Fait (v1.0.39) |
| 🔢 Synchro : ordre facultatif | Case à l'envoi, accord demandé à la réception | ✅ Fait (v1.0.39) |
| 🐛 Validation qui n'enregistrait rien | Promesse non attendue : la carte se fermait et le déroulé annonçait un passage jamais créé | ✅ Fait (v1.0.38) |
| ☝️ Ce qui manque pour valider | Message permanent sous les boutons + dialogue explicite au lieu d'un toast recouvert | ✅ Fait (v1.0.38) |
| 💾 Saisie gardée : voir et corriger | Étiquette datée et ouvrable : contenu, reprise ou effacement ; effacement par clé et par patient | ✅ Fait (v1.0.37) |
| 🕐 Journal de suivi de plaie | Fil daté : ouverture, photos, notes, commentaires rattachés, cicatrisation | ✅ Fait (v1.0.36) |
| 🩹 Localisations tête et visage | 82 zones au total, 31 pour la tête ; schéma cliquable étendu | ✅ Fait (v1.0.36) |
| 🗑 Retirer une photo d'une plaie | Croix sur la vignette : retirer de la plaie ou supprimer ; contenu libéré du stockage | ✅ Fait (v1.0.35) |
| 🖼 Photo de plaie depuis la galerie | Choix appareil photo / galerie | ✅ Fait (v1.0.34) |
| 📲 Ouvrir avec JM@Santé | Toucher un fichier reçu dans WhatsApp ouvre l'app et propose l'import ; attend le déverrouillage — à confirmer sur appareil | ⏳ Livré, à tester |
| 💾 « Saisie en attente » | Bouton renommé « Garder pour plus tard » ; Annuler efface enfin le brouillon | ✅ Fait (v1.0.32) |
| 🩺 Plusieurs médecins | Liste avec spécialité, seuls ceux saisis s'affichent | ✅ Fait (v1.0.31) |
| 👨‍👩 Entourage en liste | Lien, 🚨 à prévenir (DLU), 🤝 personne de confiance ; corrige le doublon « personne à prévenir » | ✅ Fait (v1.0.31) |
| 💊 Prescripteur par médicament | Étiquette sous le nom, imprimée ; sans étiquette = traitant | ✅ Fait (v1.0.31) |
| 📚 Catalogues Antécédents et Appareillage | 44 et 24 phrases ; allergies dirigées vers les vigilances | ✅ Fait (v1.0.31) |
| 🐛 Export de fiche | Plantait dès qu'un contact était saisi | ✅ Fait (v1.0.31) |
| 📌 Sous-rubriques d'« Autre » | Appareillage & matériel, Autonomie & comportement, Libre, + personnalisées | ✅ Fait (v1.0.30) |
| 📚 Catalogue Autonomie & comportement | 41 phrases en 4 sections, notation à crochets, ligne libre, modifiable et incrémentable | ✅ Fait (v1.0.30) |
| ☑️ Infos de fiche en Sélection | Traitement, autonomie, accès… à cocher pour une relève, sans toucher la fiche | ✅ Fait (v1.0.30) |
| 🚑 DLU : autonomie pré-remplie | Reprise de la fiche, à vérifier avant envoi | ✅ Fait (v1.0.30) |
| 🤝 Export par tournée | Premier échange avec un confrère : les dossiers d'une seule tournée, les autres cabinets restent chez soi | ✅ Fait (v1.0.29) |
| ✍️ Choisir ce qui remonte | Case « faire figurer dans la relève » à chaque commentaire de soin, sans mémoire | ✅ Fait (v1.0.27) |
| 💬 Deux mots libres | Un par patient (fiche ou génération), un global — effacés après envoi | ✅ Fait (v1.0.27) |
| 📌 Rappels replacés | Tournée en tête, patient sous son nom | ✅ Fait (v1.0.27) |
| 🐛 « Sélection » plantait | keep indéfini sans tri préalable — le bouton d'édition semblait bloqué | ✅ Fait (v1.0.27) |
| 🗑 « Narrative » retirée | Elle ne produisait pas de prose : doublon de « Structurée » | ✅ Fait (v1.0.27) |
| 🐛 Faux « soins supplémentaires » | Un soin du plan coché matin et fait le soir était classé hors plan — c'est le plan complet qui juge la conformité | ✅ Fait (v1.0.26) |
| 📅 Période sur les trois formats | Seul un bloc sur trois portait les dates de « plan de soins respecté » | ✅ Fait (v1.0.26) |
| 🎙 Micro refusé dans l'app Android | Permission MODIFY_AUDIO_SETTINGS manquante et WebView n'accordant pas RESOURCE_AUDIO_CAPTURE — corrigé dans postcap.js, à vérifier sur appareil | ⏳ Livré, à tester |
| 📖 Documentation à jour | Trois chapitres ajoutés au manuel illustré : suivi de plaie, anniversaires, relève sans redondance — 44 captures | ✅ Fait (v1.0.24) |
| 📋 Relève sans redondance | « Plan de soins respecté du X au Y » en une ligne ; seuls commentaires, notes et alertes sont datés à part | ✅ Fait (v1.0.23) |
| 🎨 Bouton ＋ Patient aligné | Il paraissait actif en permanence (classe primary) | ✅ Fait (v1.0.23) |
| 🏠 Retour au Moniteur | Ramène à la vue Journée, cartes repliées | ✅ Fait (v1.0.23) |
| 📱 Partage sans Messages | Android masque les SMS quand un fichier est joint — à trancher : proposer un envoi texte seul ? | 🔵 À décider |
| 🔧 Compilation APK en échec | setup-android cherchait le paquet « tools », retiré par Google — paramètre packages vidé | ✅ Fait (v1.0.28) |
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
| 🩸 Tension en mm Hg | 130/70 accepté partout ; mélange d'unités signalé ; corrige un faux « hors seuil » du DLU | ✅ Fait (v1.0.34) |
| 🩹 Notes de plaie dans la relève | Cochées une à une depuis le fil, filtrées par période, effacées après envoi | ✅ Fait (v1.0.40) |
| 📷 Photo de plaie jointe | Dernière de la période pré-cochée, les autres au choix | ✅ Fait (v1.0.40) |
| 🏪 Prêt pour le Play Store | API 36 forcée, bundle .aab produit, avertissement au premier lancement | ✅ Fait (v1.0.55) |
| 🔑 APK signé durablement | Clé permanente injectée par postcap, workflow en release, mises à jour installables par-dessus | ✅ Fait (v1.0.52) |
| 📈 Les mesures survivent au passage | Supprimer un passage n'efface plus le point des courbes ; archives purgeables par le Ménage | ✅ Fait (v1.0.51) |
| 🕐 Historique replié par mois | Mois en cours ouvert, un seul à la fois, alertes annoncées | ✅ Fait (v1.0.50) |
| 🔍 Filtres de l'historique | 30 jours / 3 mois / dates précises + recherche dans soins et transmissions | ✅ Fait (v1.0.50) |
| ⚠️ Suppression qui emportait les constantes | Choix « transmission seulement » ou tout, constantes nommées avant perte | ✅ Fait (v1.0.50) |
| 💅 Annuaire illisible | Le bouton Appeler écrasait le texte, replié mot à mot | ✅ Fait (v1.0.49) |
| 📎 Documents pliés par patient | Un bouton par patient sur l'écran d'envoi, compte des pièces retenues visible même replié | ✅ Fait (v1.0.48) |
| 🎤 Dictée confiée au clavier | La reconnaissance du navigateur lâchait ; le bouton ouvre le clavier sur le champ | ✅ Fait (v1.0.47) |
| 📞 Numéro du patient dans l'annuaire | Le patient manquait dans sa propre liste d'appels ; bouton absent s'il était seul | ✅ Fait (v1.0.47) |
| 💅 Croix de suppression décentrées | Centrage flex de tous les boutons d'icône, case à la hauteur du champ | ✅ Fait (v1.0.46) |
| 🐛 Curseur à l'ajout d'une information | Sélecteur :last-of-type qui renvoyait la première ligne | ✅ Fait (v1.0.45) |
| 📄 Antécédents depuis la fiche | Rattachement de documents et lecture de PDF aussi depuis Fiche → Infos | ✅ Fait (v1.0.45) |
| 💊 Prescripteur par médicament visible | Bloc masqué tant qu'aucun spécialiste n'était enregistré | ✅ Fait (v1.0.45) |
| 🧍 Nouvelle cartographie corporelle | 5 vues (face, dos, 2 profils, tête agrandie) × 2 genres, 109 localisations, zones découpées dans la silhouette | ✅ Fait (v1.0.44) |
| ↕️ Ordre des passages en glisser-déposer | Appui long sur ☰, la liste s'écarte, défilement auto ; flèches conservées | ✅ Fait (v1.0.43) |
| 📄 Documents rattachés | Ordonnances du traitement et comptes rendus des antécédents, 5 max, lien vers les Documents | ✅ Fait (v1.0.43) |
| 📄 Lecture d'un PDF | Propositions à cocher pour les antécédents ; allergies dirigées vers les vigilances ; rien d'écrit sans accord | ✅ Fait (v1.0.43) |
| 🐛 Déroulé bloqué sur formulaire vide | ← → et Quitter refusaient de naviguer depuis la v1.0.38 ; naviguer n'enregistre plus rien | ✅ Fait (v1.0.42) |
| 🧭 Nouvelle barre du déroulé | Vrais boutons Préc./Suiv., position « 3 / 12 », progression segmentée, barre collée qui se compacte | ✅ Fait (v1.0.42) |
| 🐛 Bouton 🧍 trop large | .btn impose width:100% : la rangée de la carte de plaie était cassée | ✅ Fait (v1.0.41) |
| 🧍 Voir la plaie sur le schéma | Depuis la carte de plaie, localisation corrigeable | ✅ Fait (v1.0.40) |
| 🐛 Transmission en double | Fusion recollant un texte identique + deux passages séparés non dédoublonnés | ✅ Fait (v1.0.40) |
| 🔢 Fusion : ordre conservé | patientOrder, slotOrder et slotMembers repris ; les nouveaux dossiers à leur rang | ✅ Fait (v1.0.39) |
| ☑️ Fusion : choix des dossiers | Écran montrant ce que chaque dossier apporte, cases à cocher | ✅ Fait (v1.0.39) |
| 🔢 Synchro : ordre facultatif | Case à l'envoi, accord demandé à la réception | ✅ Fait (v1.0.39) |
| 🐛 Validation qui n'enregistrait rien | Promesse non attendue : la carte se fermait et le déroulé annonçait un passage jamais créé | ✅ Fait (v1.0.38) |
| ☝️ Ce qui manque pour valider | Message permanent sous les boutons + dialogue explicite au lieu d'un toast recouvert | ✅ Fait (v1.0.38) |
| 💾 Saisie gardée : voir et corriger | Étiquette datée et ouvrable : contenu, reprise ou effacement ; effacement par clé et par patient | ✅ Fait (v1.0.37) |
| 🕐 Journal de suivi de plaie | Fil daté : ouverture, photos, notes, commentaires rattachés, cicatrisation | ✅ Fait (v1.0.36) |
| 🩹 Localisations tête et visage | 82 zones au total, 31 pour la tête ; schéma cliquable étendu | ✅ Fait (v1.0.36) |
| 🗑 Retirer une photo d'une plaie | Croix sur la vignette : retirer de la plaie ou supprimer ; contenu libéré du stockage | ✅ Fait (v1.0.35) |
| 🖼 Photo de plaie depuis la galerie | Choix appareil photo / galerie | ✅ Fait (v1.0.34) |
| 📲 Ouvrir avec JM@Santé | Toucher un fichier reçu dans WhatsApp ouvre l'app et propose l'import ; attend le déverrouillage — à confirmer sur appareil | ⏳ Livré, à tester |
| 💾 « Saisie en attente » | Bouton renommé « Garder pour plus tard » ; Annuler efface enfin le brouillon | ✅ Fait (v1.0.32) |
| 🩺 Plusieurs médecins | Liste avec spécialité, seuls ceux saisis s'affichent | ✅ Fait (v1.0.31) |
| 👨‍👩 Entourage en liste | Lien, 🚨 à prévenir (DLU), 🤝 personne de confiance ; corrige le doublon « personne à prévenir » | ✅ Fait (v1.0.31) |
| 💊 Prescripteur par médicament | Étiquette sous le nom, imprimée ; sans étiquette = traitant | ✅ Fait (v1.0.31) |
| 📚 Catalogues Antécédents et Appareillage | 44 et 24 phrases ; allergies dirigées vers les vigilances | ✅ Fait (v1.0.31) |
| 🐛 Export de fiche | Plantait dès qu'un contact était saisi | ✅ Fait (v1.0.31) |
| 📌 Sous-rubriques d'« Autre » | Appareillage & matériel, Autonomie & comportement, Libre, + personnalisées | ✅ Fait (v1.0.30) |
| 📚 Catalogue Autonomie & comportement | 41 phrases en 4 sections, notation à crochets, ligne libre, modifiable et incrémentable | ✅ Fait (v1.0.30) |
| ☑️ Infos de fiche en Sélection | Traitement, autonomie, accès… à cocher pour une relève, sans toucher la fiche | ✅ Fait (v1.0.30) |
| 🚑 DLU : autonomie pré-remplie | Reprise de la fiche, à vérifier avant envoi | ✅ Fait (v1.0.30) |
| 🤝 Export par tournée | Premier échange avec un confrère : les dossiers d'une seule tournée, les autres cabinets restent chez soi | ✅ Fait (v1.0.29) |
| ✍️ Choisir ce qui remonte | Case « faire figurer dans la relève » à chaque commentaire de soin, sans mémoire | ✅ Fait (v1.0.27) |
| 💬 Deux mots libres | Un par patient (fiche ou génération), un global — effacés après envoi | ✅ Fait (v1.0.27) |
| 📌 Rappels replacés | Tournée en tête, patient sous son nom | ✅ Fait (v1.0.27) |
| 🐛 « Sélection » plantait | keep indéfini sans tri préalable — le bouton d'édition semblait bloqué | ✅ Fait (v1.0.27) |
| 🗑 « Narrative » retirée | Elle ne produisait pas de prose : doublon de « Structurée » | ✅ Fait (v1.0.27) |
| 🐛 Faux « soins supplémentaires » | Un soin du plan coché matin et fait le soir était classé hors plan — c'est le plan complet qui juge la conformité | ✅ Fait (v1.0.26) |
| 📅 Période sur les trois formats | Seul un bloc sur trois portait les dates de « plan de soins respecté » | ✅ Fait (v1.0.26) |
| 🎙 Micro refusé dans l'app Android | Permission MODIFY_AUDIO_SETTINGS manquante et WebView n'accordant pas RESOURCE_AUDIO_CAPTURE — corrigé dans postcap.js, à vérifier sur appareil | ⏳ Livré, à tester |
| 📖 Documentation à jour | Trois chapitres ajoutés au manuel illustré : suivi de plaie, anniversaires, relève sans redondance — 44 captures | ✅ Fait (v1.0.24) |
| 📋 Relève sans redondance | « Plan de soins respecté du X au Y » en une ligne ; seuls commentaires, notes et alertes sont datés à part | ✅ Fait (v1.0.23) |
| 🎨 Bouton ＋ Patient aligné | Il paraissait actif en permanence (classe primary) | ✅ Fait (v1.0.23) |
| 🏠 Retour au Moniteur | Ramène à la vue Journée, cartes repliées | ✅ Fait (v1.0.23) |
| 📱 Partage sans Messages | Android masque les SMS quand un fichier est joint — à trancher : proposer un envoi texte seul ? | 🔵 À décider |
| 🔧 Compilation APK en échec | setup-android cherchait le paquet « tools », retiré par Google — paramètre packages vidé | ✅ Fait (v1.0.28) |
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
| 🖨️ Feuilles domicile | Trois feuilles vierges A4 à l'en-tête du patient (Constantes · Poids · Glycémies), grille mensuelle 1-31, **ma mention en bas de page à la taille choisie**, deux densités (recto seul ou recto-verso), et les **colonnes de la feuille de constantes composables patient par patient**. Accessibles **sans dossier** depuis Mes outils → Documents vierges | ✅ Fait (v44, étendu v1.20.0 et v1.25.0) |
| 📄 Export de l'historique des constantes | Courbes d'évolution avec seuils + tableau détaillé, période au choix, PDF/HTML/texte | ✅ Fait (v44) |
| 🚑 DLU (dossier de liaison d'urgence) | Document pré-rempli depuis la fiche patient (identité, n° sécu, accès, à prévenir, médecin, allergies, traitement, antécédents, appareillages) + autonomie et variables du jour (constantes, motif). Bandeau de vigilances avec détection d'anticoagulant. Trois sorties : afficher, partager, imprimer. Multipage. | ✅ Fait (v43) |
| Enregistrer sans valider | 💾 conserve une saisie durablement sans marquer le passage ; repère sur la carte ; anti-doublon à la validation | ✅ Fait (v42) |
| Sauvegardes complètes | Le contenu des documents est joint au fichier et restauré à l'import ; poids affiché dans Mes données | ✅ Fait (v41) |
| Navigation unifiée | Bouton retour du téléphone géré · en-tête « ‹ Destination » constant · ✕ de fermeture · vocabulaire unifié · poignées conservées | ✅ Fait (v42) |
| Menu réorganisé | 6 rubriques (tournée · partage · patients · données · catalogues · application), deux présentations au choix (tuiles / liste) | ✅ Fait (v40) |
| 🔒 Cloisonnement des tournées à la synchro | **Fait, et la ligne était périmée.** `buildSyncFile()` filtre bien : mesuré sur deux cabinets, le fichier du Cabinet A porte le changement de A et **rien** de B — ni son patient, ni son rappel, ni son identifiant. Rien ne le gardait : une épreuve le mesure désormais sur le **journal** et non plus seulement sur l'export | ✅ Fait · gardé (v1.32.0) |
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
| Moniteur au choix | Présentation Cartes / Aérée | ✅ Fait (v1.0.57) |
| Constantes en tableau de bord | Tuiles avec date et badge selon les seuils, au choix | ✅ Fait (v1.0.58) |
| Cartes à bande latérale | Statut sur tout le bord gauche, 📞 et 📍, au choix + légende | ✅ Fait (v1.0.58) |
| Code de verrouillage renforcé | 6 chiffres, code de secours type banque, incitation 5 lancements | ✅ Fait (v1.0.58) |
| Aides de première utilisation | Bulles « Ne plus afficher », « Revoir les aides » | ✅ Fait (v1.0.58) |
| Échanges protégés | Appairé / mot de passe / libre par destinataire, sans serveur | ✅ Fait (v1.0.58) |
| Appairage des collègues | Sécurisé (2 scans) ou rapide (1 scan), copier-coller, oubli | ✅ Fait (v1.0.58) |
| Clé locale renforcée | Sel aléatoire + 600 000 itérations, migration transparente | ✅ Fait (v1.0.59) |
| Couleurs des statuts | Palettes (JM@Santé, Feu tricolore, Contraste fort, Daltonisme), retouche, aperçu, garde-fou | ✅ Fait (v1.0.60) |
| Aide daltonisme | Motifs sur la bande et la légende, formes sur les pastilles | ✅ Fait (v1.0.60) |
| Tailles de pastille | Petite, moyenne, grande | ✅ Fait (v1.0.61) |
| Tuiles cliquables | Accès direct à la saisie ou aux courbes | ✅ Fait (v1.0.61) |
| Écran Personnaliser | Zones, aperçu, réinitialisation | ✅ Fait (v1.0.62) |
| Texte et zoom | 3 tailles, zoom intelligent / natif / désactivé, Ctrl+molette | ✅ Fait (v1.0.62) |
| Constantes et cartes | Masquer, ordonner, forcer par patient ; contenu des cartes | ✅ Fait (v1.0.62) |
| Barre d'outils, ouverture | Raccourcis au choix, tournée et moment d'ouverture | ✅ Fait (v1.0.62) |
| Thème jour/nuit, relève par défaut | Bascule horaire ; format, contenu, ordre, signature | ✅ Fait (v1.0.62) |
| Partage des réglages | Liste fermée, sans donnée patient, retour possible | ✅ Fait (v1.0.62) |
| Zoom photos et documents | ×5, déplacement, double-toucher | ✅ Fait (v1.0.62) |
| Constantes en trois lieux | Ligne résumé, tuiles, saisie ; hors seuil toujours visible réglable | ✅ Fait (v1.0.63) |
| Thème Cosmos · NGC 3324 | 6 vues animées selon l\x27heure, Nord/Sud/Alterner, ordre et horaires réglables, fondu, niveaux d\x27animation | ✅ Fait (v1.0.64) |
| Étiquette ✨ NGC 3324 | Police ronde Comfortaa embarquée, dégradé nébulaire animé | ✅ Fait (v1.0.65) |
| Retour haptique | Vibration « succès » à la validation d\x27un passage, réglable | ✅ Fait (v1.0.66) |
| Étiquettes personnalisées | Icône, couleur, genre, lieux d\x27affichage ; partagées sans écrasement | ✅ Fait (v1.0.67) |
| 📅 Dates et claviers | Date de naissance en JJ/MM/AAAA avec masque et refus d'une date impossible ; clavier numérique sur les téléphones | ✅ Fait (v1.7.4) |
| 📥 Plan de traitement depuis un classeur | Modèle vierge, import avec repérage des colonnes par leur titre, écran de relecture avant écriture. **Décision de cadrage : pas d'IA ni de scan d'ordonnance dans l'application** — c'est le soignant qui transcrit | ✅ Fait (v1.7.4) |
| ☑︎ Effacer plusieurs médicaments | Mode sélection, tout cocher, raccourci « Nouvelle ordonnance » tout coché, annulation pendant 8 secondes | ✅ Fait (v1.8.0) |
| 🔒 Note soignante | Second champ par médicament, dépliable, qui **ne sort jamais** sur la fiche remise au patient ni dans la relève ou le DLU | ✅ Fait (v1.8.0) |
| 🖨️ Deux versions de la fiche de traitement | Version patient par défaut, version soignant annoncée dans son titre et par un bandeau | ✅ Fait (v1.8.0) |
| 🐛 Boutons « Annuler » inopérants | `#toast` portait `pointer-events:none` sans exception : **aucune annulation de l'application n'avait jamais été cliquable**. Trouvé par une épreuve en navigateur réel | ✅ Corrigé (v1.8.0) |
| 💊 Référentiel des médicaments | 226 molécules, recherche par nom commercial, loupe depuis le plan de traitement, correction et ajout par l'utilisateur, classeur. Interactions volontairement exclues (cf. §4.12) | ✅ Fait (v1.9.0) |
| 📖 Dette de documentation | Guide simple de l'app en retard de trois versions ; pastilles de comptage écrites en dur (6 annoncées pour 29) ; mode d'emploi livrable figé à 15 chapitres contre 38. Comptage calculé, livrable régénéré par la compilation | ✅ Corrigé (v1.9.1) |
| 🔔 Alertes datées sur notes et rappels | Une seule mécanique partagée : date, heure, rappels anticipés, répétition. **Notification Android silencieuse** (canal d'importance basse, sans son ni vibration) + **bandeau à l'ouverture** qui rattrape ce qui a été raté, retard en rouge | ✅ Fait (v1.10.0) |
| 🐛 Notifications jamais reprogrammées | Le crochet sur `save` était **déclaré et jamais installé** : un rappel créé en tournée ne programmait rien jusqu'au redémarrage. Les trois permissions Android n'étaient pas davantage déclarées | ✅ Corrigé (v1.10.0) |
| 💾 Témoin d'enregistrement visible | Il existait, mais le voile des panneaux le recouvrait — invisible là où l'on modifie. Repris dans chaque barre de panneau ; **un échec reste affiché en rouge** au lieu de partir dans un journal | ✅ Fait (v1.10.0) |
| ☀️🌙 Créneaux par tournée | `S.slotsEnabled` était commun à toutes les tournées (30 lectures dans 8 modules) → helper unique `slotsOn(tour)`. **Éteindre masque sans effacer** : composition et ordre de passage par créneau sont conservés | ✅ Fait (v1.10.0) |
| ☰ Vue liste du Moniteur | Liste nom-prénom alphabétique, pour retrouver quelqu'un sans défiler. **Statut et vigilance restent affichés** — un réglage d'affichage ne cache jamais une alerte | ✅ Fait (v1.10.0) |
| 📦 Archives par cabinet | Groupes repliables ; le cabinet est **inscrit à la mise de côté**, donc insensible à un renommage ultérieur de la tournée | ✅ Fait (v1.10.0) |
| 💊 Base élargie à 267 molécules | Associations fixes (32, avec le rappel « une seule ligne de traitement ») et biosimilaires injectables ; repêchage par mots pour les noms génériques composés | ✅ Fait (v1.10.0) |
| 🐛 Boîtes de dialogue natives | Neuf `confirm()` d'Android remplacés par le dialogue de l'app | ✅ Corrigé (v1.10.0) |
| ☰ Le listing par ordre de passage | Une ligne par patient dans l'ordre de la tournée : rang et nom à gauche, l'essentiel à droite **sur une seule ligne**, 📞 📍 au bout. Tri A→Z en second. Reprend la vue ☰ au lieu d'ajouter un troisième affichage | ✅ Fait (v1.11.0) |
| 🐛 Le listing écrasé sur une demi-largeur | `#board` est une grille à deux colonnes : la vue ☰ y tenait dans une seule case, noms coupés à la deuxième lettre. **Défaut présent dès la v1.10.0**, trouvé à la capture d'écran | ✅ Corrigé (v1.11.0) |
| 💊 Un troisième rythme de prise | « Autre rythme » à côté de fixe et si besoin : masque les quatre moments, quatre raccourcis + champ libre. **Aucune date de prochaine prise n'est calculée** — une date fausse sur une injection semestrielle est pire qu'une phrase à relire | ✅ Fait (v1.11.0) |
| 💊 Douze formes galéniques | Gélule, inhalateur, spray, sirop, collyre, suppositoire, crème ajoutés. Les cinq codes d'origine sont intacts : les dossiers déjà saisis retrouvent leur case | ✅ Fait (v1.11.0) |
| ✉️ 📞 📍 Les coordonnées se touchent | Dans l'annuaire du cabinet, **aucune coordonnée n'était actionnable, pas même les téléphones**. Un fax ou un « autre » ne reçoit aucun bouton : rien à ouvrir, donc rien d'affiché. Champ e-mail au dossier patient, bouton visible seulement s'il est rempli | ✅ Fait (v1.11.0) |
| 🐛 Le prescripteur « bloqué » | Un médecin repris **depuis l'annuaire du cabinet** n'avait pas d'identifiant : sa pastille portait `data-tpr=""`, la même valeur que « Médecin traitant ». **Les deux boutons étaient le même bouton.** Réparé à la lecture (dossiers déjà saisis) et à la source | ✅ Corrigé (v1.11.0) |
| 🐛 Le GPS jetait le code postal et la ville | Le bouton 🗺️ de la fiche ne lisait que la ligne de rue, alors que la pastille 📍 des cartes assemblait déjà les trois. D'où la recopie manuelle de la ville, et la répétition enregistrée dans les dossiers | ✅ Corrigé (v1.11.0) |
| ✂️ Ranger les adresses héritées | Les dossiers d'avant les cases CP/ville portent tout sur une ligne. Détection, avis sur la fiche, reprise de tous les dossiers d'un coup après relecture. **On ne coupe que sur le code postal, ou sur une ville ponctuée** — « 3 rue de Toulon » ne devient jamais « 3 rue de » | ✅ Fait (v1.11.0) |
| 🐛 Le pied de page annonçait v1.7.3 | Quatrième numéro écrit à la main trouvé dans ce dépôt, sept versions de retard, visible à chaque ouverture. Écrit désormais par `build.js` depuis `package.json` | ✅ Corrigé (v1.11.0) |
| 🏥 Inscrire au cabinet depuis un dossier | Le chemin inverse de « Depuis le cabinet », qui ne marchait que dans un sens. Pastille sous le nom, inscription en **Partenaires**, famille déduite du métier. **Jamais de doublon** : un même nom est rattaché, pas recréé | ✅ Fait (v1.12.0) |
| 📄 Nouvelle ordonnance depuis la fiche de traitement | « Rattacher » ne proposait que l'existant et répondait « ajoute-le d'abord dans Documents » : sept gestes pour un. Raccourci vers l'import habituel, **famille Prescriptions imposée**, retour automatique, ordonnance rattachée | ✅ Fait (v1.12.0) |
| 🎯 Reprendre un médecin du cabinet en un geste | Les deux boutons sont déjà au même niveau dans le code courant — version installée antérieure, ou autre écran. **En attente d'une vidéo** | ⏸ Reporté |
| 🐛 Jeu : la sortie masquait les scores | `✕ Quitter` était posé par-dessus le cadre, pile sur les boutons 🏆 SCORES et 🔊 SON du jeu : **les scores étaient inatteignables**. Il vit maintenant dans une barre à lui, qui porte aussi le retrait de la barre d'état du téléphone | ✅ Corrigé (v1.12.1) |
| 🎮 Jeu : pavé directionnel au pouce | 56 × 44 px au milieu d'un vide noir : on regardait le pavé au lieu du jeu. Descendu au bas de l'écran, agrandi, et surtout **écarté** — c'est l'écart qui permet de distinguer les touches sans les voir | ✅ Fait (v1.12.1) |
| 🐛 Thème Réunion : blocs illisibles | 28 règles peignaient les blocs en creux avec `--bg`, qui est la couleur du DÉCOR dans ce thème et non une surface : texte sombre sur ardoise foncée, **contraste 1,32:1**. Jeton `--inset` plutôt que 28 rustines — aucun autre thème ne bouge | ✅ Corrigé (v1.12.2) |
| 📋 L'onglet Infos : l'écran vide enseigne | Les six types tiennent la place d'un dossier neuf, avec un exemple chacun, et se replient en un bouton dès la première information. La règle **relève / fiche** descend sous la liste, au contact des interrupteurs qu'elle décrit | ✅ Fait (v1.13.0) |
| 🐛 « Documents rattaché » | Le `s` était posé sur l'adjectif et le nom écrit au pluriel en dur : accord fautif sur presque tous les dossiers. Nom et adjectif s'accordent ensemble, au masculin comme au féminin | ✅ Corrigé (v1.13.0) |
| 🛡 Garde-fou : accent grave dans un commentaire HTML | Piège rencontré **deux fois** : il referme le gabarit et casse le fichier. `build.js` nomme désormais le module, la ligne et le commentaire au lieu de laisser chercher | ✅ Fait (v1.13.0) |
| 💊 Instillation oculaire au catalogue | Rangée dans « Gestion médicamenteuse et coordination », à côté du même geste par voie orale | ✅ Fait (v1.13.0) |
| 🧮 Les calculs refondus | Quatre champs nus rendaient des nombres justes sans dire ce qu'ils attendaient. La seringue électrique devient une suite de trois étapes numérotées (ce qu'il y a dans la seringue → ce qui est prescrit → ce qu'on affiche sur la pompe) avec quatre unités de prescription et la **durée de tenue**. La dose demande *ce qui est écrit sur l'ampoule* et se calcule **dans les deux sens** | ✅ Fait (v1.14.0) |
| 🔁 Conversions d'unités | Masse, volume et concentration à côté de la glycémie et de l'IMC. Les deux premières n'affichent pas un résultat mais **toute l'échelle** d'un coup — 250 mg se lit 250 000 µg · 0,25 g · 0,00025 kg. La concentration donne la masse contenue dans une poche : G5 % dans 500 mL = 25 g | ✅ Fait (v1.14.0) |
| 🩸 Héparines : un calculateur, pas un tableau | Un tableau figé porte sa concentration **en creux** : « 1 mL = 5 000 UI » n'est vrai que pour la sodique — la calcique fait 25 000 UI/mL, **cinq fois** la dose, et vingt-cinq fois entre les extrêmes de la gamme. L'écran demande la concentration EN PREMIER, refuse de calculer sans elle, et **redit la concentration employée** sous le résultat. Sources ANSM et MSF relues le 11/10/2026 | ✅ Fait (v1.14.0) |
| 🩸 Les milligrammes d'héparine | **Aucun RCP français ne donne d'équivalence UI ↔ mg** : les seuls milligrammes du RCP concernent les excipients. La convention « 1 mg = 100 UI » est un héritage d'étiquetage. Disponible — une vieille ordonnance peut en porter — mais **repliée et étiquetée pour ce qu'elle est**, jamais au même niveau que les UI | ✅ Fait (v1.14.0) |
| 🚫 Passer d'une héparine à une autre | Aucune équivalence officielle n'existe entre HBPM, et le choix du produit est une décision de prescription. **Refusé, définitivement** | ⛔ Hors périmètre |
| 🐛 `calcMajResultats` appariait des positions | Une liste de noms était appariée à l'**ordre des blocs** dans le DOM : ajouter un résultat au milieu de l'écran décalait silencieusement tous les suivants. Chaque bloc porte un `data-cr` et se vise par son nom. Défaut latent depuis l'origine, révélé par le premier ajout en milieu d'écran | ✅ Corrigé (v1.14.0) |
| 📖 Le manuel et le guide d'écran | Chapitre 35 réécrit en quatre sections, et un bloc de guide posé sur l'écran de la base des médicaments — là où on arrive quand on cherche une présentation | ✅ Fait (v1.14.0) |
| 🐛 Le passage du soir disparaissait avant d'avoir eu lieu | `statusOf` répondait « vu » dès qu'il existait UN passage dans la journée, sans regarder le créneau — alors que chaque passage enregistre le sien. Un patient vu le matin passait au vert dans la vue du soir : **à voir = 0**. Défaut présent depuis l'arrivée des créneaux, mesuré sur la démo avant d'être corrigé | ✅ Corrigé (v1.15.0) |
| ↩ Le passage supplémentaire | Deux passages dans la même demi-journée, pour quelques semaines : **Aucun · Le matin · Le soir** sur le dossier, et le dossier apparaît **deux fois** dans l'ordre de passage, à la place qu'on lui donne. Chaque rang porte son état, les compteurs comptent des **passages** et non des patients. Pas de créneau de midi : une structure permanente pour un besoin temporaire | ✅ Fait (v1.15.0) |
| 📅 La date de fin prévient, elle n'efface pas | Au jour dit, le dossier signale « à retirer ? » et c'est l'utilisateur qui retire. **Une date qui supprime toute seule peut faire rater un passage ; une date qui informe, non** | ✅ Fait (v1.15.0) |
| 🐛 La vue Liste était ignorée en vue Journée | La branche des sections passait avant et ne consultait jamais le réglage : le bandeau annonçait « Listing » et l'écran affichait des cartes. **Le bouton mentait.** Les sections restent désormais, et leurs contenus passent en lignes | ✅ Corrigé (v1.15.0) |
| 🐛 Le bouton « compact » ne faisait rien en vue Liste | Toutes les règles de `body.compact-board` visent `.pcard` ; aucune ne touche aux lignes. On appuyait sur un bouton muet sans que rien ne le dise | ✅ Corrigé (v1.15.0) |
| 🎛 « Afficher » et « Vue » : deux rangées | Cinq pastilles de même forme mélangeaient **quoi montrer** et **comment le montrer**, débordaient en 4 + 1, et deux d'entre elles étaient des icônes muettes. Sélecteur segmenté **Cartes · Compact · Liste**, trois états nommés et **exclusifs**. Maquette B retenue sur trois proposées | ✅ Fait (v1.15.0) |
| 🐛 La ligne du 2ᵉ passage affichait l'heure du premier | `lastVisit` rend le passage le plus récent : un rang qui restait à faire s'annonçait « vu aujourd'hui à 07:20 ». Chaque rang lit le sien. Trouvé à la capture, pas à l'épreuve | ✅ Corrigé (v1.15.0) |
| 🛡 Le ménage du démarrage et la clé d'occurrence | `init.js` purge les identifiants d'ordre sans dossier ; la chaîne `p1#2` en est un pour lui. **Le 2ᵉ passage aurait perdu sa place à chaque ouverture**, en silence. Le purgeur redescend au dossier avant de juger | ✅ Évité (v1.15.0) |
| 🐛 Le déroulé créait des passages en double | ←, → et Quitter enregistraient dès que le formulaire n'était pas vide — or un patient validé revient avec ses soins cochés. Mesuré : **valider avec le bouton du bas puis appuyer une fois sur → donnait déjà deux passages**, sans un mot, l'enregistrement du déroulé étant silencieux. Désormais **un seul chemin crée un passage** : le bouton « ✓ Valider le passage » | ✅ Corrigé (v1.15.1) |
| 💾 Une saisie non validée n'est jamais jetée | En quittant un patient avec une saisie en cours, elle devient une **saisie gardée** et l'écran le dit. Perdre ce qui vient d'être tapé serait bien pire qu'un doublon | ✅ Fait (v1.15.1) |
| 🛡 Une suite devenue verte sur du vide | `_test_seq_save` validait par → et vérifiait l'enregistrement immédiat ; le passage n'étant plus créé, il affichait « ✗ encore en attente » **sans compter l'échec**. L'échec compte désormais, et la suite valide par le bon bouton | ✅ Corrigé (v1.15.1) |
| 📖 Le manuel affirmait le contraire | « Chaque passage est enregistré automatiquement quand tu passes au suivant — inutile de valider séparément » décrivait précisément le comportement supprimé | ✅ Corrigé (v1.15.1) |
| ✓ Valider sans descendre | Un second bouton **✓ Valider le passage** dans le bandeau collé du déroulé : plus besoin de descendre tout en bas puis de remonter prendre la flèche. Il **appuie sur celui du bas** plutôt que de valider lui-même — un seul chemin, un seul endroit où un défaut peut se loger | ✅ Fait (v1.15.2) |
| 📐 Et il rétrécit avec le bandeau | Laissé à sa taille, il volait **54 px au formulaire en permanence** (bandeau 111 px contre 57 px) pour un bouton qui ne sert qu'à la fin. Réduit, il n'en coûte plus que 23. Mesuré, pas estimé : barre 131 → 80 px, bouton 36 → 20 px, **libellé entier conservé** | ✅ Fait (v1.15.2) |
| 🔁 Deux boutons, une seule histoire | Les deux s'éteignent ensemble quand il n'y a rien à valider, et celui du haut devient « Passage enregistré — modifier » une fois le passage créé. Un bouton du haut resté « à valider » ferait appuyer « au cas où » — le geste même qui fabriquait les doublons | ✅ Fait (v1.15.2) |
| 🐛 Le décor traversait les cartes « vues » | `opacity:.62` sur la carte × `--surface` à .9 = **0,56** d'opacité effective : sur le thème Réunion, la montagne et la mer passaient au travers et le texte devenait illisible. Le fond reste désormais plein, seul le **contenu** s'estompe — et la pastille de statut ne s'estompe jamais | ✅ Corrigé (v1.15.3) |
| 🐛 Une carte dépliée faisait 1 795 px | Un `backdrop-filter` sur un élément de cette taille n'est pas composité en entier par WebKit : en-tête opaque, reste transparent. Plus de flou sur une carte dépliée, et fond franchement opaque | ✅ Corrigé (v1.15.3) |
| 🎨 Jeton `--surface-plein` | La même couleur que l'œil voit, mais sans transparence, pour les six thèmes qui posent un voile. **Composée sur `--bg`, calculée et non choisie à la main** | ✅ Fait (v1.15.3) |
| 🛡 Un seuil d'épreuve jeté après mesure | « Fond opaque à 85 % » condamnait quatre thèmes dont le voile est un parti pris assumé sur fond uni. Le contrôle compare désormais l'opacité d'une carte **vue** à celle d'une carte **à voir** — et ne garde le seuil que pour Réunion, seul thème à fond en image | ✅ Fait (v1.15.3) |
| 🐛 Contours en pointillés bariolés | Le fini Relief donne **quatre couleurs de bordure** pour simuler le volume : sur un contour plein elles se fondent, sur un contour en pointillés chaque tiret prend la couleur de son côté. « 🚫 Aucune » sortait blanche en haut, sombre en bas. Un contour en pointillés n'a plus qu'**une** couleur ; le relief lui vient de son ombre | ✅ Corrigé (v1.15.4) |
| 🛡 Le balayage plutôt que la liste | Le fini Relief s'était déjà fait avoir par une liste de classes écrite à la main. L'inventaire a donc été établi **par la mesure** (trois familles exactement), et `pw_themes` balaie désormais l'app sur trois finis × trois thèmes pour refuser tout contour en pointillés aux côtés dépareillés | ✅ Fait (v1.15.4) |
| 🐛 Une pastille de soin cochée ne se lisait pas | `.chip.on` portait le texte en `--accent` sur un fond `--accent-soft` : **le même accent**, plein d'un côté et à 13 % de l'autre, soit un contraste de **1,00**. Signalé sur le thème Réunion en scène « jour », mais le couple fautif valait sur les neuf thèmes — ailleurs le fond sombre faisait ressortir l'accent et masquait le défaut | ✅ Corrigé (v1.15.5) |
| 🎨 La couleur signale, elle n'écrit pas | Fond `--surface` (stable), écriture `--text` en gras, et c'est le **liseré** qui dit « coché ». Un fond teinté avait été mesuré à 8,90 de jour et **1,34** le soir : `--accent-soft` est semi-transparent et laisse passer le décor. **Un fond qui dépend du décor ne peut pas porter du texte** | ✅ Fait (v1.15.5) |
| 👁 Liseré de 4 px, pastille inchangée | « Il faut que ce soit simple à visualiser du premier regard. » Le trait est tracé vers l'intérieur : la pastille reste haute de **44 px** dans les quatre épaisseurs essayées — épaissir ne décale aucune ligne. Contraste minimum **11,13** sur 13 thèmes × 3 finis | ✅ Fait (v1.15.5) |
| 🛡 Une épreuve dont on dit la portée | `pw_themes` mesure le contraste d'une pastille cochée en composant les surfaces semi-transparentes sur le fond, et retient pour Réunion la **pire des deux scènes**. Vérifiée en remettant le défaut, elle ne fait rougir que **deux thèmes sur neuf** (bloc 3,66 · reunion 2,27) : elle garde franchement les thèmes clairs, et pas une régression équivalente sur fond sombre | ✅ Fait (v1.15.5) |
| 🐛 Les constantes du soir écrasaient celles du matin | Rouvrir un patient déjà vu le jour même rechargeait son passage **en mode modification** : le formulaire du soir s'ouvrait rempli des constantes du matin, et valider modifiait le passage du matin au lieu d'en créer un second. La condition ne regardait que la date, jamais l'écart de temps | ✅ Corrigé (v1.16.0) |
| 🐛 Le défaut dépendait d'une frappe | `_saveDraft` reconstruit le brouillon à chaque caractère **sans reporter le lien vers le passage repris**. Selon qu'on avait tapé ou non avant de valider, le même geste écrasait le passage précédent ou en créait un second. **Un comportement qui dépend d'une frappe ne se décrit pas, il se subit** — c'est ce qui l'a rendu insaisissable | ✅ Corrigé (v1.16.0) |
| ✏️ Corriger un passage, exprès | Contrepartie relevée **avant** d'appliquer la règle « toujours un passage neuf » : le rechargement supprimé était le seul à poser le lien de modification, donc un passage validé devenait définitif. Un bouton **✏️ sur chaque passage de 🕐 Historique** rend cette capacité, sur le passage qu'on choisit. Le créneau est repris : corriger le soir un passage du matin ne le reclasse pas | ✅ Fait (v1.16.0) |
| 🐛 Une série sans mesure était masquée, pas annoncée | Les sept séries étaient **déjà tracées** — glycémie et saturation comprises. Une série sans relevé sur 90 jours disparaissait purement, et l'absence se lisait « l'application ne sait pas la tracer ». Elle reste désormais affichée, éteinte, avec « aucune mesure » | ✅ Corrigé (v1.16.0) |
| 📖 L'historique en chiffres | Une courbe répond à « comment ça évolue », pas à « combien mardi soir » — et ne se lit pas au téléphone avec un médecin. Trois lectures : **Série**, **Passage**, **Tableau**, sur un interrupteur à **deux crans** (Courbe / Liste, puis la forme). La rangée des séries ne paraît que là où elle agit | ✅ Fait (v1.16.0) |
| 🖨 Exporter un mois qui se range | L'export existait, mais sa période était **glissante** : imprimé le 3 novembre, « 1 mois » donne du 4 octobre au 3 novembre, et le mois suivant rechevauche. Trois modes — **Glissant · Mois calendaire · Du… au…** — et le contenu au choix : **Courbes, Tableau ou Tout**. Bornes de mois gardées par l'épreuve, bissextile et bascule d'année comprises | ✅ Fait (v1.16.0) |
| 🧹 Repérer et supprimer les doublons de constantes | Le déroulé d'avant la v1.15.1 a semé des passages en double — **mêmes valeurs, même jour, quelques minutes d'écart**. L'application les repère dans la vue Tableau : égalité **stricte** des constantes et moins de **5 minutes** d'écart, un exemplaire gardé par groupe. Elle **propose**, elle ne supprime jamais seule — *un relevé effacé à tort ne se retrouve pas* | ✅ Fait (v1.17.0) |
| ⚖️ Écarter n'est pas supprimer | Deux gestes distincts qui partagent les cases à cocher mais jamais le bouton : **☑️ Choisir** retire des lignes du document imprimé sans toucher aux données, **🔍 Repérer les doublons** désigne des passages à effacer. Un bouton unique aurait fini par effacer un relevé qu'on voulait seulement écarter d'une feuille | ✅ Fait (v1.17.0) |
| ⚠️ Le seul cas où une mesure ne survit pas | Partout ailleurs, supprimer un passage **archive ses constantes** pour ne pas trouer une courbe. Pour un doublon c'est l'inverse : archiver le laisserait tracé deux fois. La suppression emporte donc la mesure, y compris celles déjà archivées par un ancien 🗑 | ✅ Fait (v1.17.0) |
| 📊 Le tableau en classeur | Format **Excel** en plus de PDF, HTML et Texte. Tableau seul — un classeur de courbes n'a pas de sens. **Tensions séparées** en systolique et diastolique, **vraies dates** et non des chaînes : sans cela Excel trie « 10 oct. » avant « 9 oct. » et aucune moyenne ni courbe n'est possible | ✅ Fait (v1.17.0) |
| 🐛 Les seuils du patient étaient ignorés | `statusOf` calculait l'alerte **sans** les seuils du dossier : régler le seuil d'un patient enlevait le rouge sur le chiffre et laissait sa carte en alerte. Le balayage a montré 17 appels dans le même cas — relève « RAS » et « DAR », filtre « événements », historique par mois. **Un réglage qui ne produit pas l'effet annoncé est pire qu'un réglage absent** | ✅ Corrigé (v1.19.0) |
| 🔕 Mettre une vigilance en sourdine | Un appui sur la valeur en alerte : d'abord la **portée** (ce relevé · cette patiente), puis la **trace** (écrire pourquoi, ou rien). Constante par constante — taire une tension attendue ne tait pas l'hypoglycémie du même passage | ✅ Fait (v1.19.0) |
| ⚖️ La sourdine éteint le signal, pas la donnée | *« Le soignant est capable d'interpréter sa valeur, c'est son travail. »* La valeur reste enregistrée et affichée, marquée 🔕 et soulignée en pointillés. **Rien n'est caché : ce qui change, c'est la couleur** — ce qui réconcilie la fonction avec la règle « un réglage d'affichage ne doit jamais cacher une alerte » | ✅ Fait (v1.19.0) |
| 🐛 Les saccades au défilement — **résolu** | Le décor du thème Réunion était en `background-attachment:fixed` : un fond fixe est **repeint** à chaque image au lieu d'être translaté. Il vit désormais dans une couche composite dédiée — même image, même cadrage. Mesuré dans le déroulé : **20,1 → 16,7 ms** de moyenne entre images, **39,3 → 19,3 ms** de pire cas, soit le niveau d'un thème sans décor | ✅ Corrigé (v1.18.0) |
| 🔍 Pourquoi seulement dans le déroulé | Hors déroulé, le flou de chaque carte promeut le décor en couches que le compositeur translate ; dans le déroulé il n'y a **qu'une carte**, donc pas de promotion, et le décor se repeint. **L'écran le plus simple était le seul privé de ce garde-fou involontaire** — et c'est son observation, pas une mesure, qui a désigné le lieu | ✅ Compris (v1.18.0) |
| ⚖️ Trois thèmes laissés intacts | `verre`, `tubes` et `hopital` ont le même défaut, mais le même traitement y déplace de vrais pixels (47 697 sur `verre`). **Un gain de fluidité ne vaut pas un thème qui change d'aspect sans qu'on l'ait demandé** | 🔜 Noté |
| ✏️ Ma mention en bas des feuilles domicile | Les **normes** y étaient d'office et sa mention ne pouvait que les remplacer, sans être gardée. Le pied ne porte désormais que **sa** mention — nom, cabinet, numéro, mot de saison — **commune aux trois feuilles**, proposée pré-remplie et modifiable à chaque tirage. *« Pour certaines périodes je vais modifier le nom ou le cabinet ou bien mettre un message d'actualités type joyeuses fêtes »* | ✅ Fait (v1.20.0) |
| 💾 Enregistrée au tirage, pas à la frappe | La mention retenue est celle qu'on **imprime** (aperçu, impression, partage), jamais celle qu'on tape. *Un champ à demi écrit puis abandonné ne doit pas devenir la proposition de la fois d'après* | ✅ Fait (v1.20.0) |
| 🔠 La taille du pied réglable | 7 pt était en dur — *« actuellement c'est écrit trop petit »* —, alors que la feuille finit sur un frigo, lue à bout de bras. Trois tailles (7 / 8,5 / **10** pt), **8,5 par défaut** | ✅ Fait (v1.20.0) |
| 📐 Une correction commandée par la mesure | Nombre de pages du PDF : à 8,1 mm de hauteur de ligne, une mention de **deux lignes** renvoyait la feuille serrée **au verso, à toutes les tailles** — ce qui ruine la seule chose qu'on lui demande. La ligne se resserre à **7,6 mm quand il y a un pied**, et seulement alors : jusqu'à **quatre lignes** tiennent sur une face. **Le tableau ne perd jamais de ligne** — les 31 jours sont là dans tous les cas, c'est la page qui déborde | ✅ Fait (v1.20.0) |
| 🖨️ Des feuilles et documents sans dossier | Il fallait ouvrir un patient pour sortir une feuille, alors qu'une feuille vierge sert justement **quand il n'y a pas encore de fiche**. Réglages → Mes outils → **Documents vierges** : les trois feuilles (nom et date de naissance à remplir à la main), le courrier, l'ordonnance, et les modèles et l'ordonnance de matériel quand les essais sont actifs. **Le même écran, pas un second chemin** | ✅ Fait (v1.20.0) |
| ⚖️ Seulement ce qui sert en vierge | *« La relève vierge ne sert pas. »* La relève et l'export des constantes restent hors de cette liste : sans patients et sans historique, ils n'ont rien à imprimer | ✅ Arbitré (v1.20.0) |
| 🎨 Deux thèmes de plus : Littoral et Bureau 2001 | **Littoral** : calcaire, terre cuite, ocre, olivier, et des titres en **plaques de rue émaillées** — la signalétique du Midi. **Bureau 2001** : barre de titre dégradée, panneaux beiges, boutons biseautés, barre des tâches | ✅ Fait (v1.24.0) |
| 🐛 « Vu » et « vigilance » sortaient de la même couleur | Premier jet de Littoral : `--accent` et `--danger` tous deux en terre cuite — sur le Moniteur, un patient vu et un patient en vigilance étaient **identiques**. L'olivier prend l'accent. **Aucun contraste ne rattrape ça** : les deux étaient parfaitement lisibles, et c'est bien le problème | ✅ Corrigé (v1.24.0) |
| 🗂 Les thèmes rangés par familles, avec vignettes | Mesuré avant de ranger : **onze thèmes sombres contre deux clairs**. Un classement clair/sombre aurait fait un groupe de deux et un groupe de onze. Quatre familles d'usage (Sobres · Reliefs · Décors · Rétro), une **vignette** par thème peinte avec ses propres jetons, et l'étiquette claire/sombre en information sur chaque ligne | ✅ Fait (v1.24.0) |
| 📊 Les colonnes de la feuille se composent | *« À la place de douleur, mettre poids, parce que chez cette personne, elle n'évalue pas la douleur. Et plutôt qu'avoir deux feuilles, tout mettre sur la même. »* La feuille de constantes se taille **patient par patient** : onze mesures au catalogue (TA, pouls, T°, sat, douleur, poids, glycémie, diurèse, selles, O₂, fréquence respiratoire), de une à **six** colonnes, dans l'ordre qu'on veut, plus une ou plusieurs **colonnes libres** | ✅ Fait (v1.25.0) |
| 📐 L'unité : choisie, libre, ou absente | Chaque mesure propose les unités qui ont un sens — TA en cmHg ou mmHg, glycémie en g/L, mmol/L ou mg/dL, douleur en /10, EVA ou EN — plus **sans unité** (l'en-tête tient sur un seul rang) et **la mienne…** en champ libre. *« Dans les unités de mesure, je veux avoir le choix quand cela est nécessaire »* | ✅ Fait (v1.25.0) |
| 🧹 Supprimer pour gagner en lisibilité | *« Histoire d'avoir de la place pour une meilleure lisibilité. »* La place rendue **élargit les cases de mesure**, pas seulement la colonne des observations — mesuré en pixels rendus sur une A4 : la case « Pouls » passe de **66 px à six mesures à 105 px à trois et 138 px à deux**. Les deux colonnes **fixes** sont facultatives elles aussi : ce sont les plus grosses (observations 36 %, initiales 12 %), et chez un patient où il passe seul, retirer les initiales rend plus de place que n'importe quelle mesure supprimée | ✅ Fait (v1.25.0) |
| 🛡️ Rien ne bouge chez qui n'a rien composé | Une fiche sans composition sort la feuille d'avant **mot pour mot** — largeurs 6/11/9/9/8/9/36/12, unité affichée sur la seule colonne de la douleur. C'est le contrôle le plus important de l'épreuve, et le seul qui passe sur les **deux** versions | ✅ Garanti (v1.25.0) |
| ⚖️ Seule la feuille des constantes se compose | Celle du poids a des **dates libres** et sa courbe, celle des glycémies **trois moments par jour sur deux rangs**. Les fondre ferait perdre ça : pour trois glycémies par jour, c'est toujours la feuille Glycémies. L'entrée n'apparaît que sur les constantes — la proposer ailleurs promettrait ce qui n'existe pas | ✅ Arbitré (v1.25.0) |
| 🔒 Un en-tête de colonne n'est que du papier | Ces feuilles sont des formulaires **remplis au stylo** : l'application n'en relit aucune valeur. Renommer une colonne ne touche ni aux seuils de vigilance, ni aux tendances, ni au classeur — **aucun risque qu'une valeur saisie passe pour une autre** | ✅ Arbitré (v1.25.0) |
| 📌 La barre du déroulé reste visible pendant la saisie | *« Lorsque je descends dans la page pour remplir les constantes, je dois remonter pour valider et passer au suivant. Si je remonte trop haut, j'atteins le sommet de l'application. »* Le bandeau **‹ Préc. · nom · Suiv. ·** ✓ **Valider** reste en haut de l'écran tout le temps du déroulé, et **se resserre** une fois collé : 131 px → **80 px, 9 % de l'écran**. Nom, compteur court, pastilles de progression et les trois actions sont conservés | ✅ Fait (v1.26.0) |
| 🐛 Une ligne de CSS tuait tous les éléments collés | La barre était **programmée collée depuis des mois** et ne l'avait jamais été : `overflow-x:hidden` était posé sur le `body` **en double** avec celui de `html`. Un `overflow` autre que `visible` fait du body un conteneur de défilement, et un élément collé se colle au bord du sien — or c'est `html` qui défile. Mesuré : **−71 px après 850 px de défilement**, soit sa position naturelle exacte | ✅ Corrigé (v1.26.0) |
| 📏 Une règle CSS n'est pas un comportement | Un contrôle « `.seq-nav` a bien `position:sticky` » serait resté **vert pendant tous les mois où la barre ne collait pas**. L'épreuve défile pour de bon et relève où la barre se trouve. *Et elle garde ce qui a été demandé — « reste visible en permanence » — pas `top:0` : tant que la barre n'a pas atteint le haut, elle est encore dans le flux et c'est très bien ainsi* | ✅ Arbitré (v1.26.0) |
| 🔁 Le déroulé liste des passages, plus des patients | *« Quand j'ai un deuxième passage pour un patient, ce dernier ne s'affiche pas dans le déroulé, mais uniquement sur la carte des patients. »* Mesuré : le plateau listait **4 passages** (`p1`, `p1#2`, `p2`, `p3`), le déroulé **3 patients**. Le déroulé passe désormais par la même fonction que le plateau — même liste, même ordre —, le compteur dit **« Passage 4 / 4 »**, et chaque rang porte sa pastille **1ᵉʳ / 2ᵉ passage** | ✅ Fait (v1.27.0) |
| 🧱 Il n'y avait rien à inventer, il y avait à brancher | Toute la machinerie du passage supplémentaire existait déjà et servait au plateau : les occurrences triées, le passage qui remplit un rang, le statut par rang, les pastilles. Le déroulé partait des **dossiers** et n'y avait jamais été branché. *Le premier contrôle de l'épreuve n'est pas un comptage mais une **égalité** entre les deux listes : c'est elle qui les empêchera de rediverger* | ✅ Arbitré (v1.27.0) |
| 🐛 Tout ce qui demandait « vu ? » au dossier | Le bouton de validation annonçait **« Passage enregistré — modifier » sur le 2ᵉ rang dès le 1ᵉʳ validé** — il invitait à modifier le passage du matin en croyant saisir celui du soir. Même défaut sur les pastilles, sur la garde de « pas de passage » et sur le drapeau lui-même, qui était rangé par dossier et aurait effacé les deux rangs d'un coup. **La clé du rang 1 reste l'identifiant nu : aucune donnée existante à migrer** | ✅ Corrigé (v1.27.0) |
| 📋 Le rappel du passage précédent | Sur un 2ᵉ passage, un bandeau en tête de formulaire donne **l'heure et le contenu du passage précédent** — soins, constantes, transmission. *Le soir, savoir ce qui a été fait le matin change ce qu'on écrit.* Déplié par défaut (**une information cachée derrière un geste n'est pas une information**), le pli est retenu. Dans le flux et non dans la barre collée : on le lit une fois en arrivant, il n'a pas à coûter de la hauteur pendant toute la saisie | ✅ Fait (v1.27.0) |
| 🐛 En vue Liste, les patients n'étaient pas cliquables | *« Si je mets liste, mon patient n'est pas cliquable et je peux pas ouvrir sa fiche. »* Mesuré, tournée à créneaux en **vue Journée** : **six lignes dessinées, zéro écoutée**. Le gestionnaire de clic était enfermé dans la branche du listing simple, alors que la vue Journée dessine ses lignes avec la même fonction. Remonté avec les autres gestes indépendants de la vue | ✅ Corrigé (v1.27.1) |
| 🔍 Un seul croisement était cassé | Sans créneaux, sur un créneau précis et en tournée « Toutes », la vue Liste répondait. **Seule la vue Journée ne répondait pas** — et le 📞 de la même ligne, lui, fonctionnait, ce qui faisait lire le défaut comme une panne de l'appareil. *L'épreuve balaie désormais les quatre croisements vue × tournée, pas seulement celui qui était cassé* | ✅ Arbitré (v1.27.1) |
| 💾 Le 💾 du haut enregistre, et on reste | *« En haut j'ai la petite disquette, mais si je clique dessus rien ne se passe. »* C'était un **témoin d'état** — un `span` de 21 × 33 px sans gestionnaire. Il devient un **bouton de 34 px** qui enregistre la fiche **sans la fermer**. Mesuré : le bouton « ✓ Enregistrer » du bas est à **1 765 px plus bas**, près de deux écrans de défilement | ✅ Fait (v1.28.0) |
| ⚖️ Pourquoi pas « exactement comme le bouton du bas » | Celui du bas n'enregistre pas seulement, **il ferme la fiche** : c'est la fin de la tâche. Toucher le 💾 au milieu du remplissage, c'est vouloir **sécuriser sa saisie et continuer** — refermer aurait rendu les 1 765 px pour les reperdre aussitôt. *La demande littérale n'était pas le besoin* | ✅ Arbitré (v1.28.0) |
| 🔕 Il n'appelle à l'action que quand il y a à faire | **« 💾 Enregistrer »** en plein accent tant qu'une modification attend, **« 💾 ✓ »** discret sinon. *Un bouton d'appel permanent qu'on touche pour rien neuf fois sur dix apprend à être ignoré — et le jour où il compte, il l'est aussi.* Ailleurs dans l'app, où les écrans écrivent au fur et à mesure, le 💾 reste un simple témoin et son `cursor:pointer` trompeur a été retiré | ✅ Arbitré (v1.28.0) |
| 🐛 Une carte avec saisie gardée cassait son affichage | *« Parfois sur une carte patient, si je clique dessus l'affichage bug. »* L'étiquette **💾 saisie gardée** était un `<button>` posé **dans** le `<button>` de la carte : l'analyseur HTML referme le bouton extérieur, et tout ce qui suit change de parent — **le formulaire sortait de la carte**. Mesuré : 1 779 px et un formulaire sans brouillon, **189 px et aucun formulaire** avec | ✅ Corrigé (v1.28.1) |
| 📎 La leçon était déjà écrite vingt lignes plus bas | Le même fichier portait déjà l'avertissement, pour le 📞 et le 📍 : *« un bouton dans un bouton n'est pas du HTML valide, et sur Android le toucher partait au mauvais des deux »*. **Un commentaire ne protège que la ligne qu'il garde** — d'où une épreuve qui compare la forme de la carte dans onze états | ✅ Arbitré (v1.28.1) |
| ⚖️ Ni logo ni fond d'écran d'origine | Le thème Bureau 2001 ne reprend **aucun bien de Microsoft** : tout est redessiné, la cigale tient le rôle du logo. Et **pas de faux boutons de fenêtre** malgré la maquette validée — *un ✕ décoratif, dans une app de soins, finit par être touché par quelqu'un qui croit fermer quelque chose* | ✅ Arbitré (v1.24.0) |
| 🧪 Une épreuve qui ne voyait pas la moitié de ce qu'elle gardait | `pw_themes` portait sa liste de neuf thèmes **en dur** : les deux nouveaux n'y entraient pas et elle passait au vert sans les regarder. Elle lit désormais le catalogue de l'application | ✅ Corrigé (v1.24.0) |
| ↩︎ Le déroulé reprend où l'on s'est arrêté | Mesuré : arrêté sur le 4ᵉ patient on revenait sur le 1ᵉʳ, et les trois premiers validés, arrêté sur le 5ᵉ, on revenait sur le 4ᵉ. La position est retenue — **datée, créneautée, rattachée à la tournée** — et un **ruban de reprise** dit combien de non-vus restent derrière, avec un bouton pour y aller | ✅ Corrigé (v1.23.0) |
| ⚠️ « Pas de passage » sur un patient déjà vu | Aucun avertissement, et un message **faux** : « non inclus dans la relève » alors que le passage existant y figure. Une question se pose désormais, rappelle l'heure et les constantes du passage, et propose **de le corriger** — l'intention réelle neuf fois sur dix. *On n'empêche pas : on dit ce qu'on est sur le point d'écrire* | ✅ Fait (v1.23.0) |
| ↩︎ Les trois dernières actions, annulables | Il n'existait qu'un lien de **six secondes**, et seulement sur un passage neuf : *on se trompe au chevet et on s'en aperçoit en rangeant son matériel*. Validation, correction, fusion et « pas de passage » entrent au journal du jour avec **une copie de l'état d'avant**. L'écran **nomme ce vers quoi on revient**, jamais « voulez-vous annuler » | ✅ Fait (v1.23.0) |
| 🔄 Annuler est une écriture comme une autre | L'annulation passe par `logChange` et **part à la synchro** : sans ça, le collègue garderait la version fausse et la renverrait à la fusion suivante | ✅ Fait (v1.23.0) |
| 🐛 Quitter une fiche patient effaçait tout, sans un mot | Mesuré : ajouter un médecin, allumer « Aussi au cabinet », quitter par la **flèche retour** → rien de demandé, **tout perdu**. Seul « ✓ Enregistrer » écrivait, alors qu'au pouce la flèche est le geste naturel. C'est ce qui faisait croire que l'inscription au cabinet ne marchait pas : **elle n'avait jamais eu lieu** | ✅ Corrigé (v1.23.0) |
| 🏥 Le médecin partait dans le mauvais cabinet | Patient du cabinet A, cabinet B ouvert → le correspondant atterrissait dans **B**. Même famille que « un document pour un patient du Cabinet A sortait à l'en-tête du B », corrigée là-bas et restée ici | ✅ Corrigé (v1.23.0) |
| 📱 L'heure du téléphone se posait sur le bandeau | La règle qui réserve la place de la barre d'état **existait**, enfermée dans `@media (display-mode: standalone)` — le mode « installé ». Mesuré : l'application Android est en mode **browser**, la règle n'était jamais appliquée. Elle est désormais posée sans condition, par une variable `--sbtop` que **tout le haut de l'application lit** | ✅ Corrigé (v1.22.0) |
| 🔍 Une correction locale à un défaut global laisse le défaut | L'écran du jeu appliquait déjà ce retrait sans condition, avec le commentaire « *sans lui, l'heure d'Android se posait sur le titre du jeu* ». **Corrigé là où ça se voyait, jamais ailleurs** | ✅ Méthode (v1.22.0) |
| 📏 Le téléphone ne déclare pas toujours son encoche | `env(safe-area-inset-top)` peut valoir 0 malgré `viewport-fit=cover`, et c'est invérifiable depuis une autre machine. Réglage **Automatique · Aucune · 24 · 32 · 40 · 52 px**, avec **la valeur réellement déclarée affichée à côté** : sans ce chiffre, choisir serait tâtonner | ✅ Fait (v1.22.0) |
| 🦗 Le filigrane des documents | La cigale et « JM@Santé by JmCve83 » en fond de page, **permanents sur les trois feuilles de domicile** — c'est ce qui les identifie quand elles traînent un mois sur un frigo — et **un seul interrupteur** pour tous les autres documents. Fond à 22 % + signature dans la ligne du pied | ✅ Fait (v1.21.0) |
| 📐 Un fond CSS ne sort pas de l'imprimante | Mesuré : même feuille, même PDF, sans cocher « imprimer les arrière-plans » (décoché par défaut partout) — **0 pixel** quand la marque est une `background-image`, la marque entière quand c'est un `<svg>` dans la page. **Écrite en fond, elle se serait vue à l'écran et le papier serait sorti vierge** | ✅ Mesuré (v1.21.0) |
| 👁 7 % d'opacité, c'est invisible sur du papier | La première planche reprenait les 7 % de la cigale de l'écran d'accueil : *« c'est la seule pour laquelle je vois le filigrane »* — il n'avait pas choisi une variante, il avait choisi **la seule qu'il voyait**. Mesuré au contraste : 7 % → 1,12:1, 22 % → 1,45:1. **Une valeur d'écran rétroéclairé posée sur du papier n'est pas la même valeur** | ✅ Corrigé (v1.21.0) |
| 🦓 Le zébrage ne s'imprimait pas — et découpait la cigale | Les lignes paires sont un fond : jamais imprimées par défaut, et repeintes en **blanc opaque** par-dessus le filigrane (256 lignes sur 404 sans marque, mesurées). Remplacé par un **filet plus marqué tous les cinq jours** : un trait est une bordure, il sort toujours | ✅ Corrigé (v1.21.0) |
| ⚖️ Ce n'est pas une marque de sécurité | Le filigrane n'authentifie rien et ne prouve rien — c'est de l'identité visuelle. **L'écran de réglage le dit**, parce que sur une ordonnance une marque de fond peut être prise pour autre chose | ✅ Arbitré (v1.21.0) |
| 🧪 Un rapiéçage d'épreuve qui dormait hors du dépôt | `_test_draft.js` plantait sur « CSS is not defined » — jsdom n'a pas `CSS.escape`, dont la reprise d'une saisie gardée se sert. Le correctif vivait dans une **copie locale** du dossier d'exécution : invisible au dépôt, et **perdu au premier recopiage**. Il est désormais dans l'épreuve | ✅ Corrigé (v1.20.0) |
| 🧪 Comparer deux images sans connaître leur bruit | L'écart avant/après valait 15 à 22 pixels — mais deux captures du **même** code en diffèrent déjà de 120, les pastilles d'alerte clignotant. `cosmos` a même été soupçonné à tort pour son semis d'étoiles. **Mesurer d'abord ce qu'une image bouge toute seule** | ✅ Méthode (v1.18.0) |
| 💾 Aucune saisie ne se perd en quittant un écran | *« Pour ne pas perdre de données, devoir tout refaire une saisie. »* Un filet posé dans `openSheet`, donc sur **tous** les panneaux : la saisie est gardée 700 ms après la dernière touche, et à la réouverture une étiquette **« saisie gardée »** propose *Reprendre* ou *Jeter*. Toucher le bouton principal la consomme ; au-delà de **7 jours**, purgée. Mesuré : **16 écrans sur 16** gardent leur saisie | ✅ Fait (v1.29.0) |
| 🧪 Le rapport précédent se trompait sur le nombre | Il annonçait **quatre** écrans et citait **« ma fiche »**. Mesure refaite : **seize** écrans, « ma fiche » n'en fait pas partie (elle écrit au fil), et le **bloc-notes** avait été manqué. Cause : la sonde regardait un panneau **déjà fermé** au lieu de rouvrir l'écran. *Une mesure qui ne voit pas ce qu'elle mesure ne dit rien* | ✅ Corrigé (v1.29.0) |
| ⚠️ Le filet lui-même corrompait la saisie | `brouillonForcer()` tournait **après** le remplacement du panneau : il écrivait les champs du **nouvel** écran sous la clé de l'**ancien**. L'étiquette s'affichait et ne restaurait rien. *Une perte déguisée en filet est pire qu'une perte franche : elle rassure.* L'épreuve garde désormais l'**ordre d'écriture** lui-même | ✅ Corrigé (v1.29.0) |
| 📝 Les écrans en liste aussi | Deux écrans restaient hors du filet, leurs champs étant repérés par `data-*` et non par identifiant : l'**aide-mémoire** (17 champs) et l'**en-tête d'ordonnance** (8). Du texte long, écrit à la main — la saisie dont la perte coûte le plus cher | ✅ Fait (v1.29.0) |
| ⚠️ Une pièce jointe pouvait être détruite en silence | La migration des documents écrivait le contenu en base annexe puis le supprimait du dossier **sur la ligne suivante**, sans attendre. Échec (place épuisée, base indisponible) ⇒ photo de plaie ou ordonnance scannée **détruite sans trace**, à chaque démarrage. Désormais : échec ⇒ le contenu **reste** dans le dossier, la tentative est reprise | ✅ Corrigé (v1.29.0) |
| 🔄 Un document reçu sans son contenu | À la synchro, `try { idbSet(...) } catch {}` **n'attrapait rien** (promesse) : le dossier gagnait une ligne « Ordonnance reçue » qui ne s'ouvre pas. La ligne n'est ajoutée qu'une fois l'écriture confirmée | ✅ Corrigé (v1.29.0) |
| 🔇 Le partage de synchro s'arrêtait sans un mot | Le seul `JSON.parse` du code sans aucun filet, dans une fonction `async` : l'exception ne remontait nulle part et l'on croyait son fichier envoyé | ✅ Corrigé (v1.29.0) |
| 🧪 Les analyseurs se trompaient aussi | Le détecteur des parses nus en annonçait **2** et en blanchissait **26** à tort. Celui des échecs avalés signalait sa **propre documentation**, et mélangeait **30** alertes dont **2** seulement faisaient perdre du travail — noyées, elles sont restées des mois. Scindés ; chaque détecteur est maintenant **éprouvé par un défaut planté exprès** | ✅ Corrigé (v1.29.0) |
| 🧪 Six contrôles d'épreuve mentaient, l'app avait raison | Quatre lisaient un **objet d'état périmé** (la reprise par code de secours recharge le dossier et remplace l'objet) ; un exigeait **11 tuiles** quand le menu en pose 14 ; un réclamait un champ « À prévenir » devenu une **marque** posable sur plusieurs contacts. *Garder le besoin, pas la mise en page* | ✅ Corrigé (v1.29.0) |
| ⚡ ~~La fluidité : ouvrir une carte ne doit pas redessiner le plateau~~ — **fait en v1.32.0**, et le modèle de cette ligne était faux : le coût n'était pas dans les 39 autres cartes | Mesuré : trier 40 patients coûte **17 ms**, mais ouvrir **une** carte reconstruit tout le plateau — **121 à 260 ms** sur un processeur ralenti six fois. Visé : **moins de 40 ms**, sans retirer une fonction ni simplifier un affichage | ✅ Fait (v1.32.0) |
| 🧹 ~~Le ménage du code~~ — **traité autrement en v1.31.0** : inventorié plutôt que supprimé (retirer du code casse la compilation dans ce projet), et les compteurs sont redevenus lisibles | **16** références à des boutons disparus, **28** fonctions que personne n'appelle, **42** écritures en mémoire à relire. Aucun effet visible : l'intérêt est de réduire la place où le prochain défaut peut se cacher | ✅ Arbitré (v1.31.0) |
| 🔒 Le brouillon d'un patient ne se propose jamais chez un autre | Les identifiants de champs sont les **mêmes pour tous les dossiers** : l'empreinte d'écran qui sert de clé l'était aussi. Mesuré : les **neuf** écrans liés à un dossier proposaient le brouillon d'un patient chez un autre — **texte repris**, avec son nom et sa date de naissance. Une donnée d'un dossier qui apparaît dans un autre, pas un simple affichage de travers | ✅ Corrigé (v1.29.0) |
| ⚠️ Le mécanisme prévu pour l'empêcher n'était appelé par personne | `sheetBrouillonPour` attendait dans le code, documenté, branché sur rien. *Une fonction morte dont la mort **est** le défaut* — ce qui change la lecture des 28 fonctions mortes du Lot 3 : ce n'est plus seulement du ménage | ✅ Corrigé (v1.29.0) |
| ⚖️ Le dossier est porté par le panneau, pas par un appel à l'ouverture | Plusieurs de ces écrans se **redessinent à chaque frappe** : un marqueur consommé une seule fois se serait perdu au premier redessin, et la clé aurait changé **en pleine saisie**. Porté par le DOM, il survit à tous les redessins | ✅ Arbitré (v1.29.0) |
| 🧹 22 panneaux cloisonnés, pas 9 | Les treize autres ne fuyaient pas *dans les conditions mesurées*. Les marquer fait disparaître **la classe entière** plutôt que les cas observés | ✅ Fait (v1.29.0) |
| 🔑 L'axe n'est pas toujours le patient | Pour « modifier un modèle de document », c'est le **modèle** : le brouillon du modèle A se proposait en modifiant le modèle B. Même défaut, autre axe. Et son brouillon doit au contraire **revenir** quel que soit le patient d'où l'on vient — vérifié dans les deux sens | ✅ Corrigé (v1.29.0) |
| 🧪 Un détecteur pour le vingt-troisième panneau | Celui qui sera écrit demain et qui oubliera le marqueur : un panneau qui va chercher un patient, ouvre un gabarit **et contient un champ** doit le poser. Resserré deux fois — il signalait d'abord des panneaux qui ne font que **lire** un dossier : *du bruit qui aurait fini par faire ignorer les vrais* | ✅ Fait (v1.29.0) |
| 💾 Le 💾 n'apparaît que s'il a un état à montrer | *« Sur cet écran la disquette en haut à droite ne fonctionne pas. »* Elle n'était pas en panne : **Réglages est un menu**, rien n'y est jamais enregistré. Mesuré : le 💾 posé sur **88 panneaux**, actif sur **un**, et **38** panneaux sans le moindre champ. Il ne s'affiche désormais que si un enregistrement est déclaré ou si le panneau a au moins un champ | ✅ Fait (v1.30.0) |
| ⚠️ Et il mentait, au pire moment | Sur « médicament perso » et « contact du cabinet », **formulaire rempli mais pas enregistré**, il affichait **« 💾 ✓ — Enregistré sur l'appareil »** : il répondait sur l'état du **dossier**, pas de l'**écran**, et rassurait quand une saisie pouvait se perdre. Il dit maintenant « 💾 Enregistrer » dès qu'un champ a changé depuis l'ouverture | ✅ Corrigé (v1.30.0) |
| ⚖️ Pourquoi pas une cigale ou une étoile à la place | Un ornement aurait pris **la place d'un indicateur** : l'œil apprend que ce coin ne dit rien, et deux écrans plus loin, en pleine saisie, le 💾 est le **seul** à dire « c'est passé » — le témoin du titre étant recouvert par le voile. *Décorer les menus aurait abîmé l'indicateur ailleurs* | ✅ Arbitré (v1.30.0) |
| 🦗 La cigale est déjà sur cet écran | Elle est l'**emblème de Réglages** (« Tout est dans la cigale »), à trois centimètres sous la barre — et 🦗 veut dire Détente et les surprises cachées : le premier réflexe aurait été de la toucher. L'étoile, elle, allait avec le thème « Croix du Sud » et se serait retrouvée dépareillée sur les quatorze autres | ✅ Arbitré (v1.30.0) |
| 🔌 Le 💾 reprend le bouton du bas, sur 14 écrans | Le mécanisme existait depuis la v1.28.0 et n'avait servi **qu'une fois**. Branché par reconnaissance du bouton, pas écran par écran : marquer les quatorze à la main, c'est laisser passer le quinzième | ✅ Fait (v1.30.0) |
| ⚠️ On reconnaît le bouton, on ne le devine pas | Sans filtre sur le libellé, le 💾 de l'écran d'ordonnance aurait repris **« Produire le document »** — un document produit par surprise. Deux écrans restent volontairement non branchés : *l'ambiguïté se signale en ne branchant rien plutôt qu'en choisissant au hasard* | ✅ Arbitré (v1.30.0) |
| 📝 « Sans fermer » n'est vrai que si l'écran le promet | Plusieurs de ces boutons enchaînent sur un autre panneau. L'infobulle dit « Enregistrer », pas « Enregistrer sans fermer » | ✅ Corrigé (v1.30.0) |
| 🔍 Un champ de recherche n'est pas une saisie | Attrapé par la batterie : on tape « tahor » pour **filtrer** le catalogue des médicaments, et le 💾 réclamait un enregistrement — le terme partait même en brouillon, pour être reproposé la fois suivante. Les champs de recherche sont écartés du compte comme des brouillons | ✅ Corrigé (v1.30.0) |
| 🎗️ Reprendre une prise en charge | On clôturait et on ne rouvrait **jamais** : la liste n'offrait que « Ouvrir » et « Supprimer définitivement ». Un patient qui revenait après une interruption devait être **recréé**. La fonction existait, avec sa confirmation, et personne ne l'appelait | ✅ Fait (v1.31.0) |
| 🎙 Effacer une note vocale | Le réglage proposait **« à la main »**, qui coupe la purge automatique — et aucune main n'existait : ni liste, ni bouton. Des enregistrements sur des patients, sur l'appareil, **sans issue**. La liste donne date, durée, poids, ▶ et 🗑, plus « Tout effacer maintenant » | ✅ Fait (v1.31.0) |
| 📋 Le bilan de tournée a une porte | 58 lignes — patients vus **et non vus**, alertes, rappels dus, bilans à faire — appelées de nulle part. Posé au bout du déroulé, sur « Tournée terminée » : le moment où l'on vient de finir. *Pas dans les réglages, où l'on ne passe pas en tournée* | ✅ Arbitré (v1.31.0) |
| ⏱ Une temporisation n'est pas un fait | L'export d'une sauvegarde changeait d'écran **900 ms** après l'appel — or il commence par poser une question. Mesuré : à 1 200 ms la question était toujours là et le panneau était déjà passé de « Mes données » à « Réglages ». On lisait l'avertissement sur la confidentialité **pendant que l'app partait ailleurs** | ✅ Corrigé (v1.31.0) |
| 🔇 Et l'échec de l'export ne se disait nulle part | On arrivait sur Réglages comme si tout allait bien. La navigation attend désormais que l'export ait abouti, l'échec s'annonce, et **annulé, on reste où l'on est** | ✅ Corrigé (v1.31.0) |
| 🧪 Rendre les compteurs lisibles vaut mieux que supprimer | Cinq détecteurs dégraissés : 28 fonctions mortes, 16 identifiants fantômes, 9 appels introuvables (**9 faux sur 9**), 3 `data-*` muets et 69 appels asynchrones → **0, 0, 0, 0 et 22**. C'est ce dégraissage qui a fait apparaître les trois fonctions sans porte | ✅ Fait (v1.31.0) |
| ⚖️ Le code mort est inventorié, pas supprimé | Deux tentatives, deux compilations cassées : le module finit par le mot-clé `function` qui complète le suivant, et la découpe se trompe dès qu'un gabarit contient une accolade fermante en début de ligne — `sheetWelcome` coupée à 32 lignes sur 112, **la compilation passant quand même**. 184 lignes sur 34 000 ne valaient pas ce risque | ✅ Arbitré (v1.31.0) |
| 🐛 ~~Plus moyen de faire réapparaître les bulles d'aide~~ — **corrigé en v1.32.0** | `aides-reset` ne correspond à aucun bouton existant : une fois une aide masquée, elle ne revient pas | ✅ Fait (v1.32.0) |
| ⚡ Ouvrir une carte n'en refait plus quarante | Mesuré : **0 carte conservée sur 40**, 31 ms de fabrication, 117 ms de mise en page. Seules les deux cartes qui changent sont refaites ; le dessin complet reste la vérité et reprend la main dès que le partiel n'est pas sûr | ✅ Fait (v1.32.0) |
| 📐 Le modèle de l'audit était faux | Le rapport annonçait « 121 à 260 ms → moins de 40 ms en ne reconstruisant plus le plateau ». Le coût n'est **pas** dans les 39 autres cartes : il est dans la mise en page de la **carte ouverte** — 1 881 px, 14 champs. Gain réel : **140 → 121 ms** | ✅ Corrigé (v1.32.0) |
| 🧪 Ce qu'on garde, c'est l'égalité, pas la vitesse | L'épreuve compare **caractère par caractère** le plateau obtenu par le chemin partiel et par le chemin complet. *Un dessin partiel qui irait vite en oubliant un coin de l'écran serait pire que le dessin complet qu'il remplace* | ✅ Fait (v1.32.0) |
| 🔍 Trois mesures ont menti avant de dire vrai | Un clone du patient de démo ne mesure rien (28 000 caractères de plateau) · `openId = x; render()` n'ouvre pas la carte comme un appui · le chronomètre contenait sa propre remise à zéro, soit un dessin complet de chaque côté | ✅ Corrigé (v1.32.0) |
| 💾 La réponse du navigateur sur le stockage durable | `navigator.storage.persist()` rend un booléen qui était **jeté** : un refus veut dire que le navigateur peut effacer le dossier s'il manque de place. L'état se lit maintenant dans « Santé de l'application » | ✅ Corrigé (v1.32.0) |
| 💡 Les aides masquées peuvent revenir | `aides-reset` existait, son bouton avait disparu avec un ancien écran d'affichage — comme `dotpick` et `monpick`, du même groupe orphelin. Reposé dans Réglages › Application, et **seulement s'il y a des aides à rappeler** | ✅ Corrigé (v1.32.0) |
| ⚖️ On s'arrête là sur la fluidité | Les ~120 ms restants sont la carte ouverte elle-même, et ils sont mesurés sur un processeur **ralenti six fois** — soit 20 à 40 ms sur l'appareil réel, sous le seuil où un geste se sent. Les gagner coûterait **un appui de plus sur le geste le plus fréquent de la journée**. *On optimise ce qui coûte sans rien enlever ; au-delà, c'est l'app qu'on change, et elle va bien* | ✅ Arbitré (v1.32.0) |
| 🧪 Le dessin partiel a cassé 46 contrôles avant de passer | `CSS.escape` n'existe pas dans jsdom : le geste d'ouverture levait une exception et la carte ne s'ouvrait plus. La batterie l'a vu à la minute où le défaut est né | ✅ Corrigé (v1.32.0) |
| ✍️ **Signer une ordonnance envoyée en numérique** | Signature tracée une fois dans **Ma fiche** et apposée dans le cadre du bas quand l'interrupteur « Apposer ma signature » est coché. Le pavé de tracé existait (écran de relève) et le cadre existait : ils ne se parlaient pas | ✅ Fait (v1.33.0) |
| ⚖️ Décoché par défaut, même quand une signature existe | L'ordonnance qu'on imprime reste le cas courant, et apposer une signature est un acte : il se demande, il ne s'impose pas | ✅ Arbitré (v1.33.0) |
| 📄 Le papier ne doit pas affirmer le faux | Signé, le cadre perd le mot « MANUSCRITE », la date se remplit, et le nom lisible vient sous le tracé — *un paraphe seul n'identifie personne*. Le mot « originale » est retiré du pied de page, parce qu'un fichier qu'on envoie peut être réimprimé dix fois. L'app ne dit jamais ce qui est réglementaire, mais elle n'écrit pas le contraire | ✅ Arbitré (v1.33.0) |
| 🔐 La signature ne voyage pas | Rangée sous `doc_masignature` : chiffrée par le coffre comme tout `doc_*`, et **absente des sauvegardes**. Sur un appareil neuf, on la retrace une fois | ✅ Fait (v1.33.0) |
| 🐛 **L'écran de recherche ne s'ouvrait plus** | `sheetSearch()` ne reçoit aucun argument, et le cloisonnement des brouillons (v1.29.0) y avait posé `brDossier(pid)` par ressemblance avec les 22 panneaux de dossier : `ReferenceError`, écran mort. **Livré ainsi en v1.29.0, v1.30.0, v1.31.0 et v1.32.0** | ✅ Corrigé (v1.33.0) |
| 🧪 L'épreuve le voyait et mourait de ce défaut même | `pw_search` levait l'erreur au lieu de la rapporter, et deux suites statiques qui ouvrent tous les écrans plantaient avec elle. *Une garde qui explose ne garde rien* : les trois sont désormais au vert | ✅ Corrigé (v1.33.0) |
| 🧪 Treize suites criaient faux depuis des mois | Dix exigeaient une **suite de modules contiguë** dans `build.js`, coupée par trois modules ajoutés depuis · une bannissait `window.open` partout dans le cabinet et accusait les trois ouvertures du GPS (`"_system"`, le motif correct) · une gardait la **temporisation de 900 ms** retirée en v1.32.0 parce qu'elle faisait quitter l'écran pendant que la question de partage était encore posée. *Un détecteur qui crie pour rien n'est plus lu — et c'est ainsi qu'un vrai défaut se cache* | ✅ Corrigé (v1.33.0) |
| 🧪 Cinq contrôles du déroulé étaient morts sans le dire | `seqPool[i]` n'est pas un patient mais `{p, rang, cle, multi}` : la sonde lisait `.id` sur l'enveloppe et mourait sur `getP(undefined)`. Le bouton du haut — crée un passage, le dit, ne le double pas — n'était plus gardé | ✅ Corrigé (v1.33.0) |
| 🐛 Deux défauts attrapés par la seule mesure | `const sa` déclaré **après** le bloc qui s'en sert : zone morte temporelle, `ReferenceError` garantie dès qu'on signe, et la compilation ne proteste pas · `fmtFR()` rendait « 25 oct. », **sans année** : lisible dans une liste, inacceptable sur un document médico-légal | ✅ Corrigé (v1.33.0) |
| 📅 **Feuilles de domicile calées sur le calendrier** | Interrupteur « Caler sur un mois réel » : le jour en deux lettres après la date (`1 Di`), le filet entre **dimanche et lundi**, le mois imprimé en en-tête, et 28/29/30/31 lignes selon le mois. Les trois feuilles — constantes, glycémies, poids | ✅ Fait (v1.34.0) |
| ⚖️ La feuille vierge reste à côté | Coché depuis une fiche patient (on imprime pour quelqu'un, aujourd'hui), décoché depuis Documents vierges (on prépare la sacoche, et une feuille de sacoche ne connaît pas son mois). Six sorties comparées caractère par caractère : le papier générique est **identique** à celui de la v1.33.0 | ✅ Arbitré (v1.34.0) |
| 📐 Aucune colonne resserrée | Mesuré avant d'écrire : colonne du jour 11,62 mm, « 31 Me » 8,63 mm en serré et 10,52 mm en confortable. La place était déjà là, et la feuille serrée tient toujours sur **une face** avec quatre lignes de mention | ✅ Mesuré (v1.34.0) |
| 🚫 Le week-end n'est pas un fond | La maquette le proposait teinté ; le code portait déjà la mesure qui l'interdit — « imprimer les arrière-plans » est décoché par défaut (un fond ne s'imprime pas), et le zébrage **découpait le filigrane** (256 lignes sur 404 sans trace de cigale). Marqué dans les **lettres**, qui s'impriment toujours | ✅ Arbitré (v1.34.0) |
| 🚫 Pas de calendrier mural | La première semaine n'est pas complétée avec la fin du mois précédent : une case pour le 31 octobre sur la feuille de novembre est une case qu'on remplit par erreur. Novembre 2026 commence un dimanche, donc son premier bloc fait **un jour** — c'est ce que dit le calendrier | ✅ Arbitré (v1.34.0) |
| 🧪 1 461 jours recalculés | L'épreuve recalcule chaque abréviation contre `Date` sur 48 mois, février bissextile et non, 2100 qui ne l'est pas, et les deux changements d'heure jour par jour. *Une feuille décalée d'un jour est pire qu'une feuille sans jours du tout* | ✅ Fait (v1.34.0) |
| 🔍 Et trois fois ma mesure a menti | Géométrie mesurée dans la fenêtre du téléphone (92,5 mm au lieu de 194) · le contrôle de la coupe vérifiait que les lignes 15 et 16 existent, pas où tombe la coupure — un défaut planté l'a montré · et la sonde plantait au lieu de rapporter | ✅ Corrigé (v1.34.0) |
| 🔴 **L'app ne recevait plus aucune mise à jour** | Le nom du cache du service worker était écrit **en dur** (`jmsante-v215`) et n'avait pas bougé depuis des dizaines de versions — la purge des vieux caches ne se déclenche que si le nom change. Et la lecture ignorait le marqueur `?v=` pendant que l'écriture le gardait : le nouveau code était téléchargé, rangé sous une clé jamais lue. **L'enveloppe se mettait à jour, le code jamais.** Mesuré : quatre rechargements après une livraison, toujours l'ancien code | ✅ Corrigé (v1.35.0) |
| 🔒 Le numéro de version stampé, plus recopié | `build.js` écrit le nom du cache depuis `package.json` à chaque compilation, comme il le fait déjà pour `index.html`. La compilation **refuse** un `sw.js` qui ne se parse pas ou dont le cache ne porte pas la version | ✅ Fait (v1.35.0) |
| 📶 Le hors ligne reste la raison d'être du cache | Une correction qui livrerait les nouveautés en cassant la tournée serait pire que le défaut qu'elle répare : l'épreuve coupe le réseau et exige que l'app s'ouvre, avec le nouveau code | ✅ Mesuré (v1.35.0) |
| 🔴 **Deux fonctions différentes, un seul nom** | Les 42 modules sont collés bout à bout : la **dernière déclaration gagne en silence**. `ficheHtml` existait dans fiche.js ET bilans.js — produire la fiche d'un patient sortait le cadre d'un bilan, **sans aucune donnée du patient**. `sheetBilans` existait dans sheets.js ET bilans.js — le bouton 🧪 d'un patient ouvrait le guide des tubes, et l'écran du patient était inatteignable. Plus cinq raccourcis redéclarés qui n'avaient jamais tourné | ✅ Corrigé (v1.35.0) |
| 🧪 Un détecteur sur les noms redéclarés | Il lit l'ordre de `ORDER_DEV`, puisque c'est lui qui décide du gagnant, et nomme le module qui l'emporte | ✅ Fait (v1.35.0) |
| 🐛 **Quatre lignes du mode liste ne menaient nulle part** | Sauvegarde, Journal des envois, Conservation des données, Mes modèles : leurs clés ne correspondaient à aucune destination et tombaient sur `default`, **qui rouvrait les Réglages** — à l'œil, rien ne se passe. Les 19 gestes du mode tuiles étaient tous branchés : le défaut ne se voyait que dans l'autre présentation | ✅ Corrigé (v1.35.0) |
| ⚖️ Un geste qui ne mène nulle part ne doit pas avoir l'air de marcher | `default` journalise, prévient à l'écran, et ramène à un écran connu au lieu de faire semblant | ✅ Arbitré (v1.35.0) |
| 🧪 Les 51 gestes réellement touchés | L'épreuve ouvre les Réglages dans **les deux présentations**, déclenche chaque geste et vérifie qu'on a quitté l'écran. Elle répond **non** à toutes les confirmations et vérifie à la fin que les dossiers sont toujours là | ✅ Fait (v1.35.0) |
| 🔍 Et cinq fois ma mesure a menti | Mon correctif a rendu `sw.js` impossible à parser, et la compilation ne regardait que app.js · une pause fixe lisait le service worker encore « activating » · « un seul cache » était vrai au milieu de la purge · `closeSheet()` ne vide pas le panneau, il décroche le voile · le balayage sans les essais ouverts ratait 4 tuiles et 5 lignes | ✅ Corrigé (v1.35.0) |
| ✨ **Points d'attention dans l'historique** | Filet et fond sur les passages qui portent quelque chose, **deux niveaux** — vert pour ce qui est écrit, rouge pour un seuil franchi — et une pastille qui dit **pourquoi** (transmission, note perso, hors plan, DAR, constantes, alerte). Compteur « à voir » sur l'en-tête du mois et filtre dédié | ✅ Fait (v1.36.0) |
| 🔗 La règle est celle de la relève | `histPoints()` s'appuie sur `noteUtile()`, `comRemonte()` et `alertes()` — les fonctions du moteur de relève. Ce qui s'allume dans l'historique est donc **exactement ce qui partira dans la relève** : le relire devient un aperçu de ce qu'on va envoyer | ✅ Arbitré (v1.36.0) |
| 🧹 **Le texte automatique n'est plus une note** | « Soins conformes au plan habituel. » est écrit par l'application, pas par l'IDEL : affiché dans le même style qu'une vraie transmission, il rendait les deux indiscernables et occupait la place de celle qui parle | ✅ Corrigé (v1.36.0) |
| 📐 Les soins du plan se replient | « Plan habituel · 4 soins », l'écart seul détaillé. Mesuré sur un vrai dossier : quatre lignes de gris identiques matin et soir, tous les jours — une surbrillance posée là-dessus aurait éclairé un mur. Un bouton **déplier** rend la liste entière : *rien n'est caché sans porte de retour* | ✅ Fait (v1.36.0) |
| ⚖️ L'alerte passe devant, et la note perso s'allume | Un passage avec une note **et** une TA élevée se lit rouge. Un commentaire décoché pour la relève s'allume quand même, sous « note perso » : l'historique est l'outil de relecture de l'IDEL, pas un document transmis | ✅ Arbitré (v1.36.0) |
| 💩 **Suivi des selles dans les courbes** | Une **bande de jours**, pas une courbe : six semaines, une par ligne, lundi à gauche, cases de 44 px. En tête, les jours sans selle — ou le dernier relevé quand le compteur vaut zéro | ✅ Fait (v1.36.0) |
| 🚫 Pourquoi pas une courbe | Relier deux relevés **inventerait** les jours entre eux · « 0 » (relevé fait, rien ce jour-là) n'est pas l'absence de relevé, et une courbe les écrase sur la même ligne · la diarrhée est un **état**, pas un degré de plus sur l'axe | ✅ Arbitré (v1.36.0) |
| 🎨 La rampe est calculée, puis construite par mélange | Palette **validée par script** — rampe monotone, écarts perceptibles, diarrhée distincte du vert même en vision déficiente. Mais aucune couleur écrite en dur : cinq mélanges de `--accent` vers `--inset`, la diarrhée en `--amber`. La progression tient dans les **six thèmes** | ✅ Mesuré (v1.36.0) |
| 🧪 Le contrôle qui compte | Un jour non renseigné reste `null`, **jamais `"0"`** : tout le compteur de jours sans selle repose sur cette distinction, et c'est la seule chose qu'une courbe aurait rendue impossible à montrer | ✅ Fait (v1.36.0) |
