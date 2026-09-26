# JM@Santé — Journal de création (making-of)

*Tenu au fil de l'eau. Chaque entrée note les idées, les choix, les essais et les abandons — parce que les abandons racontent autant que les réussites.*

---

## Épisode 1 — Le point de départ

Le projet naît d'un constat de terrain : la relève infirmière est une corvée répétitive, et les esquisses maison existantes (un prototype PWA « Suivi IDEL Pro », puis « transM_idel_mobile_3 », 1 800 lignes tout de même) prouvent le besoin mais pas la méthode. L'analyse du prototype révèle un vrai savoir-faire métier (le système de cases « Export » pour marquer ce qui a été transmis, les menus de soins adaptés à la pratique) mais des fondations fragiles : localStorage purgeable par Android, guillemets qui cassent les données, dictée vocale qui écrase le texte au lieu de l'ajouter, dépendances CDN qui plantent hors réseau, et aucune protection des données de santé.

**Décision fondatrice** : ne pas rafistoler, reconstruire — mais en conservant la logique métier validée par l'usage. Route technique choisie : Capacitor (le code web devient un vrai APK, pipeline GitHub Actions comme pour JM@Compta), écartant Flet (réécriture inutile, la base JS étant à 80 % faite) et la PWA pure (dictée exigeant le réseau, stockage précaire).

**L'ambition IA** clarifiée d'emblée en deux briques distinctes : la dictée vocale hors-ligne (Vosk/Whisper, le vrai gain de terrain) et la génération des transmissions — pour laquelle l'option retenue est l'hybride : moteur de rédaction à règles d'abord (déterministe, instantané, zéro Mo), LLM local embarqué en v2 pour la reformulation. L'API cloud est écartée : données de santé.

## Épisode 2 — La bataille des ergonomies

Plutôt qu'une seule maquette, cinq philosophies concurrentes, toutes fonctionnelles, pour trancher par l'usage et non sur plan :

- **A « Cockpit »** — onglets, rail de tournée vertical, formulaires. Complet mais des taps de navigation partout.
- **B « GPS »** — mode guidé plein écran : l'app déroule la tournée patient par patient en trois étapes, gros boutons, zone pouce. Vitesse maximale, rigidité maximale.
- **C « Journal »** — zéro formulaire : un fil type messagerie et une barre de saisie naturelle ; un analyseur à règles structure « TA 14/8, pansement fait, RAS » en données. Préfiguration directe du LLM v2.
- **D « Pancarte »** — la vue synoptique du tableau de service : tous les patients en grille avec leurs constantes, saisie inline dans la carte dépliée, jamais de changement d'écran.
- **E « Plan de soins »** — saisie par écarts : l'app connaît les récurrences, la routine se valide en un tap (« Tout fait, RAS »), la relève dit « conforme au plan sauf… ».

**Verdict utilisateur : la pancarte (D).** La vue d'ensemble instantanée l'emporte. Les bonnes idées des perdants ne sont pas perdues : l'analyseur naturel du C reste la porte d'entrée du futur LLM, la logique d'écarts du E pourra revenir un jour.

## Épisode 3 — La pancarte devient une vraie app (D.2)

Enrichissements demandés au fil des tests, tous intégrés et vérifiés par tests automatisés de bout en bout (jsdom + fake-indexeddb, y compris des pièges XSS dans les saisies) :

- Documents par patient (photos/PDF, miniatures, ouverture, suppression).
- Rappels typés — soin ponctuel, RDV, matériel/pharmacie, absence, autre — qui remontent dans la relève ; un rappel d'absence passe la carte du patient en pointillés.
- Relève par période en trois modes (complète / événements seuls / sélection manuelle avec événements pré-cochés), ordre chronologique par patient.
- Suivi Bilans/RDV avec statut cyclable au tap (À faire → Fait → Résultat reçu) et présentation de relève structurée par sections — reprise d'une idée du tout premier prototype.
- Plan de soins libre par patient (intitulés sur mesure pré-proposés en ★) et ajout d'un soin à la volée pendant la saisie.
- Multi-tournées **par cabinet** (correction d'un mauvais modèle mental : la démo initiale disait « Matin/Soir », la réalité du remplaçant dit « Cabinet Durand ») avec relève par cabinet sur période.
- Cycle de vie des dossiers : archivage avec tout l'historique, restauration, suppression définitive ; nettoyage global des passages antérieurs à une date.
- Persistance IndexedDB, création/édition des patients, échappement systématique des données.

*Anecdote de chantier : le premier test de bout en bout a immédiatement attrapé un vrai bug (un écouteur attaché à un élément pas encore créé). Les tests automatisés ont été rentabilisés dès la première heure.*

## Épisode 4 — La direction artistique, ou l'art d'abandonner

Doctrine : un thème n'est pas une palette, c'est une ambiance avec une signature. Le parcours fut darwinien :

- **Vague 1** : Carnet (papier/encre, serif), Bloc (signalétique hospitalière claire), Néon v1. Verdict : Bloc validé avec l'Original ; Carnet et Néon rejetés.
- **Brainstorm utilisateur** (dix pistes, « même loufoques ») : Réunion, 8 bits, financier JM@Compta, hôpital, chat, transparent, tubes néon, fête foraine, Noël, moniteur clinique. Shortlist argumentée : Moniteur, Réunion, Transparent, Tubes néon.
- **Vague 2** : quatre thèmes livrés — et trois leçons. *Un* : « Réunion » sans volcan ni palmiers n'est pas la Réunion ; l'utilisateur attendait une vraie scène. *Deux* : les thèmes clairs éblouissent (« ça pique les yeux »). *Trois* : un bug sournois — le générateur de thèmes découpait le CSS à des positions calculées avant remplacement des polices ; décalage, balise `<style>` avalée, et le thème Moniteur s'affichait en code brut chez l'utilisateur. Corrigé (et les SVG passés en base64 par prudence).
- **Vague 3** : Réunion v2 avec scène illustrée complète (volcan et son panache, palmiers, case créole, queue de baleine, soleil, vagues) **changeant selon l'heure** — lever, journée, coucher ; Verre fumé (le transparent passé côté nuit) ; Tubes néon v2 (enseigne encadrée, halos) ; Moniteur v2 (grille de scope, ECG animé, balayage CRT).
- **Épilogue Moniteur** : trop chargé. Retravaillé sans quadrillage, puis finalement **abandonné** — mais pas sa meilleure idée : le tracé ECG migre dans le nouveau thème **Hôpital de nuit** (transparence foncée teal, bracelets patients en guise de statuts, croix médicale). Et sur une demande qui fait toute la différence : le tracé devient réaliste (ondes P-QRS-T) **et la ligne dessine un cœur entre deux battements**. Vérifié au pixel en rendant le SVG en image : deux battements, un cœur, la boucle. La signature de l'app était née.

**Collection finale close, six thèmes** : Original, Bloc, Réunion, Verre fumé, Tubes néon, Hôpital de nuit.

*Leçon de méthode retenue au passage (à mes dépens) : livrer exactement ce qui est demandé, rien de plus — régénérer un thème non sollicité coûte du temps et de la confiance.*

## Épisode 5 — L'unification (JM@Santé v3)

Les six thèmes fusionnés en une seule application : chaque ambiance devient un jeu de variables et de règles CSS à portée `data-app-theme`, un sélecteur 🎨 apparaît dans la feuille Tournées, le choix est persisté avec les données, et la Réunion garde son horloge à scènes. Non-régression complète au vert. À partir d'ici, une seule base évolue.

## Épisode 6 — Le sens de l'app (clarification décisive)

L'utilisateur pose la doctrine qui gouvernera toute la suite : **JM@Santé est un carnet de mission, pas un dossier médical au long cours.** Collecte en direct chez les patients ; relève complète ou sélective en fin de remplacement ; transmission par email/WhatsApp/MMS avec les documents choisis (le chiffrement des envois étant assuré par l'outil santé déjà utilisé au cabinet) ; et la donnée vit le temps de son utilité : constantes et relèves un an maximum, documents remplacés ou effacés dès qu'ils ne servent plus — le remplacement d'une ordonnance remettant son compteur de validité à zéro — et effacement manuel possible à tout moment, sur tout.

Priorités de déploiement actées : **Android → Windows → iPhone en attente** (pas de compte Apple payant pour l'instant). Capacitor confirmé pour Android ; Windows via Electron ou PWA sur le même cœur.

Prochains chantiers, dans l'ordre : module de partage natif (formats + pièces jointes), rétention automatique et gestion fine des documents, verrou et sauvegarde, structuration Capacitor.

## Épisode 7 — Le baptême

L'application reçoit son nom définitif : **JM@Santé**. La filiation avec JM@Compta est assumée — deux outils frères, la gestion d'un côté, le soin de l'autre, même auteur, même esprit d'artisanat. « TransM » restera le nom de code des archives de ce journal.

## Épisode 8 — Le partage, sans béquille

Premier chantier du cœur de l'appli. Le défi n'était pas le bouton, mais le format : produire un **vrai fichier .docx hors-ligne, sans aucune bibliothèque**. Solution : un .docx est une archive ZIP de fichiers XML — alors JM@Santé embarque son propre écrivain ZIP (mode « store », avec calcul CRC32 maison, ~60 lignes) et fabrique le document Word de toutes pièces. Vérifié à la fois par Python (archive valide) et par python-docx (document Word authentique, accents et échappement compris) — le fichier s'ouvre dans Word, LibreOffice ou Google Docs.

Côté interface, la feuille de relève devient une feuille de transmission : choix du format (.txt ou .docx), liste des **documents du périmètre à cocher** (ordonnances, bilans, photos — libellés « PATIENT — fichier (date) »), et un bouton **📤 Partager** qui ouvre le menu natif du téléphone (Web Share niveau 2 : email, WhatsApp, MMS, le logiciel de chiffrement santé du cabinet…). Sur un navigateur qui ne sait pas partager, repli automatique en téléchargement — rien ne casse jamais. À l'empaquetage Capacitor, seule la fonction `shareFiles()` changera d'implémentation ; tout le reste est déjà en place.

## Épisode 9 — L'app qui sait oublier

La doctrine du carnet de mission devient du code. Au démarrage, JM@Santé fait désormais son ménage : les passages, bilans clos et rappels traités plus anciens que la durée de conservation choisie (3, 6 ou 12 mois, réglable dans 🗺️) sont purgés silencieusement, avec un simple récapitulatif — « 3 éléments de plus de 12 mois purgés automatiquement 🧹 ». Deux exceptions volontaires et signifiantes : un bilan encore « À faire » n'est jamais purgé (une prise de sang oubliée depuis un an mérite d'être vue, pas effacée), et les documents ne partent que de la main de l'utilisateur.

Les documents, justement, gagnent leur cycle de vie : chaque vignette affiche sa date d'ajout et son ancienneté, passe en alerte ambre au-delà de trois mois (« ⚠ 27 mars · 5 mois »), et un bouton 🔁 permet de **remplacer** — l'ordonnance de septembre prend la place de celle de mars, même emplacement, ancienne version effacée dans le geste, et le compteur de validité repart de zéro. Enfin, l'audit de l'effacement à la volée a débusqué un oubli : les rappels ne pouvaient qu'être cochés, jamais supprimés. Corrigé — tout ce qui se crée dans JM@Santé peut désormais mourir individuellement, à la demande.

## Épisode 10 — La porte et le pont

Le dernier chantier fonctionnel avant Android. **La porte** : un verrou par code à 4 chiffres, écran de saisie plein thème (le logo J♥S y fait sa première apparition), double saisie à l'activation, et le code jamais stocké en clair — seulement son empreinte SHA-256. Au démarrage suivant, l'app est fermée à clé. Testé sur deux « sessions » simulées : mauvais code refusé, bon code déverrouille, données intactes.

**Le pont** : l'export/import JSON — la sauvegarde complète en un fichier, qui servira de passerelle vers le PC et la future version Windows. Détail qui a son importance : l'import reconnaît aussi les sauvegardes de l'ancienne app « Suivi Infirmier » (l'ancêtre du projet) et les convertit automatiquement vers le modèle actuel — les données de l'époque ne sont pas orphelines. Et lors d'un import, le code PIN, le thème et la durée de conservation locaux sont préservés : restaurer ses données ne désarme pas sa porte.

Le socle fonctionnel est complet. Prochaine étape : la grande structuration — découper le monofichier en modules propres et monter le projet Capacitor vers l'APK.

## Épisode 11 — Les rappels passent au calendrier

La fonctionnalité existait à l'état brut. Elle méritait mieux. Les rappels s'enrichissent d'un **compte à rebours calendaire** : dormant tant qu'on est à plus de 3 jours, puis J-3 / J-2 / J-1 en ambre gras, JOUR J en rouge, et « ⚠ dépassé de n j » une fois passé. Plus de rappels muets qui se perdent dans la liste — ceux qui comptent crient leur urgence.

Chaque ligne de rappel est devenue **tappable** : une feuille d'édition complète s'ouvre, avec le texte, le type, le patient concerné, la date — et surtout des **chips de prolongation** (+1 j, +3 j, +7 j, +1 mois) qui évitent d'ouvrir un calendrier pour reculer d'une semaine. Utile pour le RDV cardiologue qu'on déplace en une seconde.

Dans la relève générée, les rappels incluent maintenant leur countdown dans le texte exporté : « éch. 29 août [J-2] : Cardiologue mardi ». Le destinataire de la transmission voit immédiatement l'urgence, sans décoder une date seule.

## Épisode 12 — Le monofichier éclate (en bon sens)

1 646 lignes dans un seul fichier HTML, c'était le prix de la rapidité en maquette. Pour passer à Capacitor, il fallait découper. Le JS s'est réparti en **neuf modules** au fil de leur logique : `globals.js` (constantes et helpers), `storage.js` (IndexedDB, migrations, purge), `seed.js` (données de démo), `ui.js` (rendu pancarte et cartes), `sheets.js` (toutes les feuilles modales), `engine.js` (moteur de relève), `share.js` (ZIP/DOCX et partage), `dictate.js` (reconnaissance vocale), `init.js` (démarrage, verrou, écouteurs globaux). Le CSS en un fichier `app.css`. Le tout coordonné par un `index.html` léger qui n'est plus qu'un shell.

Testé en recomposant les modules dans JSDOM comme le ferait le navigateur : rendu identique, relève OK, 6 thèmes, réglages, rappels avec countdowns — aucune erreur.

Le projet **Capacitor `fr.jmsante.app`** est configuré : `capacitor.config.json` avec SplashScreen (fond noir, logo J♥S à venir), StatusBar assortie au thème, Camera et Share prêts. Un `README.md` détaille les étapes depuis `npm install` jusqu'à `npx cap open android`, avec la table des plugins et le guide de signature de l'APK.

**Le pipeline GitHub Actions** est prêt : push sur `main` → APK debug en artefact (téléchargeable dans l'onglet Actions, sans Android Studio ni Java en local) ; tag `vX.Y.Z` → Release GitHub avec l'APK. La signature release est commentée mais documentée — il suffira d'ajouter les 4 secrets et de décommenter 5 lignes.

Prochaine étape concrète : créer le dépôt GitHub, pousser le projet, laisser Actions compiler le premier APK, l'installer sur le téléphone et voir JM@Santé tourner comme une vraie application native.

## Épisode 13 — Le premier APK, et le baptême du terrain

Le dépôt GitHub est monté, Actions a compilé, l'APK s'est installé — JM@Santé tourne en vraie application native sur le téléphone. Et immédiatement, le terrain a parlé : boutons qui débordent, copie qui ne copie rien, PDF muet, pièces jointes fantômes. Chaque semaine de la fin août a été un aller-retour serré entre le code et la tournée réelle, sur une lignée de dépôts versionnés (v11, v14, v16, v17…) — le journal des batailles est dans l'historique Git.

Les leçons durement apprises : `navigator.clipboard` ment dans une WebView Android (il faut le plugin natif) ; `window.print()` n'existe pas vraiment sous Capacitor ; les caractères Unicode du texte de relève (─ n'est pas un tiret !) piègent les expressions régulières ; et un ZIP de pièces jointes est une fausse bonne idée quand le destinataire est sur mobile.

## Épisode 14 — La relève apprend à être lue

Refonte complète du format de sortie : encadré par patient, emoji fixes par section (✅ soins, 📊 constantes, 📝 transmission), heure supprimée sauf pour les RDV, « RÀS » en une seule ligne pour les passages de routine, synthèse en tête et pied. Et une interface d'envoi unifiée : quatre formats (texte, PDF, HTML, Word), cases à cocher des documents à joindre, un seul bouton 📤 qui ouvre le menu de partage Android — WhatsApp, Gmail, SMS, l'utilisateur choisit — avec un message d'accompagnement généré automatiquement.

Le PDF a demandé sa propre bataille : jsPDF ne parle que Latin-1, il a fallu tout redessiner avec des primitives (bandeaux colorés, barres latérales, hiérarchie typographique) au lieu de copier le texte brut.

## Épisode 15 — Les annexes, ou le lien qui saute à la bonne page

L'idée est venue d'Excel : « comme quand je mets un lien de facture sur une ligne comptable ». La relève envoyée est désormais **un seul fichier** : le texte, puis pour chaque document une ligne « 📎 Voir : plaie_sacrum.jpg (Annexe 1) » **cliquable** qui saute à l'annexe numérotée en fin de document. Photos affichées en grand ; PDF d'ordonnances **convertis en images de pages** par pdf.js (bibliothèque Mozilla embarquée, hors ligne). Liens internes jsPDF pour le PDF, ancres pour le HTML, signets Word pour le DOCX.

Un bug mémorable au passage : le découpage par patient échouait silencieusement parce que `─` (U+2500) n'est pas `-` — et l'utilisateur ne testait pas toujours la dernière version extraite, ce qui a valu une soirée de débogage d'un code… déjà corrigé.

## Épisode 16 — L'atelier à domicile

Marre d'attendre GitHub Actions dix minutes par essai. Installation complète de la chaîne locale sur le PC Windows : Android Studio, adb, le bras de fer Java 25 vs Gradle (résolu par un JDK 21 dédié), les trois fichiers de config à recréer après chaque `cap add`. Résultat : **quinze secondes** entre une modification et l'app relancée sur le téléphone branché en USB. Le rythme de développement a changé de dimension.

## Épisode 17 — Bilans et rappels se parlent

Un bilan sanguin programmé jeudi créait… rien. Il fallait penser à créer soi-même le rappel. Désormais : un bilan « À faire » daté engendre automatiquement son rappel 🧪 avec le countdown J-3 → Jour J ; le passer à « Fait » clôt le rappel ; le supprimer emporte le rappel. Une saisie, deux systèmes synchronisés.

## Épisode 18 — La forteresse (v19)

Quatre chantiers lourds en une session. **SQLite chiffré** : les données quittent IndexedDB pour une base SQLCipher — chiffrement AES applicatif PAR-DESSUS chiffrement de la base, migration automatique, l'utilisateur n'a rien vu. **Biométrie** : l'empreinte déverrouille l'app (avec un piège de nommage — la méthode native s'appelle `internalAuthenticate`, pas `authenticate`). **Dictée hors-ligne** : le SpeechRecognizer natif d'Android remplace l'API web, fonctionnel en zone blanche avec le pack vocal français. Et le **README technique** qui documente enfin l'architecture pour de vrai.

## Épisode 19 — Le confort du geste (v20)

Une rafale d'améliorations dictées par l'usage réel : **phrases types** (26 formulations classées en 7 thèmes — pansements, douleur, diabète… — insérables en 3 taps, catalogue enrichissable avec créat ion de catégories) ; **valeurs fantômes** (la dernière TA connue en filigrane dans le champ) ; **mode DARD** (Données/Actions/Résultats/Devenir en 4 champs guidés) ; **tags de priorité** (👁️ à surveiller, 🔴 prioritaire…) sur la pancarte et dans la relève ; **FAB dictée rapide** (le gros micro flottant pour dicter dans la voiture et affecter au patient en un tap) ; **journal des envois** (la preuve de transmission) ; **rappel de sauvegarde** (l'alerte orange au-delà de 7 jours).

## Épisode 20 — Deux visages pour une identité

Le logo définitif est arrivé : bulle de dialogue, cœur en tracé ECG, croix de vie, courbe ascendante — « Logiciel de relève pour IDEL ». En deux déclinaisons, argentée sur anthracite et teal sur blanc, et l'écran de démarrage Android choisit tout seul la bonne selon le thème sombre ou clair du téléphone (`drawable` / `drawable-night`).

---

*Prochaine entrée : le mode d'emploi utilisateur, et la piste Windows.*

### v1.0.57 — Le Moniteur respire
Les quatre rangées du Moniteur (Tournée, Moment, Avancement, Affichage) étaient collées les unes aux autres. Trois pistes comparées sur maquette : plus d'espace seul, cartes, traits séparateurs. Retenu : **les cartes** — chaque rangée dans son propre bloc, 14 px entre les blocs, le liseré coloré repassé sur le bord gauche de la carte, 20 px avant les bandeaux Matin/Soir. Uniquement des variables de thème, les six thèmes suivent.
Finalement, la version « Aérée » (A) lui plaisait aussi : les deux sont gardées, au choix dans ⚙️ Application → 🧩 Présentation du Moniteur (Cartes par défaut, Aérée = présentation d'origine avec 26 px entre rangées). Réglage indépendant du thème.

### v1.0.58 — Ce qu'on choisit de voir, et ce qu'on choisit d'envoyer
Point de départ : l'analyse d'une autre IA, relue point par point. La moitié décrivait ce que l'app faisait déjà ; trois idées ont survécu, affinées ensemble.

**L'affichage devient une affaire de goût.** Plutôt que d'imposer, on propose : constantes en **tableau de bord** (une tuile par mesure, sa date en ambre si elle a plus d'un jour, ↑ HAUT rouge / ↓ BAS bleu — l'app compare à un seuil, elle n'interprète pas), cartes patient à **bande latérale** avec 📞 et 📍 au pouce. Chaque choix a son interrupteur dans ⚙️ Application ; par défaut, rien ne change. Et une **légende** des couleurs, enfin — même pour les pastilles d'origine, qu'il fallait jusque-là deviner.

**Le code de verrouillage n'avait pas de porte de secours.** En relisant le code, on a découvert qu'un code oublié obligeait à désinstaller. Le mail de secours supposait un serveur, la question de secours se devine : on a retenu la solution des banques, un **code de secours** montré une seule fois. Les nouveaux codes passent à 6 chiffres, et l'app invite à en créer un aux cinq premiers lancements.

**Les échanges se protègent, sans serveur.** Le mot de passe ne devait jamais être obligatoire (« si j'envoie déjà par une plateforme chiffrée, pas envie de m'embêter »), ni changer à chaque envoi (« sinon deux envois par relève »). D'où le **mot de passe de tournée**, réutilisable. Puis l'**appairage** : un QR scanné une fois, et plus rien à taper. Puis les deux à la fois, parce qu'un collègue perd son téléphone et qu'il faut quand même lui envoyer la relève sur celui de secours. Puis le mélange dans une même tournée : Pierre appairé, Sandra au mot de passe, Yann en libre — un seul fichier protégé pour les deux premiers, grâce à une enveloppe à plusieurs serrures.

La réglette graduée pour les photos de plaies, elle, attendra : mesurer une plaie, c'est déjà s'approcher du dispositif médical.

### v1.0.59 — Le sel de la maison
Dernier point de l'analyse retenue : la clé qui chiffre les dossiers dans le téléphone. Elle était fabriquée avec un sel identique sur tous les appareils et 100 000 tours de moulin. Désormais, chaque installation tire son propre sel au hasard, et le moulin tourne 600 000 fois.

Le vrai sujet n'était pas la cryptographie, c'était la migration : des mois de dossiers réels, écrits avec l'ancienne clé, qu'il ne fallait surtout pas perdre. Chaque bloc chiffré porte maintenant la version de sa clé. L'app sait donc lire les deux, et rechiffre en tâche de fond, bloc par bloc, quelques secondes après l'ouverture. Fermer l'app en plein milieu ne coûte rien : le travail reprend au lancement suivant. Au passage, les plus vieux documents, encore en clair parce qu'antérieurs au chiffrement, sont enfin chiffrés.

Honnêteté oblige : le gain est modeste. La vraie protection reste le verrouillage du téléphone. C'est de la bonne hygiène, faite au calme, séparément du reste.

### v1.0.60 — Des couleurs qu'on choisit, et qu'on n'a pas besoin de voir
La légende à peine posée, une envie : choisir soi-même ses couleurs. Trois formules ont été dessinées — palettes prêtes, couleur libre, les deux — et c'est la troisième qui l'a emporté : partir d'une palette pensée pour que les statuts ne se confondent pas, puis retoucher, avec un aperçu en direct et un garde-fou si deux couleurs deviennent trop proches.

Puis la bonne question, venue de lui : et ceux qui ne distinguent pas les couleurs ? Un homme sur douze confond le rouge et le vert. D'où l'idée de doubler chaque couleur d'un **motif** — rayures, points, quadrillage. Sur la bande latérale, élargie pour l'occasion, ça fonctionne. Sur une pastille de dix pixels, un motif devient bouillie : on y met une **forme** à la place — rond, coche, triangle avec un point d'exclamation, tiret. Un interrupteur active le tout ; la palette Daltonisme l'allume d'office.

Détail qui compte : le rouge de la vigilance est aussi celui des constantes hors seuil. Le changer ici le change partout — une couleur doit toujours dire la même chose.

### v1.0.61 — Trois retouches de terrain
Premiers retours à l'usage. La bande latérale, si parlante sur une carte repliée, s'étirait sur toute la hauteur d'une carte dépliée : elle disparaît désormais dès qu'on ouvre la carte, et le formulaire récupère sa largeur. Les tuiles de constantes ressemblaient à des boutons mais ne faisaient rien — un oubli : toucher une tuile mène maintenant au champ de saisie de sa constante, clavier ouvert, ou aux courbes depuis la fiche. Et la pastille, jugée trop discrète, se décline en trois tailles : petite, moyenne, grande.
