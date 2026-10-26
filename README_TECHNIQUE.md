## v1.35.0 — le cache gelé, deux noms qui s'écrasaient, et quatre boutons morts

### ⚠️ Le plus grave : l'application ne recevait plus aucune mise à jour

Signalé à l'usage : *« j'ai bien la version 1.34.0 et pourtant je ne vois pas ton interrupteur ou
quoi que ce soit »*. L'enveloppe se mettait à jour, **le code jamais**. Mesuré en faisant tourner
le vrai `sw.js` avec un « ancien » puis un « nouveau » code :

```
  2e chargement (cache posé)        : ANCIENNE
  rechargement 1 après mise à jour  : ANCIENNE
  rechargement 2                    : ANCIENNE
  rechargement 3                    : ANCIENNE
  rechargement 4                    : ANCIENNE
  entrées en cache : ["/js/app.js", "/js/app.js?v=1.33.0", "/js/app.js?v=1.34.0"]
```

Deux causes qui se renforçaient :

1. **Le nom du cache était écrit en dur** — `const CACHE = "jmsante-v215"` — et n'avait pas bougé
   depuis des dizaines de versions. Le code qui purge les vieux caches ne se déclenche QUE si le
   nom change : il ne s'est jamais déclenché. *Quatrième numéro recopié à la main trouvé dans ce
   dépôt, et de loin le plus coûteux : il rendait toutes les livraisons invisibles.*
2. **La lecture ignorait le marqueur `?v=`, l'écriture non.** `caches.match(req, {ignoreSearch:true})`
   rend la **première** entrée trouvée — celle posée à l'installation — pendant que le
   rafraîchissement d'arrière-plan rangeait sous `req`, marqueur compris. Le nouveau code était
   bien téléchargé, bien rangé, et jamais lu. D'où les trois entrées ci-dessus.

**Ce qui est fait.** `build.js` stampe le nom du cache depuis `package.json` à chaque compilation,
comme il le fait déjà pour `index.html` ; le rangement se fait sous la **clé nue**, celle que la
lecture regarde ; et la compilation **refuse** désormais un `sw.js` qui ne se parse pas ou dont le
cache ne porte pas la version.

Après correction : le nouveau code arrive au **2ᵉ rechargement** (le premier sert encore l'ancien
service worker, qui installe le nouveau — c'est le comportement du navigateur), **une seule
entrée** pour `app.js`, le vieux cache purgé, et **hors ligne l'application s'ouvre toujours**,
avec le nouveau code.

### ⚠️ Deux fonctions différentes portaient le même nom

Les 42 modules sont collés bout à bout. Deux `function nom(){}` identiques n'est pas une erreur de
syntaxe : la **dernière déclarée gagne, en silence**.

| Nom | Les deux | Qui gagnait | Conséquence |
|---|---|---|---|
| `ficheHtml` | fiche.js (la fiche d'un patient) · bilans.js (la fiche de rappel d'un bilan) | **bilans.js** | Produire la fiche d'un patient en HTML ou en PDF sortait le cadre « Pour moi / Pour le patient » d'un bilan, **sans aucune donnée du patient** |
| `sheetBilans` | sheets.js (les bilans et RDV d'un patient) · bilans.js (le guide des tubes) | **bilans.js** | Le bouton 🧪 d'une carte patient ouvrait le guide ; l'écran du patient était **inatteignable** |

Plus cinq raccourcis de `sheets.js` redéclarés plus bas dans le même fichier (`sheetClean`,
`sheetArchives`, `sheetSendLog`, `sheetCatalog`, `sheetPhrases`) : sept lignes qui n'avaient jamais
tourné, et qu'on lisait en croyant lire le code en vigueur.

Renommés en `bilanFicheHtml` et `sheetBilansGuide`, les raccourcis morts retirés après vérification
à l'exécution. Une suite statique — `_test_doublons.js` — veille maintenant sur les noms redéclarés
**dans l'ordre de la chaîne de construction**, puisque c'est lui qui décide du gagnant.

### Quatre lignes du mode liste ne menaient nulle part

Signalé à l'usage : *« quand je mets les paramètres en mode liste, le bouton sauvegarder ne
fonctionne plus »*. Il n'était pas seul.

| Clé de l'affichage | Ligne | Destination voisine, jamais atteinte |
|---|---|---|
| `bk` | 💾 Sauvegarde | `backup` |
| `envois` | 📨 Journal des envois | `sendlog` |
| `menage` | 🧹 Conservation des données | `clean` |
| `modeles` | 📄 Mes modèles de documents | — |

Elles tombaient sur `default`, **qui rouvrait les Réglages** : à l'œil, rien ne se passe, et le
bouton a l'air cassé. Les **19 gestes du mode tuiles étaient tous branchés** — le défaut ne se
voyait que dans l'autre présentation.

`default` parle désormais : journal d'incident, message à l'écran, et retour à un écran connu.
*Un geste qui ne mène nulle part ne doit pas avoir l'air de marcher.*

### L'épreuve qui touche les 51 gestes

`tests/navigateur/pw_menu_gestes.js`, port 8236, **19 contrôles** : les Réglages sont ouverts en
tuiles **puis** en liste, chacun des 19 + 32 gestes est réellement déclenché, et l'épreuve vérifie
qu'on a **quitté l'écran** — exactement ce que l'utilisateur constate. Elle répond **non** à toutes
les confirmations et vérifie à la fin que les dossiers sont toujours là.

Deux gestes ne changent pas d'écran et c'est normal — « Recevoir » ouvre le sélecteur de fichiers
du système, « Feuille de route » referme le panneau pour partager : ils sont mesurés autrement,
pas exemptés.

`tests/navigateur/pw_sw_maj.js`, port 8237, **14 contrôles** : la livraison d'une mise à jour, la
purge du vieux cache, l'unique entrée sans marqueur, et le hors ligne.

### Et cinq fois ma propre mesure a menti avant de dire vrai

- **Mon correctif a cassé `sw.js`** : un `const` posé à l'intérieur de `respondWith(…)`, donc un
  fichier impossible à parser. Le navigateur refuse l'enregistrement **en silence** — plus de
  service worker, plus de cache, plus de hors ligne — et la compilation disait « Vérification
  OK », car elle ne regardait que `app.js`. C'est le banc d'essai qui l'a dit :
  « NON contrôlée · caches [] ». La compilation vérifie `sw.js` depuis.
- **Une temporisation n'est pas un fait** : à 1,6 s le service worker était encore
  « activating » et deux caches coexistaient. On attend désormais l'**état**, pas le chronomètre.
- **« Un seul cache » était vrai au milieu de la purge**, à l'instant où l'ancien subsistait seul.
  On attend le **bon** cache, pas un compte.
- **`closeSheet()` ne vide pas le panneau** : il décroche le voile, et le HTML reste dans le DOM.
  Chercher `.mswitch` seul faisait passer « Feuille de route » pour un geste mort.
- **Le balayage était incomplet sans les essais ouverts** : 15 tuiles au lieu de 19 et 27 lignes au
  lieu de 32 — dont « Mes modèles », précisément l'une des quatre lignes mortes.

Et un défaut planté exprès a montré qu'un **contrôle de forme ne suffit pas** : `jmsante-v215`
ressemble à une version, et passait. Le nom du cache est maintenant comparé à `package.json`.

---

## v1.34.0 — les feuilles de domicile calées sur le calendrier

### Le besoin, mot pour mot

*« Il faudrait qu'elles puissent se caler sur le calendrier réel. Mettre un petit à côté de la
date pour qu'on puisse identifier le jour, et faire des blocs de sept jours pour faire la
semaine. »*

La feuille ignorait le calendrier : 31 lignes numérotées, `Mois : ________ 20___` à remplir à la
main, un filet tous les cinq jours — un rythme qui ne veut rien dire.

### Mesuré avant d'écrire une ligne

| | |
|---|---|
| largeur du tableau | **194 mm** (A4, marges 8 mm) |
| colonne du jour (6 %) | **11,62 mm** |
| « 31 Me » en densité serrée | **8,63 mm** → tient |
| « 31 Me » en densité confortable | **10,52 mm** → tient |
| rendu réel (abréviation à 0,82 em) | **8,10 mm** |
| serrée, mention de 4 lignes, 31 jours | **1 page** — le chiffre documenté, retrouvé |

**Aucune autre colonne n'a été resserrée d'un dixième de millimètre.** La place était déjà là.

### Ce qui est fait

| | |
|---|---|
| Descripteur | `feuMois("AAAA-MM")` → nombre de jours, abréviations, bornes de semaine, week-ends, coupe recto-verso |
| Interrupteur | « Caler sur un mois réel » — **coché** depuis une fiche patient, **décoché** depuis Documents vierges |
| Navigation | deux flèches ‹ › qui ne passent jamais par un jour du mois |
| La ligne | `1 Di` — le numéro inchangé, le jour en deux lettres derrière, plus petit et plus clair |
| Le filet | entre **dimanche et lundi**, plus tous les cinq jours |
| Le week-end | marqué dans les **lettres** (plus sombres, plus grasses) |
| L'en-tête | « Novembre 2026 » imprimé, plus de blancs à remplir |
| Les lignes | 28, 29, 30 ou 31 — et la coupe du verso suit (1–15 / 16–30 en novembre) |
| Les trois feuilles | constantes, glycémies **et** poids — dont la colonne de date libre se remplit |
| Le nom du fichier | `..._2026-11` : une sacoche finit par contenir douze feuilles du même patient |

### ⚠️ Le week-end n'est pas un fond, et ne peut pas l'être

La maquette proposait une teinte légère sur les cases de samedi et dimanche. **Le code portait déjà
la mesure qui l'interdit**, écrite quand le zébrage a été retiré de cette feuille :

- « imprimer les arrière-plans » est **décoché par défaut** — un fond ne s'imprime pas, et la
  feuille vit sur un frigo, pas sur un écran ;
- et il **découpait le filigrane** : mesuré ligne par ligne, 10 210 pixels de cigale et **256
  lignes sur 404 sans aucune trace**. Chromium repeint ces cellules en blanc opaque.

Samedi et dimanche sont donc marqués dans les lettres elles-mêmes, qui s'impriment toujours. Une
épreuve vérifie qu'aucun fond n'est revenu par la petite porte.

### Le mois est une chaîne, jamais un objet `Date` qui circule

`"AAAA-MM"` de bout en bout. Un `Date` passé de fonction en fonction se décale d'un jour dès qu'un
fuseau s'en mêle — et **une feuille de surveillance décalée d'un jour est pire qu'une feuille sans
jours du tout** : on lirait « mardi » au-dessus du relevé de mercredi. Le décalage de mois ne
manipule que le couple (année, mois) : le 31 janvier + 1 mois donnerait sinon le 3 mars.

### La feuille générique n'a pas bougé d'un octet

C'est elle qu'on imprime en pile d'avance. Les six sorties (3 feuilles × 2 densités) ont été
comparées caractère par caractère à celles de la v1.33.0 : **le seul écart est le bloc de style
ajouté**, dont aucune règle ne peut s'appliquer faute d'abréviation dans le document. Le papier est
identique. Un mois illisible (`"2026-77"`, `""`) retombe sur elle plutôt que d'afficher « NaN ».

### L'épreuve

`tests/navigateur/pw_feuille_mois.js`, port 8235, **48 contrôles** : 48 mois et **1 461 jours**
recalculés contre `Date`, février bissextile et non bissextile, 2100 qui ne l'est pas, les deux
changements d'heure jour par jour, la feuille générique inchangée, les trois feuilles calées, la
coupe du verso comptée **face par face**, l'écran et ses deux défauts d'interrupteur, et la
géométrie remesurée pour que personne ne resserre la colonne un jour sans voir que le jour n'y
tient plus.

Huit défauts plantés exprès, huit attrapés. Vérification en rouge sur la v1.33.0 : elle tombe et
nomme ce qui manque.

### Et trois fois ma propre mesure a menti avant de dire vrai

- **La géométrie mesurée dans la fenêtre du téléphone.** 430 px : la feuille faisait 92,5 mm de
  large et la colonne 5,53 mm. Deux contrôles tombaient sur ce seul décalage, alors que la feuille
  va sur une page A4.
- **Le contrôle de la coupe ne voyait pas la coupe.** Il vérifiait que les lignes 15 et 16
  *existent* — elles existent des deux côtés de la coupure. Une coupe laissée à 16 en dur passait
  au travers ; c'est un défaut planté qui l'a montré. On compte désormais les lignes de chaque face.
- **Et la sonde plantait au lieu de rapporter**, pour la deuxième fois du mois : un `.click()` sur
  une flèche absente levait une erreur qui emportait toute la mesure — code 1, et zéro ligne pour
  dire quoi.

---

## v1.33.0 — signer une ordonnance envoyée en numérique, et un écran mort depuis quatre versions

### Ce qui existait, et ce qui manquait

Les deux moitiés étaient déjà là : le pavé de tracé (écran de relève, `openSignature`) rend une
image, et l'ordonnance réserve un cadre de **82 × 32 mm** en bas à droite. Elles ne se parlaient
pas. Le cadre partait vide et annonçait « DATE & SIGNATURE **MANUSCRITE** IDEL » — juste sur une
feuille qu'on imprime, **faux** au-dessus d'une image apposée.

### Ce qui est fait

| | |
|---|---|
| Rangement | `doc_masignature` — chiffré par le coffre (`_aChiffrer` couvre tout `doc_*`), **absent des sauvegardes** |
| Lecture | `maSignatureLire()` lancée par `init.js` au démarrage ; `maSignatureSync()` pour l'affichage |
| Entrée | « Ma signature » dans **Ma fiche** : aperçu sur fond blanc, Tracer / Refaire / Effacer (double validation) |
| Interrupteur | `#or-apposer` sur l'écran de l'ordonnance, **décoché par défaut**, remplacé par une invitation à tracer si rien n'est enregistré |
| Document | PDF (`ordonnancePdf`) **et** aperçu HTML (`produireOrdonnance`) : même bascule des trois mentions |

Signé, trois choses basculent **ensemble** : le mot « MANUSCRITE » tombe, la date se remplit, le
nom lisible vient sous le tracé, et le mot « originale » quitte le pied de page. *Un seul des
trois oublié et le document affirme quelque chose de faux.*

### Deux défauts que seule la mesure attrape

- **`const sa` déclaré après le bloc qui s'en sert.** Zone morte temporelle : `ReferenceError`
  garantie au moment précis où l'on signe, et **la compilation ne proteste pas**. Le helper est
  désormais défini avant son premier usage, avec le piège noté sur place.
- **`fmtFR()` rend « 25 oct. », sans année.** Lisible dans une liste, inacceptable sur un document
  médico-légal qu'on envoie. Remplacé par `dateP()`, l'idiome que l'app emploie déjà pour les
  dates de naissance : `iso.slice(0,10).split("-").reverse().join("/")`.

### ⚠️ L'écran de recherche était mort depuis la v1.29.0

`sheetSearch()` **ne reçoit aucun argument**. Le cloisonnement des brouillons (v1.29.0) a posé
`brDossier(pid)` sur les 22 panneaux de dossier d'un seul geste, et celui-ci a suivi *par
ressemblance* : `pid` n'y existe pas, donc `ReferenceError` et l'écran ne s'ouvrait plus. **Livré
ainsi en v1.29.0, v1.30.0, v1.31.0 et v1.32.0.** La recherche n'est pas un dossier : elle ne
retient aucun brouillon, l'appel est simplement retiré.

Un détecteur statique vérifie maintenant, pour chacun des 22 appels `brDossier(X)`, que `X` est
bien dans la portée de la fonction qui l'entoure. Il a été éprouvé par un défaut planté exprès.

### Et les gardes qui ne gardaient plus rien

L'épreuve `pw_search` **voyait** ce défaut : elle levait l'erreur au lieu de la rapporter, et
mourait. Deux suites statiques qui ouvrent tous les écrans plantaient avec elle. *Une garde qui
explose ne garde rien.* Toutes les épreuves ont désormais une garde qui nomme ce qui manque avant
de toucher à quoi que ce soit.

| Ce qui criait faux | Pourquoi | Combien |
|---|---|---|
| « module dans la chaîne » | Exigeait une suite de modules **contiguë** dans `build.js`, coupée par `medicaments_base`, `medicaments` et `alertes` ajoutés depuis. Remplacé par un contrôle de **présence** | 11 suites |
| « aucun window.open dans les documents du cabinet » | Bannissait `window.open` partout et accusait les trois ouvertures du GPS — `window.open(url, "_system")`, confié à l'appareil, le motif que l'app documente comme **correct**. Le piège est la fenêtre **sans cible**, celle qui porte une page à imprimer et ne rend pas la main | 1 suite |
| « la sauvegarde complète reste possible » | Gardait la **temporisation de 900 ms** retirée en v1.32.0 parce qu'elle faisait quitter l'écran pendant que la question de partage était encore posée. *Une temporisation n'est pas un fait* | 1 suite |
| 5 contrôles de `pw_deroule` | `seqPool[i]` n'est pas un patient mais `{p, rang, cle, multi}` : la sonde lisait `.id` sur l'enveloppe et mourait sur `getP(undefined)` | 1 épreuve |

Chaque détecteur réécrit a été éprouvé par un défaut planté exprès — un module retiré de la
chaîne, une fenêtre d'impression rouverte — et les deux mordent.

### L'épreuve

`tests/navigateur/pw_signature.js`, port 8234, **45 contrôles** : le rangement et le chiffrement,
l'absence des sauvegardes, l'entrée dans Ma fiche, l'interrupteur et son défaut décoché, le PDF
décoché puis coché (espion posé sur le **constructeur** jsPDF — un prototype patché après coup ne
voit rien, jsPDF recopie ses méthodes sur l'instance), l'aperçu HTML, l'effacement, et le
**démarrage à froid** : sans la lecture lancée par `init.js`, l'interrupteur manque à celui qui
ouvre une ordonnance en premier geste.

Sept défauts plantés exprès, sept attrapés. Vérification en rouge sur la v1.32.0 : elle **tombe**
et nomme ce qui manque, elle ne plante pas.

### Reste rouge, et ne l'est pas à cause de ce lot

Quatre suites statiques rapportent des écarts **antérieurs à la v1.32.0**, non examinés :
`_test_eggs` (« sortie toujours visible »), `_test_ergo` (deux contrastes), `_test_liens`
(« patients masqués par le filtre gardent leur place ») et `_test_j1creneau` (5 contrôles sur le
filtre de créneau). Elles demandent une mesure, pas un réglage de détecteur.

---

## v1.32.0 — le dessin partiel d'une carte, et un modèle faux corrigé

### Ce que la mesure dit, contre ce que le rapport annonçait

Le rapport d'audit promettait : *« ouvrir une carte reconstruit tout le plateau : 121 à 260 ms,
visé moins de 40 ms »*. **Le modèle était faux.** Mesuré sur 40 patients et 3 600 passages,
processeur ralenti six fois :

| | |
|---|---|
| `render()` entier — fabrication du HTML **et** pose | **31 ms** |
| la mise en page qui suit | **117 ms** |
| cartes conservées pour en ouvrir une | **0 sur 40** |
| la carte ouverte | **1 881 px**, 14 champs de saisie |

Le coût n'est donc **pas** dans les trente-neuf autres cartes : il est dans la **mise en page de
la carte ouverte elle-même**. C'est le contenu que l'utilisateur vient de demander — il est
irréductible tant que la carte montre tout d'un coup.

### Et trois mesures ont menti avant de dire vrai

- Dupliquer le patient de démonstration donnait **28 000 caractères** de plateau et des temps qui
  ne ressemblaient à aucune tournée. *Un clone vide ne mesure rien* : il a fallu charger chaque
  dossier comme une vraie année — six soins au plan, 90 passages avec constantes, des documents.
- `openId = x; render()` n'ouvre **pas** la carte comme un appui : la mesure annonçait « la carte
  ouverte ne contient pas son formulaire ». Il faut cliquer la poignée.
- Et le chronomètre contenait sa propre remise à zéro, c'est-à-dire **un dessin complet de chaque
  côté**, qui noyait l'écart.

### Ce qui est fait

`cardOf` — la fabrique d'une carte — vivait en fermeture dans `render()`. Elle est conservée d'un
dessin à l'autre (`_cartePartielle`), et `renderCartesOuverture(clés)` refait **les deux cartes qui
changent** : celle qu'on referme, celle qu'on ouvre. Le câblage des gestes est sorti de `render()`
en `bindBoard()` — rebrancher quarante gestionnaires ne coûte ni analyse de HTML ni mise en page.

Le dessin partiel **rend `false`** dès qu'il n'est pas sûr (autre vue, carte introuvable, liste
périmée), et l'appelant refait le plateau entier : *le dessin complet reste la vérité.*

**Gain mesuré : 140 ms → 121 ms** sur le geste seul. Modeste, et c'est le chiffre honnête.

### Le filet, qui compte plus que le gain

`tests/navigateur/pw_carte_partielle.js` compare **caractère par caractère** le plateau obtenu par
le chemin partiel et par le chemin complet, sur huit patients plus la fermeture. *Un dessin
partiel qui irait vite en oubliant un coin de l'écran serait bien pire que le dessin complet qu'il
remplace.*

⚠️ Elle a attrapé huit écarts dès le premier essai — et **c'était elle qui se trompait** : elle
lisait le chemin complet après une image d'écran et le partiel aussitôt, alors que `bindInline`
pose sa classe un instant plus tard. Les deux côtés attendent désormais la même chose.

### Le dessin partiel a cassé 46 contrôles avant de passer

`CSS.escape` n'existe pas dans jsdom. Le geste d'ouverture levait donc une exception, la carte ne
s'ouvrait plus du tout, et **46 contrôles des 91 suites sont tombés d'un coup**. Les attributs
sont désormais comparés à la main, et un `try/catch` fait retomber sur le dessin complet au
moindre doute. *C'est précisément ce pour quoi la batterie existe : le défaut est apparu à la
minute où il a été introduit.*

### Ce qui reste, et pourquoi on s'arrête là

Les ~120 ms restants sont la carte ouverte. Les réduire voudrait dire **changer ce qu'elle
montre** — ne poser le formulaire qu'au moment où l'on y touche. **Arbitré : non.**

- Ces 121 ms sont mesurées sur un processeur **ralenti six fois** : sur l'appareil réel, l'ordre
  de grandeur est de 20 à 40 ms, sous le seuil où un geste se sent.
- Le gain se paierait d'**un appui de plus sur le geste le plus fréquent de la journée** — ouvrir
  une carte, c'est vouloir saisir le passage. Échanger un appui quotidien contre 120 ms une fois
  par carte est un mauvais marché.
- Et le chantier a déjà rendu ce qu'il pouvait rendre sans toucher à l'affichage.

*On optimise ce qui coûte sans rien enlever ; au-delà, c'est l'app qu'on change, et elle va bien.*

### Fichiers touchés

`www/js/ui.js` (`_cartePartielle`, `renderCartesOuverture`, `bindBoard`, le geste d'ouverture) ·
`tests/navigateur/pw_carte_partielle.js` (nouveau)

---

## v1.31.0 — trois fonctions qui marchaient sans porte

### Ce qui les a fait apparaître

Pas une relecture : **un compteur rendu lisible**. L'audit annonçait 28 fonctions mortes, 16
identifiants fantômes, 9 appels introuvables et 3 `data-*` muets — et les 9 appels étaient **faux
neuf fois sur neuf**. Un détecteur qui se trompe autant n'est plus lu, et c'est exactement ainsi
que la mort de `sheetBrouillonPour` avait caché une fuite entre dossiers pendant des mois.

| détecteur | avant | après | ce qui restait dessous |
|---|---|---|---|
| élément interactif muet | 3 | **0** | trois `div` décoratifs ; ne signale plus que les vrais boutons |
| `#id` fantôme | 16 | **0** relus | onze restes de l'ancienne barre, **un vrai perdu** |
| fonction morte | 28 | **0** relues | 24 vestiges, **3 fonctions complètes sans porte** |
| appelée mais introuvable | 9 | **0** | `new Event(…)`, `for…of`, un paramètre, un motif |
| asynchrone sans await | 69 | **22** | la suite du bloc englobant n'est pas la suite de l'appel |

Chaque détecteur est désormais **éprouvé par un défaut planté exprès** : s'il ne le voit pas, il
ne garde rien.

### Les trois

| | le défaut | où elle est rebranchée |
|---|---|---|
| `reprendrePEC` | On clôturait une prise en charge et on ne la rouvrait **jamais** : la liste n'offrait que « Ouvrir » et « Supprimer définitivement ». Un patient qui revenait devait être **recréé** | « 🎗️ Reprendre » dans la liste, **devant** « Ouvrir » et à distance du 🗑 |
| `voiceEffacer` | Le réglage proposait **« à la main »**, qui coupe la purge automatique — et aucune main n'existait : ni liste, ni bouton. Des enregistrements sur des patients, sur l'appareil, sans issue | La liste des notes conservées (date, durée, poids, ▶, 🗑) plus « Tout effacer maintenant » |
| `sheetBilanTournee` | 58 lignes — patients vus **et non vus**, alertes, rappels dus, bilans à faire — appelées de nulle part | Au bout du déroulé, sur l'écran « Tournée terminée ». Pas dans les réglages : *on n'y passe pas en tournée* |

### Et une temporisation qui n'était pas un fait

`exportBackup("share"); setTimeout(sheetTours, 900);` — à deux endroits. Or `exportBackup`
**commence par poser une question** (`await askDialog`) sur la confidentialité de la sauvegarde.

Mesuré, avant correction :

```
   à  400 ms — question posée : oui   écran : « 💾 Mes données »
   à 1200 ms — question posée : oui   écran : « Réglages »
```

On lisait l'avertissement pendant que l'app partait ailleurs. Et l'échec de l'export ne se disait
nulle part : on arrivait sur Réglages comme si tout allait bien. Désormais on suit le fait — la
navigation attend que l'export ait **abouti**, l'échec s'annonce, et **annulé, on reste où l'on
est** (`exportBackup` rend `false` sur annulation).

### Le ménage n'a pas eu lieu, et c'est délibéré

Deux tentatives de retirer les 23 fonctions mortes, deux compilations cassées :

- chaque module se termine par le mot-clé `function` qui complète la 1ʳᵉ ligne du suivant —
  retirer la **dernière** fonction d'un fichier emporte ce mot-clé ;
- la découpe « jusqu'à la ligne qui ne contient qu'une accolade fermante » se trompe dès qu'un
  gabarit en contient une : `sheetWelcome` (112 lignes) coupée à **32**, son corps laissé sans sa
  tête — **et la compilation passait quand même**.

184 lignes sur 34 000 ne valaient pas ce risque. L'app a été restaurée à l'identique, et les
fonctions sont **inventoriées** plutôt que supprimées : le compteur ne signale plus qu'une
nouveauté.

### Un petit perdu, noté

`aides-reset` n'existe plus : **aucun moyen de faire réapparaître les bulles d'aide** une fois
masquées.

### Ce qui garde la v1.31.0

`tests/navigateur/pw_lot3.js` — **10 contrôles**, dont **8 tombent** sur le `www/` de la v1.30.0.

### Fichiers touchés

`www/js/sheets.js` (bouton Reprendre + son gestionnaire, liste des notes vocales, les deux
exports) · `www/js/seq.js` (le bilan au bout du déroulé) · `www/js/storage.js` (`exportBackup`
rend `false` sur annulation) · `tests/audit/audit_gestes.js` (cinq détecteurs dégraissés et
éprouvés) · `tests/navigateur/pw_lot3.js` (nouveau)

---

## v1.30.0 — le 💾 n'apparaît que s'il a un état à montrer

### Ce qu'il a constaté

Capture à l'appui, écran **Réglages** : « *sur cet écran la disquette en haut à droite ne
fonctionne pas* ». Et une proposition : la retirer, ou y mettre une petite animation — cigale,
étoile.

### Elle n'était pas en panne

Réglages est un **menu** : on y entre, on en sort, rien n'y est jamais enregistré. La disquette
n'avait **aucun état à montrer**, et n'en aurait jamais eu. Mesuré sur les 42 modules :

| situation | écrans |
|---|---|
| le 💾 agit | **1** — la fiche patient, branchée en v1.28.0 |
| inerte, **mais un enregistrement existe en bas** | **14** |
| inerte, l'écran écrit au fil de la frappe | **35** |
| inerte, **aucun champ** — menu ou liste | **38** ← sa capture |

### Et il mentait

Mesuré sur « médicament perso » et « contact du cabinet », **formulaire rempli mais pas
enregistré** :

```
   dit : « 💾 ✓ »      titre : « Enregistré sur l'appareil »
```

Il répondait sur l'état du **dossier**, pas sur celui de l'**écran** — il rassurait exactement
quand une saisie pouvait se perdre. La seule source de vérité (`_sheetGarde`, la garde de sortie)
n'existait que sur un écran.

### Pourquoi pas une décoration

Un ornement aurait pris **la place d'un indicateur**. L'œil apprend que ce coin ne dit rien, et
deux écrans plus loin, en pleine saisie, le 💾 est le **seul** endroit qui dise « c'est passé » —
le témoin de la barre de titre étant recouvert par le voile dès qu'un panneau s'ouvre. Décorer les
menus aurait abîmé l'indicateur ailleurs. *Même raisonnement qu'en v1.28.0 : un bouton qu'on
touche pour rien apprend à être ignoré.*

Deux remarques venues de sa capture : 🦗 est **déjà** l'emblème de Réglages (« Tout est dans la
cigale »), trois centimètres sous la barre — et il veut dire Détente et les surprises cachées,
donc le premier réflexe aurait été de le toucher. Quant à l'étoile, elle allait avec son thème
« Croix du Sud » — et se serait retrouvée dépareillée sur les quatorze autres.

### Trois règles, toutes décidées sur le DOM

*Marquer 38 panneaux à la main, c'est laisser passer le trente-neuvième écrit demain — c'est
exactement ainsi que le cloisonnement des brouillons était mort (v1.29.0). La barre regarde donc
ce qu'elle surmonte.*

| règle | où |
|---|---|
| `majSaveVisible()` — le 💾 ne s'affiche que si un enregistrement est déclaré **ou** si le panneau a au moins un champ | `nav.js`, appelée depuis `openSheet` après le rendu |
| `sheetModifie()` — « modifié depuis l'ouverture », par comparaison avec l'instantané que le moteur de brouillon prend déjà | `sheets.js` ; `majSaveBtn` y recourt quand l'écran ne pose pas de garde |
| `_brBrancherEnregistrer()` — le 💾 reprend le bouton du bas | `sheets.js`, si le panneau a des champs **et** un seul `.btn-primary` dont le libellé dit « Enregistrer » ou « Valider » |

⚠️ **On reconnaît le bouton, on ne le devine pas.** Sans le filtre sur le libellé, le 💾 de l'écran
d'ordonnance aurait repris **« Produire le document »** — un document produit par surprise. Deux
écrans restent volontairement non branchés (« ✓ Utiliser pour ce document », « ✓ Créer
l'étiquette ») : l'ambiguïté se signale en ne branchant rien plutôt qu'en choisissant au hasard.

⚠️ **Le bouton se cherche au moment du clic**, pas à l'ouverture : l'écran pose son gestionnaire
*après* `openSheet`, et le capturer plus tôt n'aurait saisi qu'un bouton muet.

⚠️ **`style.display`, pas une classe** : `majBadges()` repose tout le `className` à chaque écriture
de fond et aurait emporté la classe avec lui. Le piège était déjà documenté en v1.28.0 pour le
libellé ; il valait aussi pour la visibilité.

⚠️ **« Sans fermer » n'est vrai que si l'écran le promet.** Quand le 💾 reprend le bouton du bas, il
fait ce que fait ce bouton — et plusieurs enchaînent sur un autre panneau. `_sheetSaveDelegue`
rend l'infobulle honnête : « Enregistrer », pas « Enregistrer sans fermer ».

### Un faux positif attrapé par la batterie

L'épreuve des médicaments est tombée : on tape « tahor » pour **filtrer** le catalogue, et le 💾
annonçait « Enregistrer ». Un champ de recherche n'est pas une saisie — et il partait même en
brouillon, pour être reproposé la fois suivante. `_brRecherche()` les écarte, du compte comme des
brouillons : `type="search"`, identifiant en `-q`/`-srch`, place-tenant qui dit « Chercher ».

C'est une **convention, donc faillible** : un champ de recherche nommé autrement se verrait au 💾
qui s'allume pour rien. L'épreuve garde les cas connus.

Conséquence mesurée sur `pw_brouillon` : « dispositifs » et « historique » n'ont plus aucun champ
à garder, donc **plus de clé du tout**. Les deux clés valent `null`, et le contrôle de
cloisonnement voyait « même clé » là où il ne s'était rien passé. L'assertion a été corrigée pour
garder le **fait** — aucune étiquette, aucun texte repris chez l'autre patient — plutôt que la
forme.

### Ce que ça ne sait pas voir

Un panneau **sans aucun champ** qui écrirait par ses seuls boutons perdrait son témoin. Qu'il
déclare son enregistrement par `sheetEnregistrer` et il le retrouve.

### Ce qui garde la v1.30.0

`tests/navigateur/pw_disquette.js` passe de 20 à **32 contrôles** : cinq menus où le 💾 doit
disparaître, quatre écrans de saisie où il doit rester, le mensonge qui ne doit plus se produire,
l'appel à l'action, **le bout en bout** (taper une note, toucher le 💾 du haut, la note existe) et
la prudence du filtre. **7 tombent** sur le `www/` de la v1.29.0.

### Fichiers touchés

`www/js/nav.js` (`majSaveVisible`, `_sheetSaveDelegue`, la vérité dans `majSaveBtn`) ·
`www/js/sheets.js` (`sheetModifie`, `_brOuverture`, `_brBoutonEnregistrer`,
`_brBrancherEnregistrer`, le badge vivant à la frappe) · `tests/navigateur/pw_disquette.js`

---

## v1.29.0 — le filet « brouillon d'écran », et un filet qui corrompait

### Ce qu'il a demandé

« *Je fais la chasse aux bugs, aux oublis, aux erreurs et m'assure que l'app est fiable et secure
à l'usage (pour ne pas perdre de données, devoir tout refaire une saisie etc...)* » — Lot 1 d'un
audit en trois lots.

### Le point de départ était faux

Le rapport de la v1.28.1 annonçait **quatre** écrans perdant une longue saisie : ordonnance,
courrier, **ma fiche**, DLU. Les deux affirmations étaient fausses, et la cause était dans la
mesure : la première sonde vérifiait si le texte restait dans un panneau **déjà fermé**, sans
rouvrir l'écran.

| | ce qui était écrit | ce que la mesure dit |
|---|---|---|
| nombre | quatre écrans | **seize** écrans de saisie |
| « ma fiche » | en perdait | **non** — elle écrit au fil de la frappe |
| bloc-notes | absent de la liste | **il perdait sa note** — manqué |

> *Une mesure qui ne voit pas ce qu'elle mesure ne dit rien.*

### Le filet

`sheets.js` — le moteur tient en une centaine de lignes et vit dans `openSheet`, donc sur **tous**
les panneaux : poser une garde écran par écran aurait laissé passer le onzième, écrit demain.

- une **empreinte** de l'écran sert de clé (les `id` de ses champs, ou les noms de ses attributs
  `data-*` pour les écrans en liste) ;
- la saisie est gardée **700 ms** après la dernière touche, dans `S.brouillons` ;
- à la réouverture, une étiquette **« saisie gardée »** propose *Reprendre* ou *Jeter* ;
- toucher le **bouton principal** consomme le brouillon : un brouillon qui survit à son écran est
  un piège ;
- au-delà de **7 jours**, purgé au démarrage.

### Quatre défauts dans le filet lui-même

| # | le défaut | ce qu'il coûtait |
|---|---|---|
| 1 | `brouillonForcer()` tournait depuis `_brInstaller`, donc **après** le remplacement de `#sheet.innerHTML` | il écrivait les champs du **nouvel** écran sous la clé de l'**ancien** : la saisie d'une ordonnance remplacée par `f-nom`/`f-prenom`/`f-dob`. L'étiquette s'affichait et ne restaurait rien |
| 2 | le moteur ne regardait que les champs portant un `id` | deux écrans entiers hors du filet : l'aide-mémoire (**17 champs**) et l'en-tête d'ordonnance (**8**) — du texte long, écrit à la main |
| 3 | le gestionnaire du bouton principal lisait `_brCle` **au moment du clic** | le bouton enchaîne souvent sur un autre panneau : il effaçait le brouillon de l'écran **suivant** et laissait celui qu'il devait consommer |
| 4 | la temporisation s'annulait quand on quittait l'écran | extrait en `_brEcrire(cle)` + `brouillonForcer()` sur les deux chemins de sortie |

Le n° 1 est le plus instructif : **une perte déguisée en filet est pire qu'une perte franche, elle
rassure.** L'épreuve garde désormais l'**ordre d'écriture** par la source — aucune mesure de
comportement ne distinguait « gardé avant » de « gardé après ».

### Le défaut le plus grave n'était pas une perte, c'était une fuite

`sheetBrouillonPour` — le mécanisme qui distingue les dossiers — **n'était appelé par personne**.
Documenté, branché sur rien. *Une fonction morte dont la mort est le défaut.*

Les identifiants de champs sont les mêmes pour tous les dossiers (`or-nom`, `f-nom`,
`dlu-auto-txt`…). L'empreinte d'écran qui sert de clé était donc **identique d'un patient à
l'autre**. Mesuré sur les neuf écrans liés à un dossier :

| | avant | après |
|---|---|---|
| même clé pour deux patients | **9 / 9** | 0 / 9 |
| étiquette proposée chez l'autre | **9 / 9** | 0 / 9 |
| **texte repris chez l'autre** | **9 / 9** | 0 / 9 |

Une donnée d'un dossier qui apparaît dans un autre — nom, date de naissance, adresse.

**Le dossier est porté par le panneau, pas par un appel consommé à l'ouverture.** Plusieurs de
ces écrans se redessinent à chaque frappe (`draw()` rappelle `openSheet`) : un marqueur consommé
une seule fois se serait perdu au premier redessin, et la clé aurait changé **en pleine saisie**.
D'où `brDossier(ref)`, un `<span hidden data-dossier>` dans le gabarit, et `_brDossierCourant()`
qui le lit dans le DOM.

**22 panneaux cloisonnés, pas 9.** Les treize autres ne fuyaient pas *dans les conditions
mesurées* — les marquer fait disparaître la classe entière plutôt que les cas observés.

**L'axe n'est pas toujours le patient.** Pour « modifier un modèle de document », c'est le
**modèle** : le brouillon du modèle A se proposait en modifiant le modèle B, mêmes identifiants de
champs. Même défaut, autre axe. Et son brouillon doit au contraire revenir *quel que soit* le
patient d'où l'on vient — ce que l'épreuve vérifie dans les deux sens.

Détecteur ⑦ pour le vingt-troisième panneau, celui qui sera écrit demain : un panneau qui va
chercher un patient (`getP(`), ouvre un gabarit **et contient un champ de saisie** doit y poser
`brDossier(...)`. Resserré deux fois — il signalait d'abord 24 panneaux dont la plupart ne font que
*lire* un dossier, puis les panneaux sans aucun champ : *du bruit qui aurait fini par faire
ignorer les vrais.*

### Trois défauts de perte de données hors du filet

| module | le défaut | correction |
|---|---|---|
| `storage.js` | la migration des documents faisait `idbSet(...).catch(()=>{})` puis `delete d.data` **sur la ligne suivante** : au moment du `delete`, l'écriture n'avait pas commencé. Échec ⇒ **contenu détruit en silence**. Tourne à chaque démarrage | le contenu n'est retiré que dans le `.then()` ; en cas d'échec il **reste** dans le dossier et la tentative est reprise |
| `sync.js` | `try { idbSet(...) } catch(e){}` **n'attrapait rien** : `idbSet` rend une promesse, le bloc est déjà sorti quand le refus arrive. Un document reçu figurait au dossier **sans contenu** | la ligne n'est ajoutée qu'une fois l'écriture confirmée, l'échec est annoncé |
| `sync.js` | `JSON.parse(buildSyncFile(...))` — le seul parse du code sans aucun filet, dans une fonction `async` : l'exception ne remontait nulle part et le partage s'arrêtait **sans un mot** | garde + message, partage interrompu proprement |
| `modeles.js` | `docModele(cle)` rend `null` hors catalogue, et l'appelant déréférençait | garde + « Modèle introuvable » |

### Les analyseurs se sont trompés aussi

- Le détecteur des parses nus en annonçait **2** ; il en blanchissait **26** à tort, en comptant
  les `try` dans une fenêtre de 400 caractères.
- **Trois** tentatives de marche sur les accolades ont échoué. La cause mérite d'être écrite :
  **chaque module finit par le mot-clé `function` qui complète la 1ʳᵉ ligne du suivant**, donc un
  module *seul* n'a pas ses accolades équilibrées — solde mesuré de **−3 à +6**. Même sur le
  programme assemblé, les gabarits imbriqués débordent le blanchisseur. Pour **28** occurrences,
  écrire un analyseur lexical JS à la main ne se justifie pas : on inventorie, on relit une fois,
  et le détecteur garde l'inventaire.
- Le détecteur des échecs avalés signalait sa **propre documentation** : le défaut corrigé est
  cité mot pour mot dans le commentaire qui l'explique. (Déjà rencontré au détecteur ①.)
- Il **mélangeait deux familles** : 30 alertes dont **2** seulement faisaient perdre du travail.
  Noyées dans 28 bénignes, elles sont restées là des mois. Séparées : ④ (contenu perdu) doit rester
  à **zéro**, ⑥ (effacements et drapeaux) est un inventaire compté par module.

> *Chaque détecteur est désormais éprouvé par un défaut planté exprès : s'il ne le voit pas, il ne
> garde rien.*

### Six contrôles d'épreuve qui mentaient

Les 91 suites ont sorti 6 échecs. Aucun ne venait des changements du jour (mêmes 6 sur la v1.28.1).
**Aucun n'était un défaut de l'app.**

| le contrôle | pourquoi il tombait |
|---|---|
| code de secours (4 contrôles) | `const S = B.getS()` est capturé **une fois** ; la reprise par code de secours recharge le dossier depuis le coffre, donc **remplace** l'objet. L'épreuve interrogeait un objet mort où l'ancien code figurait encore. Mesuré : `même objet = non`, `S.pin = vrai`, **état vivant = faux** |
| « ancien code à 4 chiffres » | la longueur attendue vaut `_coffreLen \|\| S.pinLen \|\| 4` : dès qu'un coffre existe, **sa** longueur fait foi — le bon arbitrage. Le coffre à 6 chiffres du scénario précédent imposait 6 points. Le scénario a été **déplacé avant** la création du coffre |
| « Menu : 11 tuiles » | le menu en pose **14**. Un compte figé casse à chaque ajout : le besoin gardé est qu'aucune **rubrique** ne disparaisse |
| « À prévenir » manquant | ce n'est plus un champ unique (`f-pap-nom`) mais une **marque** posée sur n'importe quel contact de l'entourage — on peut en désigner plusieurs |

> *Garder le besoin, pas la mise en page.*

### Ce qui garde la v1.29.0

| | |
|---|---|
| `tests/navigateur/pw_brouillon.js` | **58 contrôles** — 16 écrans × 2, l'ordre d'écriture, la consommation par le bouton principal, le cloisonnement par dossier sur 14 écrans, l'axe du modèle dans les deux sens, la purge à 7 jours. **36 tombent** sur le `www/` de la v1.28.1 |
| `tests/audit/audit_fiabilite.js` | ④ et ⑥ scindés, ③ remplacé par un inventaire relu, détecteurs éprouvés par témoins plantés |
| 91 suites statiques | 0 échec (3 épreuves corrigées : état vivant, rubriques du menu, marque « À prévenir ») |

### Fichiers touchés

`www/js/sheets.js` (moteur + `openSheet`) · `www/js/storage.js` (casier `S.brouillons`, migration des
documents, `_migDocsSave`) · `www/js/sync.js` (document reçu, parse du partage) ·
`www/js/modeles.js` (garde) · `www/js/init.js` (purge) · `www/css/app.css` (`.br-prop`) ·
`tests/navigateur/pw_brouillon.js` (nouveau) · `tests/audit/audit_fiabilite.js` ·
`tests/_test_affichages.js` · `tests/_test_nonregression.js` · `tests/_test_onglets.js`

---

## v1.28.1 — un bouton dans un bouton cassait la carte patient

### Ce qu'il a constaté

« *Parfois sur une carte patient avec une pastille incomplète, si je clique sur la carte patient
l'affichage bug.* » Avec une capture : le contenu de la carte tassé dans la moitié droite, un
grand cadre vide, et plus de formulaire.

### Ce n'était pas la pastille

Balayage des cinq statuts (à voir · vu · vigilance · sans passage · absent), des quinze thèmes et
de tous les réglages d'affichage — **rien**. La variable était ailleurs : **la saisie gardée**.
Sur sa capture, l'étiquette « 💾 saisie gardée le 18 oct. » est juste là, sous le nom.

Mesuré, carte ouverte, même patient, à la seule différence d'un brouillon en attente :

| | enfants de la carte | formulaire | hauteur |
|---|---|---|---|
| sans brouillon | `span.st` · `button` · **`div.inline`** | ✅ | **1 779 px** |
| avec brouillon | `span.st` · `button` · `button.mini` · 3 × `span.mini` | ❌ | **189 px** |

### La cause : un `<button>` dans un `<button>`

L'étiquette « 💾 saisie gardée » était un `<button>` posé **à l'intérieur** du
`<button data-toggle>` de la carte, ouvert dix lignes plus haut. Ce n'est pas du HTML valide, et
l'analyseur ne pardonne pas : il **referme le bouton extérieur** en rencontrant l'intérieur, et
tout ce qui suit change de parent — le reste des badges, la dernière ligne, et **le formulaire
lui-même**, qui se retrouve hors de la carte.

⚠️ **ET LA LEÇON ÉTAIT DÉJÀ ÉCRITE DANS `ui.js`, VINGT LIGNES PLUS BAS**, pour le 📞 et le 📍 :
« *un bouton dans un bouton n'est pas du HTML valide, et sur Android le toucher partait au mauvais
des deux* ». Le même piège, repris par un autre chemin, dans le même fichier. Un commentaire ne
protège que la ligne qu'il garde.

Corrigé en `<span>`, comme tous les autres badges de cette rangée. Le geste ne change pas : son
gestionnaire portait déjà `stopPropagation`.

### L'épreuve qui n'aurait rien gardé

Premier jet de l'invariant : « aucun `<button>` à l'intérieur du bouton de la carte », interrogé
avec `querySelectorAll`. **Il passait sur les deux versions.**

⚠️ **PARCE QUE L'IMBRICATION N'EST JAMAIS DANS LE DOM.** Au moment où l'épreuve regarde,
l'analyseur a déjà « réparé » l'arbre en refermant le bouton extérieur — il ne reste aucun bouton
imbriqué à trouver. Ce qui est observable, c'est le **dégât**, pas la faute.

L'épreuve compare donc la **forme de la carte** — ses enfants, les enfants de son bouton, la
présence du formulaire — à celle de la carte la plus nue, dans **onze états**. Sur la v1.28.0,
**six des onze** divergent : exactement ceux qui portent un brouillon.

⚠️ **ET LES HAUTEURS SONT COMPARÉES, PAS ABSOLUES** : une hauteur de carte dépend du thème, du
zoom et des réglages. Ce qui est gardé, c'est que la carte avec brouillon ressemble à la carte
sans brouillon.

### Fichiers touchés

| Fichier | Quoi |
|---|---|
| `www/js/ui.js` | l'étiquette « saisie gardée » devient un `<span>` |
| `tests/navigateur/pw_carte_brouillon.js` | 21 contrôles — **11 tombent** sur le `www/` de la v1.28.0 |

## v1.28.0 — le 💾 du haut enregistre, et on reste

### Ce qu'il a constaté

« *Quand je suis sur la fiche d'un patient, en haut j'ai la petite disquette, mais si je clique
dessus rien ne se passe. Ça devrait avoir la même proposition d'action que « Enregistrer » qui se
situe tout en bas de la même fiche.* »

### Mesuré avant de décider

| | |
|---|---|
| Ce qu'était le 💾 | un `<span>` de **21 × 33 px**, sans gestionnaire de clic |
| Son infobulle | « État de l'enregistrement » — il le disait, en fait |
| Distance jusqu'au bouton « ✓ Enregistrer » | **1 765 px** |

⚠️ **C'EST CE DERNIER CHIFFRE QUI FONDE LA DEMANDE** : près de deux écrans de défilement pour
atteindre le bouton, puis autant pour remonter. Le même voyage que celui supprimé dans le déroulé
en v1.26.0.

### Enregistrer sans fermer — l'arbitrage, et pourquoi pas la demande littérale

Trois maquettes : **A** enregistre et on reste · **B** fait exactement comme le bouton du bas ·
**C** laisse le témoin tranquille et ajoute un bouton qui n'apparaît que quand il y a à
enregistrer. **A** retenu.

⚠️ **LE BOUTON DU BAS NE FAIT PAS QU'ENREGISTRER : IL FERME LA FICHE.** Lui faire faire exactement
la même chose depuis le haut aurait économisé le défilement puis renvoyé au plateau — alors que
toucher le 💾 au milieu du remplissage, c'est vouloir **sécuriser sa saisie et continuer**. On
aurait rendu les 1 765 px aussitôt reperdus. La demande littérale n'était pas le besoin.

### Il n'appelle à l'action que quand il y a quelque chose à faire

| État de la fiche | Le 💾 |
|---|---|
| Rien en attente | témoin discret, `💾` / `💾 ✓`, 34 px |
| Une modification en attente | **`💾 Enregistrer`** en plein accent, 103 px de large |

⚠️ Un bouton d'appel présent en permanence, qu'on touche pour rien neuf fois sur dix, **apprend à
être ignoré** — et le jour où il compte, il l'est aussi.

⚠️ **« EN ATTENTE » SE LIT SUR LA GARDE DE SORTIE**, qui sait déjà si l'écran a été modifié. Une
seconde source se serait désynchronisée de la première au premier écran qui l'oublie.

### Deux pièges, dont un que j'allais créer

⚠️ **`majBadges()` REPOSE TOUT LE LIBELLÉ DU TÉMOIN** à chaque écriture de fond — c'est-à-dire sans
arrêt. Un bouton dont le texte est réécrit redevient un témoin muet dans la seconde. L'état part
désormais dans `dataset.etat` et c'est `majSaveBtn()` qui décide quoi afficher.

⚠️ **LA GARDE DE SORTIE ÉTAIT POSÉE À `null` EN ENREGISTRANT.** Sans conséquence tant
qu'enregistrer fermait la fiche — mais le 💾 du haut enregistre et on **reste** : une saisie faite
après lui serait repartie sans un mot. Elle est maintenant rassasiée (`_sale = false`) plutôt que
désarmée.

### Et ailleurs : le témoin reste un témoin

Le 💾 est posé dans la barre de **tous** les panneaux, et la plupart écrivent au fur et à mesure.
Seul un écran qui a quelque chose à valider déclare son action avec `sheetEnregistrer(fn)` ;
`openSheet` et `closeSheet` la remettent à zéro, sans quoi le bouton d'un écran aurait enregistré
la fiche d'un patient depuis un écran sans rapport.

⚠️ **ET LE `cursor:pointer` A ÉTÉ RETIRÉ DU TÉMOIN.** Il annonçait un clic auquel il ne répondait
pas : c'est exactement la promesse qu'on vient de réparer, il ne faut pas la laisser là où elle
reste fausse.

### Fichiers touchés

| Fichier | Quoi |
|---|---|
| `www/js/nav.js` | le témoin devient un `<button>` ; `sheetEnregistrer()`, `majSaveBtn()` |
| `www/js/storage.js` | `majBadges()` ne réécrit plus le libellé d'un témoin devenu bouton |
| `www/js/sheets.js` | `openSheet`/`closeSheet` remettent l'action à zéro ; la fiche déclare la sienne ; la garde de sortie reste armée après un enregistrement |
| `www/css/app.css` | `.save-badge.act` et `.act.att` ; plus de `cursor:pointer` sur le témoin |
| `tests/navigateur/pw_disquette.js` | 20 contrôles — **9 tombent** sur le `www/` de la v1.27.1 |

## v1.27.1 — les lignes du listing s'ouvrent, dans toutes les vues

### Ce qu'il a constaté

« *Quand je suis sur la page principale et que j'ai la visualisation de mes cartes patients, si je
mets liste, mon patient n'est pas cliquable et je peux pas ouvrir sa fiche.* »

### Mesuré : six lignes affichées, zéro écoutée

Tournée à créneaux, **vue Journée**, mode Liste :

| | lignes dessinées | lignes écoutées | clic |
|---|---|---|---|
| Sans créneaux | 3 | 3 | ✓ la fiche s'ouvre |
| Créneau du matin | 3 | 3 | ✓ |
| **Vue Journée** | **6** | **0** | **✗ rien** |
| Toutes les tournées | 3 | 3 | ✓ |

⚠️ **UN SEUL CROISEMENT ÉTAIT CASSÉ**, et c'est ce qui l'a rendu invisible si longtemps : trois
des quatre situations marchaient.

### La cause : un gestionnaire enfermé dans une branche

`render()` a trois branches de plateau — vue Journée (sections par créneau), listing simple, et
cartes. La vue Journée et le listing simple dessinent tous deux leurs lignes avec **la même
fonction** `listeDe()`, donc les mêmes boutons `data-pli`. Mais le gestionnaire de clic était
attaché **à l'intérieur** de la branche du listing simple. En vue Journée, les lignes existaient,
avaient la bonne apparence, portaient leur clé — et personne ne les écoutait.

Il est remonté là où vivent les autres gestes indépendants de la vue (`data-cann`, `data-cgps`,
`data-toggle`, `data-mute`), en fin de `render()`.

⚠️ **CE QUI RENDAIT LE DÉFAUT SI DÉROUTANT** : le 📞 posé sur la même ligne, lui, répondait — son
gestionnaire était déjà au bon endroit. Une ligne dont l'icône répond et dont le nom ne répond pas
se lit comme une panne de l'appareil, pas comme un oubli de branchement.

### L'épreuve clique, elle ne compte pas les gestionnaires

Un contrôle « les lignes ont un `onclick` » serait resté vert le jour où le gestionnaire existe
mais pointe à côté. `pw_liste_clic` **clique pour de bon** et regarde si la fiche s'ouvre — dans
les **quatre** croisements vue × tournée, pas seulement celui qui était cassé. C'est le croisement
qui avait laissé passer le trou.

⚠️ **ET UN CONTRÔLE A ACCUSÉ L'APPLICATION À TORT.** « La vue Cartes ouvre toujours la fiche »
tombait : le gestionnaire des cartes vit sur un **enfant** (`[data-toggle]`), et un `.click()`
appelé sur le conteneur ne l'atteint pas. Un doigt, lui, touche l'enfant. L'épreuve clique
désormais comme un doigt.

### Fichiers touchés

| Fichier | Quoi |
|---|---|
| `www/js/ui.js` | le gestionnaire `data-pli` remonté hors de la branche du listing |
| `tests/navigateur/pw_liste_clic.js` | 17 contrôles — **2 tombent** sur le `www/` de la v1.27.0, les 15 autres passent sur les deux et c'est leur rôle |

## v1.27.0 — le déroulé liste des passages, plus des patients

### Ce qu'il a demandé

« *Dans le déroulé, quand j'ai un deuxième passage pour un patient, ce dernier ne s'affiche pas
dans le déroulé, mais uniquement sur la carte des patients. Du coup c'est pas très pratique.* »

### Mesuré avant de toucher à quoi que ce soit

Tournée de trois patients dont un à passage supplémentaire :

| | Ce qui est listé | Compteur |
|---|---|---|
| **Plateau de cartes** | 4 passages — `p1`, **`p1#2`**, `p2`, `p3` | « 4 à voir » |
| **Déroulé** | 3 patients — `p1`, `p2`, `p3` | « Patient 2 / 3 » |

⚠️ **IL N'Y AVAIT RIEN À INVENTER, IL Y AVAIT À BRANCHER.** `occurrencesTriees`, `visiteDuRang`,
`statusOf(p, slot, rang)`, `cleOcc`, et jusqu'aux pastilles « 1ᵉʳ / 2ᵉ passage » existaient déjà et
servaient au plateau depuis l'arrivée du passage supplémentaire. Le déroulé, lui, partait de
`activeP()` — des **dossiers** — et n'avait jamais été branché dessus.

`seqPool` contient désormais des **occurrences** `{p, rang, cle, multi}`. Le premier contrôle de
l'épreuve n'est pas un comptage mais une **égalité** : déroulé et plateau listent la même chose,
dans le même ordre. Deux listes construites séparément finissent par diverger — c'est précisément
ce qui était arrivé.

### Le vrai travail : tout ce qui demandait « vu ? » au dossier

Le branchement de la liste n'était que le début. Chaque endroit qui demandait *« ce patient a-t-il
été vu aujourd'hui ? »* devait demander *« CE RANG-LÀ a-t-il été fait ? »* — sans quoi il annonce
fait ce qui reste à faire :

| Ce qui lisait le dossier | Ce que ça donnait sur le 2ᵉ rang |
|---|---|
| Le bouton de validation | « ✓ Passage enregistré — modifier » dès le 1ᵉʳ validé — **il invitait à modifier le passage du matin en croyant saisir celui du soir** |
| Les pastilles de progression | Le 2ᵉ passage s'allumait « vu » : barre annonçant une tournée finie alors qu'il fallait y retourner le soir |
| La garde de « pas de passage » | « Tu es déjà passé aujourd'hui » le soir, alors que le soir restait à faire — une garde qui crie à tort est une garde qu'on apprend à écarter d'un geste, et le jour où elle a raison elle est écartée aussi |
| Le drapeau `S.noVisit` | Rangé par dossier : « pas de 2ᵉ passage » aurait effacé le 1ᵉʳ |
| La position mémorisée | Quittée au 2ᵉ rang, la reprise ramenait au 1ᵉʳ |

⚠️ **LA CLÉ DU RANG 1 RESTE L'IDENTIFIANT NU.** `cleOcc` ne suffixe qu'à partir du rang 2, donc
`S.noVisit`, `S.seqPos` et le journal d'annulation **relisent les données d'avant sans migration**.
Une position enregistrée par une version antérieure n'a pas de `cle` : on retombe sur `pid`, ce qui
est l'ancien comportement exactement.

⚠️ **ET `statusOf` AVAIT UN SECOND DÉFAUT** : sa condition « drapeau valable seulement si aucun
passage ce jour » rendait le drapeau du 2ᵉ rang **inopérant dès que le 1ᵉʳ était fait**. Elle
regarde désormais le passage de CE rang.

### Le rappel du passage précédent — maquette B

Son arbitrage, entre un rappel dans la barre collée (C) et un rappel en tête de formulaire (B) :
**B**. Le rappel se lit une fois en arrivant chez le patient ; dans la barre il aurait coûté de la
hauteur pendant toute la saisie, et la barre venait d'être ramenée à 80 px en v1.26.0.

Déplié par défaut — *une information cachée derrière un geste n'est pas une information* — et le
pli est retenu pour qui le trouve de trop. Il ne s'affiche que s'il a quelque chose à dire : rien
sur le 1ᵉʳ rang, rien sur un 2ᵉ dont le premier n'a pas encore eu lieu.

### L'épreuve qui passait sur les deux versions, donc ne gardait rien

⚠️ Premier jet de la section « valider le 2ᵉ passage » : **verte sur le code d'avant**. Avec
`i2 = -1`, la navigation était sans effet, le second passage se saisissait depuis l'entrée du 1ᵉʳ —
et il se créait quand même, parce que `commitVisit` acceptait déjà deux passages tant qu'il restait
un rang à remplir. **Ce qui manquait n'était pas la création, c'était le chemin.** La section
vérifie maintenant qu'on est bien sur le rang 2 avant de valider.

⚠️ Et l'épreuve **plantait** sur le code d'avant au lieu de tomber : `seqIdx = -1` faisait jeter
l'ancien `renderSeq`, et les trente contrôles suivants ne disaient plus rien. Un `pg.click` sur un
rappel absent attendait trente secondes puis jetait aussi. Index hors liste refusé, présence
vérifiée avant de cliquer.

### Fichiers touchés

| Fichier | Quoi |
|---|---|
| `www/js/seq.js` | `seqPool` en occurrences ; `seqOcc`, `seqPatient`, `seqPatientsDuPool`, `seqVisiteOcc`, `seqVuOcc`, `seqCleOcc`, `seqSansPassage`, `seqRappelHtml`, `seqRappelPlie` ; barre, pastilles, compteur, bouton de validation, garde et drapeau de « pas de passage », position mémorisée |
| `www/js/ui.js` | `statusOf` lit le drapeau et le passage **par rang** |
| `www/js/globals.js` | l'annulation d'un « pas de passage » défait la clé posée, pas le dossier |
| `www/css/app.css` | `.sqr*` (le rappel), pastilles jumelées `duo`, pastille de rang dans la barre |
| `tests/navigateur/pw_sup_deroule.js` | 39 contrôles — **28 tombent** sur le `www/` de la v1.26.0 |

## v1.26.0 — la barre du déroulé colle enfin, et une ligne qui tuait `position:sticky`

### Ce qu'il a demandé

« *Je souhaiterais que la barre de navigation contenant « Patient suivant », « Patient précédent »
et « Valider le passage » reste fixée en haut de l'écran pendant la saisie. Actuellement, lorsque
je descends dans la page pour remplir les constantes, je dois remonter verticalement pour valider
et passer au suivant. Si je remonte trop haut, j'atteins le sommet de l'application.* »

### Tout était déjà écrit. Rien ne marchait.

`position:sticky; top:0` était dans la feuille de style **depuis des mois**, avec un commentaire
affirmant « elle reste maintenant collée en haut ». Une classe `.compact`, son écouteur de
défilement, une sentinelle, un second bouton de validation dans la barre, et des commentaires
chiffrés sur la hauteur gagnée — tout l'appareillage de la fonctionnalité B était là.

**Mesuré : après 850 px de défilement, la barre se trouvait à −71 px — exactement sa position
naturelle. Elle n'avait jamais collé.** À 1400 px elle était à −621 px, hors écran, et « Valider »
injoignable : la plainte exacte, reproduite au pixel.

⚠️ **LA CAUSE TIENT EN UNE LIGNE, ET ELLE ÉTAIT EN DOUBLE.**

```css
html{overflow-x:hidden}
body{… overflow-x:hidden …}   ← celle-ci
```

Une valeur d'`overflow` autre que `visible` fait du `body` un **conteneur de défilement** à part
entière. Or un élément collé se colle au bord de *son* conteneur de défilement le plus proche — et
ce n'est pas le `body` qui défile ici, c'est `html`. La boîte de référence ne bougeait jamais.
`overflow-x:hidden` sur `html` suffit, et il était déjà là : largeur du document relevée
**identique au pixel près** sur les quinze thèmes, décors compris, dans le déroulé et en dehors.

⚠️ **PIÈGE DE DIAGNOSTIC** : `body{overflow-y:visible}` seul ne corrige rien. Quand un axe vaut
`visible` et l'autre non, le premier **calcule en `auto`** — le body reste un conteneur de
défilement. Il faut les deux axes, ou retirer la déclaration.

⚠️ **ET `.wrap` PORTE LE MÊME `overflow-x:hidden`.** Tout ce qui vit dedans ne peut toujours pas se
coller. `#seq-mode` vit dehors, d'où un correctif qui suffit ici — à reprendre le jour où un écran
ordinaire voudra une barre collée.

### Une règle CSS n'est pas un comportement

C'est la leçon de cette version. Un contrôle du genre « `.seq-nav` a bien `position:sticky` »
serait resté **vert pendant tous les mois où la barre ne collait pas**. L'épreuve défile pour de
bon et relève où la barre se trouve, à quatre hauteurs, puis tout en bas du formulaire.

Et le contrôle porte sur ce qui a été demandé — *« que ce bandeau reste visible en permanence »* —
pas sur `top:0` : tant que la barre n'a pas atteint le haut, elle est encore dans le flux et c'est
très bien ainsi. Ce qui est gardé, c'est qu'elle soit **entièrement dans l'écran à chaque
instant**. Premier jet du contrôle écrit en `top >= 0`, tombé sur le code neuf : il décrivait une
mise en page, pas un besoin.

### Ce que le resserrement garde, et ce qu'il rend

Mesuré sur un écran de 930 px : **131 px pleine, 80 px resserrée — 9 % de l'écran**, mieux que les
92 px annoncés en maquette.

| | pleine | resserrée |
|---|---|---|
| Flèches Préc. / Suiv. | 64 px avec libellé | 44 px, flèche seule |
| Nom du patient | 18 px, ligne propre | 15 px, avec le compteur à côté |
| Compteur | « Patient 10 / 10 » | « 10 / 10 » |
| Pastilles de progression | 5 px | **3 px — conservées** |
| ✓ Valider le passage | pleine largeur | pleine largeur, plus bas |

⚠️ **LES PASTILLES SONT REVENUES.** L'ancien `.compact` les masquait pour gagner de la hauteur.
Elles ne coûtent que 3 px, et ce sont elles qui disent combien de patients restent — au moment
précis où l'on a le nez dans un formulaire.

⚠️ **LA SENTINELLE A ÉTÉ DÉPLACÉE CONTRE LA BARRE.** Au sommet de `#seq-mode`, elle sortait de
l'écran *avant* la barre : le resserrement se déclenchait pendant que la barre descendait encore.
Placée juste au-dessus, « sentinelle sortie » et « barre collée » sont le même instant — ce qui
permet au point suivant de fonctionner.

### La barre d'état du téléphone, encore

Collée à `top:0`, la barre passerait sous l'heure et la batterie. `top:var(--sbtop)` laisserait
au-dessus d'elle une bande où le contenu défilerait à nu. La réserve est donc posée **en padding
sur l'état resserré** : c'est le fond de la barre qui couvre la bande, et le contenu passe
derrière. Et comme `.compact` et « collée » coïncident désormais, cette réserve n'apparaît jamais
pendant que la barre est encore dans le flux. Relevé : réserve déclarée à 44 px → premier bouton à
50 px ; réserve automatique sur un appareil qui ne déclare rien → aucune place perdue.

### Fichiers touchés

| Fichier | Quoi |
|---|---|
| `www/css/app.css` | `overflow-x:hidden` retiré du `body` ; `.seq-nav.compact` refait (réserve de barre d'état en padding, pastilles conservées, nom et compteur sur une ligne) |
| `www/js/seq.js` | `#sq-sentinel` déplacé contre la barre ; « Patient » isolé dans `.sq-pos-l` pour tomber en resserré |
| `tests/navigateur/pw_barre_seq.js` | 22 contrôles — **10 tombent** sur le `www/` de la v1.25.0 |

## v1.25.0 — les colonnes de la feuille se composent

### Ce qu'il a demandé

« *Sur les feuilles que je laisse au domicile, est-ce que je pourrais changer le nom d'une colonne
à la volée ? Par exemple, à la place de douleur, mettre poids, parce que chez cette personne, elle
n'évalue pas la douleur. Et plutôt qu'avoir deux feuilles, tout mettre sur la même.* » Puis, après
les maquettes : « *je veux aussi le choix d'en supprimer si j'en ai pas besoin, histoire d'avoir de
la place pour une meilleure lisibilité.* »

### Pourquoi c'est l'une des nouveautés les moins risquées du dépôt

Ces feuilles sont des **formulaires vierges remplis au stylo** au domicile : l'application n'en
relit **aucune valeur**. Un en-tête de colonne n'est donc que du texte imprimé. Renommer une
colonne ne touche ni aux seuils de vigilance, ni aux tendances, ni au classeur — qui continuent de
travailler sur les données saisies *dans* l'application. Aucun risque qu'une valeur saisie passe
pour une autre.

### L'invariant, et c'est le contrôle le plus important de l'épreuve

**Une fiche où rien n'a été composé sort la feuille d'avant, mot pour mot** — largeurs
`6/11/9/9/8/9/36/12`, et l'unité affichée sur la **seule** colonne de la douleur (détail qu'on
aurait manqué en reconstruisant l'en-tête « proprement » : les quatre autres constantes n'en
montraient aucune). `FCOL_DEFAUT` reproduit exactement l'ancien en-tête, et `pw_colonnes`
compare la chaîne produite à celle recopiée de la v1.24.0. Ces contrôles passent sur les **deux**
versions : c'est le seul dont l'échec signifierait une régression chez les quarante dossiers
existants.

### La place rendue ne va pas qu'aux observations — l'erreur de la première maquette

Première maquette : on retirait une colonne et seule celle des observations s'allongeait. C'était
rater la demande, qui parlait de **lisibilité** — donc de la largeur des cases où l'on écrit à la
main. D'où le facteur `f` de `fcolLargeurs()` : les mesures gardent leurs proportions entre elles
et **grossissent toutes ensemble**, jusqu'à 2,1 fois.

Mesuré en pixels rendus, tableau à la largeur d'une A4 (733 px) :

| Mesures retenues | case « Pouls » | observations |
|---|---|---|
| 6 | 66 px | 198 px |
| 5 (le défaut) | 66 px | **identique à avant** |
| 3 | 105 px | 264 px |
| 2, sans initiales | 138 px | 381 px |

⚠️ **LES DEUX PLUS GROSSES COLONNES SONT LES FIXES**, pas les mesures : observations 36 %,
initiales 12 %. Elles sont donc facultatives elles aussi — chez un patient où il passe seul,
retirer les initiales rend plus de place que n'importe quelle mesure supprimée. Le **plancher des
observations l'emporte sur le facteur** : 22 % de la largeur, sinon une phrase manuscrite n'y tient
plus ; si le compte ne tombe pas, ce sont les mesures qui cèdent.

⚠️ **SIX MESURES AU MAXIMUM**, et c'est ce plafond qui garantit que `fcolLargeurs()` n'a jamais à
rogner sous ce plancher — le pire cas possible (6 mesures, initiales gardées) laisse 27 %, relevé
sur les 408 compositions balayées (1 à 6 mesures × les deux colonnes fixes × la colonne du jour).

### Seule la feuille des constantes se compose

Celle du poids a des **dates libres** et sa courbe, celle des glycémies **trois moments par jour
sur deux rangs d'en-tête**. Les fondre ici leur ferait perdre ça : une colonne « Glyc. » sur la
feuille composée ne vaut que pour une mesure quotidienne. L'entrée « Composer les colonnes »
n'apparaît donc que sur les constantes — la proposer ailleurs promettrait quelque chose qui
n'existe pas, et `pw_colonnes` le garde dans les deux sens.

### Les unités : choisies, libres, ou absentes

`FCOL_MES` porte pour chaque mesure les unités qui ont un sens (TA en cmHg ou mmHg, glycémie en
g/L, mmol/L ou mg/dL, diurèse en mL ou L, douleur en /10, EVA ou EN…), plus deux lignes
systématiques : **sans unité** — l'en-tête tient alors sur un seul rang — et **la mienne…**, un
champ libre. La colonne libre a son nom *et* son unité libres, tous deux facultatifs, et peut se
répéter.

⚠️ **LE NOM DE LA COLONNE LIBRE EST ÉCHAPPÉ.** Il vient d'un champ de saisie et part dans une
feuille HTML : un `<` non échappé casserait la page entière, un `&` la mise en page. Contrôlé avec
`<b>Pl&ies</b>`.

### Deux pièges déjà connus, retombés dedans quand même

⚠️ **UNE APOSTROPHE INVERSE DANS UN COMMENTAIRE CSS, à l'intérieur d'un gabarit de chaîne** — le
module ne compilait plus. Exactement le même incident qu'en v1.24.0 ; le commentaire citait un
sélecteur entre apostrophes inverses.

⚠️ **UN GABARIT INTERNE NON REFERMÉ** : `Missing } in template expression`. Trois niveaux
d'imbrication (`${ … ? "" : ` … ${ … } … ` }`) et la backtick de fermeture oubliée. Dans les deux
cas, `node build.js` l'a dit tout de suite — c'est la seule mesure qui fasse foi sur un module
volontairement incomplet.

### La mesure du contraste regardait le mauvais fond

Le contrôle des quinze thèmes accusait **Réunion** d'un texte à 3,28:1. Faux : `.rowbox` et `.fc-l`
sont transparents, et la mesure retombait sur `document.body` — soit le **décor** du thème, un
ardoise foncé *derrière* une feuille crème. L'épreuve remonte désormais la chaîne des ancêtres
jusqu'au premier fond réellement peint. C'est le piège même que `--inset` existe pour éviter, et
cette fois c'est l'épreuve qui est tombée dedans, pas l'application.

### Deux rangements, pas un

La composition d'un patient vit sur **sa fiche** (`p.feuilleCols`), celle des feuilles vierges dans
les **réglages** (`S.feuilleColsVierge`). Un seul rangement et composer une feuille vierge aurait
réécrit le dernier patient ouvert — ou l'inverse, selon le sens du raccourci. `pw_colonnes` le
garde dans les deux sens.

### Un détail qui mentait

La tuile du choix de la feuille annonçait « TA · pouls · T° · sat · douleur » **en dur** — sur une
feuille où la douleur avait été remplacée par le poids. `TYPES` est devenu une fonction, relue à
chaque passage par l'écran de composition : un écran ne doit pas mentir sur son propre contenu.

### Fichiers touchés

| Fichier | Quoi |
|---|---|
| `www/js/feuilles.js` | `FCOL_MES`, `FCOL_HISTO`, `FCOL_MAX`, `fcolMes/Defaut/Lire/Ecrire/EstDefaut/Th/Unite/Largeurs/Nb/Titre/EnteteHtml`, `sheetFeuilleColonnes()`, en-tête et compte de cases des constantes calculés, `th.perso` |
| `www/css/app.css` | `.fc-l`, `.fc-r`, `.fc-fl`, `.fc-n`, `.chip.fc-u`, `.fc-x`, `table.fc-apr` |
| `tests/navigateur/pw_colonnes.js` | 61 contrôles — **50 tombent** sur le `www/` de la v1.24.0, les 3 de l'invariant passent sur les deux |

## v1.24.0 — deux thèmes de plus, et une liste qui se regarde

### Ce qu'il a demandé

Un thème **Windows XP** (« la fenêtre complète »), un thème **Littoral méditerranéen** — et, au
passage : « *étant le nombre de thèmes, peut-on les lister différemment… histoire que la sélection
soit moins fouillis ?* »

### Le classement clair/sombre ne range rien : mesuré

Relevé sur la **luminance du fond réellement appliqué**, thème par thème : **onze sombres, deux
clairs** (Bloc, Papier blanc). Un classement par là aurait donné un groupe de deux et un groupe de
onze — le fouillis déplacé d'un cran. Les thèmes sont donc rangés par **familles d'usage**
(Sobres · Reliefs · Décors · Rétro), et l'étiquette claire/sombre reste affichée sur chaque ligne :
*une information, pas un rangement.*

### Et un nom ne fait pas choisir

« Verre fumé », « Bloc », « Gravé » ne disent rien tant qu'on ne les a pas vus. Chaque ligne porte
une **vignette** — un bandeau et deux cartes, peints avec les jetons du thème.

⚠️ **PAS UNE CAPTURE D'ÉCRAN :** une image se périmerait à la première retouche de palette et
pèserait dans l'APK. La vignette hérite des variables, donc elle suit toute seule.

⚠️ **ET IL A FALLU OUVRIR LES BLOCS DE JETONS.** Première pose : `data-app-theme` sur un `<span>`
— et les quinze vignettes sont sorties **identiques**. Les blocs ne visaient que
`html[data-app-theme="…"]`. Huit blocs doublés (`html[…], […]`), plus un bloc neuf pour
« Original », dont les jetons vivent dans `:root` et dont la vignette prenait donc les couleurs du
thème affiché.

### Littoral — l'identité ne vient pas d'une palette

Deux versions ont été refusées avant celle-ci : *« pas assez provençal »*. Elles étaient de jolies
gammes chaudes, mais **rien n'y disait « ici »**. Ce qui manquait n'était pas une couleur de plus,
c'était un **motif qui revient** : les titres de section sont des **plaques de rue émaillées** —
bleu, liseré blanc, capitales espacées —, la signalétique du Midi. Et la palette bascule vers la
terre : terre cuite, ocre, olivier ; le bleu de rade descend au rang de couleur de titre.

⚠️ **LE DÉFAUT QUE L'ÉCRAN A RÉVÉLÉ : « vu » et « vigilance » sortaient de la même couleur.**
Premier jet, `--accent` et `--danger` tous deux en terre cuite. Sur le Moniteur, un patient vu et
un patient en vigilance étaient **identiques**. L'olivier a pris l'accent, la terre cuite est
restée au danger. *Dans une application de soins, c'est le seul défaut qui ne se discute pas — et
aucun contraste ne le rattrape, puisque les deux étaient parfaitement lisibles.*

⚠️ **Et la plaque sortait délavée** : `.rowlab span` impose une opacité de `.62` au titre. Le fond
de la plaque est posé en dur, avec `opacity:1` — un émail passé n'est pas un émail.

### Bureau 2001 — ce qu'on ne fait pas

Ni logo ni fond d'écran d'origine : ce sont les biens de Microsoft, et un thème qui les embarquerait
voyagerait avec eux dans l'APK et dans le dépôt public. Tout est redessiné ; la cigale tient le rôle
du logo sur le bouton « démarrer ».

⚠️ **PAS DE FAUX BOUTONS DE FENÊTRE**, malgré la maquette validée. Un ✕ décoratif, dans une
application de soins, finit par être touché par quelqu'un qui croit fermer quelque chose. *Le décor
s'arrête là où il commencerait à mentir sur ce qui est cliquable.* Le bandeau devient la barre de
titre et la barre du bas la barre des tâches : on détourne ce qui existe plutôt que d'ajouter deux
bandes — un téléphone n'en a pas à donner.

### Deux épreuves qui ne voyaient pas ce qu'elles gardaient

⚠️ **`pw_themes` portait sa liste en dur** : neuf thèmes recopiés. Les deux nouveaux n'y étaient
pas, et l'épreuve passait au vert **sans les avoir regardés**. Elle lit désormais `APP_THEMES`
dans l'application : tout thème à venir y entre seul.

⚠️ **Et son invariant avait changé de nature.** « `--inset` égal à `--bg` partout sauf Réunion »
gardait l'introduction d'un jeton en v1.18. Deux thèmes le déclarent maintenant exprès — Littoral
(un creux plus chaud) et Bureau (le creux EST le style). La règle devient : *égal à `--bg` sauf si
le thème le déclare lui-même*, et dans tous les cas **le texte reste lisible dessus** — c'est le
texte illisible qu'on craignait, pas l'écart de teinte.

### Non-régression

`tests/navigateur/pw_themes2.js` — 30 contrôles, dont un par thème sur l'écart « vu / vigilance ».
Vérifiée contre la **v1.23.0 livrée** : **22 tombent**. 25 épreuves navigateur, 91 suites statiques.

---

## v1.23.0 — reprendre où l'on s'est arrêté, et défaire ce qu'on vient d'écrire

### Ce qu'il a rapporté, et ce que la mesure a trouvé derrière

> « *Je stoppe le déroulé parce que j'ai besoin d'aller consulter autre chose, et quand je reviens
> il revient pas à celui sur lequel je m'étais arrêté.* »
> « *Depuis la fiche d'un patient j'ai voulu ajouter un nouveau médecin et l'inclure dans le
> cabinet, cela n'a pas fonctionné.* »
> « *Sans faire exprès j'ai cliqué sur « pas de passage ce jour » alors que j'étais déjà passé […]
> je voudrais pouvoir annuler cette action.* »

⚠️ **LES TROIS NE SONT PAS INDÉPENDANTS.** Le déroulé l'a reposé sur un patient qu'il croyait être
le suivant ; c'est là qu'il a touché « pas de passage ». *Un défaut de navigation s'est payé en
écriture fausse dans un dossier.*

### ① Le déroulé ne reprenait jamais sa place — mesuré

```
sur le 4ᵉ patient, je quitte, je reviens      →  le 1ᵉʳ
3 premiers validés, je suis sur le 5ᵉ,
je quitte, je reviens                          →  le 4ᵉ
```

Le code l'assumait : « premier patient non encore vu. **Calculé, pas mémorisé** ». La position est
désormais retenue (`S.seqPos`), **datée, créneautée et rattachée à la tournée** — reprendre le soir
là où l'on s'était arrêté le matin n'aurait aucun sens. Un **ruban de reprise** nomme le patient et
dit combien de non-vus restent derrière, avec un bouton pour y aller : *la reprise ne doit pas
masquer ceux qu'on a sautés.*

### ② « Pas de passage » ne disait rien — et mentait

Mesuré : sur un patient déjà passé, le drapeau `noVisit` est **ignoré** par `statusOf` dès qu'un
passage existe ce jour-là. Le mal était donc limité — mais le message annonçait le contraire :
*« non inclus dans la relève »*, alors que le passage existant y figure bel et bien. Et le geste
**effaçait la saisie gardée 💾**.

Désormais une question se pose, qui rappelle l'heure et les constantes du passage existant, et
propose en premier **de corriger ce passage** — l'intention réelle neuf fois sur dix. On n'empêche
pas : on dit ce qu'on est sur le point d'écrire.

### ③ Les dernières actions — trois, la journée

Il n'existait qu'un lien de **six secondes**, et seulement sur un passage neuf. Or on se trompe au
chevet et on s'en aperçoit en rangeant son matériel. `S.annul` garde **trois écritures** —
validation, correction, fusion, « pas de passage » — chacune avec **une copie de l'état d'avant**.
L'écran nomme ce vers quoi on revient (« son passage de 08:42 redevient la seule écriture du
jour »), jamais « voulez-vous annuler » : *défaire sans savoir vers quoi, c'est parier.*

⚠️ **UNE ANNULATION PASSE PAR `logChange`** : elle part à la synchro. Sans ça, le collègue
garderait la version fausse et la renverrait à la fusion suivante.

### ④ Le défaut qu'il n'avait pas vu : la fiche s'effaçait en la quittant

C'est en refaisant son geste que c'est tombé. Ajouter un médecin, allumer « 🏥 Aussi au cabinet »,
quitter **par la flèche retour** :

```
une question est-elle posée ?  NON, l'écran se ferme sans rien dire
au cabinet : 0        sur la fiche : []
```

**Tout était perdu** — le médecin, la pastille, le reste de la fiche. Seul « ✓ Enregistrer » écrit,
alors qu'au pouce la flèche est le geste naturel. C'est ça, « l'inscription au cabinet n'a pas
fonctionné » : elle n'avait jamais eu lieu. La feuille demande maintenant, avec trois issues
nommées pour ce qu'elles font — enregistrer, **quitter sans enregistrer**, revenir.

### ⑤ Et le cabinet qui recevait le médecin n'était pas le bon

Mesuré de bout en bout : patient du **cabinet A**, **cabinet B** ouvert à l'écran, le médecin
partait dans **B**. C'est la famille de défaut déjà corrigée pour les documents — « un document
pour un patient du Cabinet A sortait à l'en-tête du B » — restée ici. `cabInscrire` reçoit
désormais le patient et vise `cabinetPourDoc(p)`, et la recherche de doublon porte sur le même
cabinet : deux cabinets peuvent chacun avoir leur « Dr Martin ».

### Non-régression

`tests/navigateur/pw_annuler.js` — 30 contrôles, vérifiée contre la **v1.22.0 livrée** : **24
tombent**. 91 suites statiques, 24 épreuves navigateur.

---

## v1.22.0 — l'heure du téléphone sur le bandeau

### Ce qu'il a vu

> « *J'ai la barre en haut de mon téléphone qui affiche le réseau, le pourcentage de la batterie et
> l'heure, qui est en superposition des informations du haut de l'appli.* »

### La règle existait. Elle ne s'exécutait jamais.

⚠️ **LE RETRAIT DU HAUT ÉTAIT ENFERMÉ DANS `@media (display-mode: standalone)`** — le mode
« application installée ». Mesuré dans un navigateur ordinaire, qui est exactement ce qu'est la
WebView de l'APK :

```
display-mode standalone : false
display-mode browser    : true
padding-top de .wrap    : 16px
haut du bandeau         : 16.0 px
```

La règle ne s'appliquait donc jamais dans l'application Android : le bandeau démarrait à 16 px du
bord et le système écrivait par-dessus.

⚠️ **ET LE DÉFAUT AVAIT DÉJÀ ÉTÉ VU — À UN SEUL ENDROIT.** `#jeu-barre` applique ce retrait **sans
condition**, avec ce commentaire : « *Le retrait de la barre d'état du téléphone vit ICI, une fois
pour toutes : sans lui, l'heure d'Android se posait sur le titre du jeu.* » Corrigé là où ça se
voyait, jamais ailleurs. *Une correction locale à un défaut global laisse le défaut.*

### Une seule variable, lue partout

`:root{ --sbtop: env(safe-area-inset-top, 0px) }`, et **plus un seul `env(safe-area-inset-top)` en
direct** dans la feuille de style : `.wrap`, `.daily-greet`, `.dv-close`, `.fiche-prev .fp-bar`,
`#zoom-badge` et `#jeu-barre` lisent tous la variable. C'est ce qui permet au réglage manuel de
l'emporter.

### Le réglage manuel, parce que le téléphone ne déclare pas toujours

⚠️ **`env()` PEUT VALOIR 0 MALGRÉ `viewport-fit=cover`**, selon l'appareil — et c'est invérifiable
depuis une autre machine. Le réglage « Place de la barre du téléphone » (Personnaliser → Texte et
zoom) propose **Automatique · Aucune · 24 · 32 · 40 · 52 px**, et affiche à côté **ce que l'appareil
déclare réellement**. Sans ce chiffre, choisir « 32 px » serait tâtonner : on saurait que ça va
mieux, jamais pourquoi.

### Ce que l'épreuve garde, et comment elle simule une encoche

`env()` vaut 0 sur un écran d'ordinateur et aucun outil ne permet de le forcer. Mais toute
l'application lit `--sbtop` : l'épreuve la pose à la main — **le chemin exact qu'emprunte un
téléphone qui ne déclare rien** — et mesure le haut du bandeau. 40 px posés, 40 px de descente,
rien au-dessus.

`tests/navigateur/pw_barre.js` — 23 contrôles, vérifiée en rouge en remettant le retrait dans le
mode « installé » : **7 tombent**.

### Non-régression

91 suites statiques, 23 épreuves navigateur.

---

## v1.21.0 — la cigale en fond de page

### Ce qu'il a demandé

> « *Sur les documents générés, puis-je avoir une version avec un filigrane en fond léger ? Je le
> veux sur les feuilles de constantes, poids, glycémie en permanence, et avoir le choix de
> l'inclure ou pas sur les autres documents. Le filigrane serait la cigale avec sa croix (logo de
> l'app) et le texte « JM@Santé by JmCve83 ».* »

Variante retenue après deux planches : **le fond à 22 % + la signature d'angle**, et **un seul
interrupteur** pour tous les autres documents.

### Trois mesures, trois corrections qu'il n'avait pas demandées

⚠️ **UN FOND CSS NE SORT PAS DE L'IMPRIMANTE.** Même feuille, même PDF, sans cocher « imprimer les
arrière-plans » — l'option est décochée par défaut partout :

| la marque est… | pixels imprimés |
|---|---|
| une `background-image` | **0** |
| un élément `<svg>` dans la page | toute la marque |

Écrite en fond, elle se serait vue à l'écran et le papier serait sorti vierge — *une fois sur
deux, selon la machine et la personne qui imprime.*

⚠️ **7 % D'OPACITÉ, C'EST INVISIBLE SUR DU PAPIER.** La première planche reprenait les 7 % de la
cigale de l'écran d'accueil. Sa réponse : « *la D, mais c'est que sur ta maquette c'est la seule
pour laquelle je vois le filigrane* ». Il n'avait pas choisi une variante, il avait choisi **la
seule qu'il voyait**. Mesuré au contraste sur blanc : 7 % → #EDF3F3, **1,12:1**. 22 % → #C6DAD7,
**1,45:1**. *Une valeur d'écran rétroéclairé posée sur du papier n'est pas la même valeur.*

⚠️ **LE ZÉBRAGE DU TABLEAU DÉCOUPAIT LA CIGALE EN BANDES.** Première sortie papier : la marque
ressortait rayée, une bande claire par ligne paire. Mesuré en comptant la marque ligne par ligne
dans la bande centrale :

| | pixels de marque | lignes sans marque |
|---|---|---|
| zébrage, arrière-plans décochés | 10 210 | **256 / 404** |
| arrière-plans cochés | 19 858 | 135 / 404 |
| zébrage retiré | 20 045 | 134 / 404 |

Chromium repeint donc ces cellules en **blanc opaque** quand les arrière-plans sont décochés —
l'alpha d'un `rgba` n'y change rien. Et au passage : **le zébrage ne s'était jamais imprimé**. Il
est remplacé par un **filet plus marqué tous les cinq jours** — un trait est une bordure, pas un
fond, et il sort toujours. (Il a fallu 2 px : à largeur égale, en bordures fusionnées, c'est la
cellule du haut qui gagne, et 1,4 px retombait à 1.)

### Posé à la sortie, pas dans les treize documents

Treize documents sortent de huit modules. Leur greffer la couche un par un, c'était treize mises
en page à reprendre. `filigraner(html)` l'injecte sur le **document fini**, aux deux seules portes
de sortie — `showFichePreview` et `shareText` —, et `data-fili` empêche la double pose : les
feuilles de domicile portent déjà la leur. La couche est en `position:fixed` : à l'impression elle
se répète d'elle-même sur chaque page (mesuré : recto **27 791** px, verso **27 791**).

### Ce que l'épreuve a trouvé, et que je n'aurais pas vu

⚠️ **Vidé, le champ de mention faisait déborder la feuille sur deux pages.** La ligne ne se
resserrait à 7,6 mm que s'il y avait du texte — or la ligne du pied existe désormais toujours,
puisqu'elle porte la signature. En densité serrée elle est maintenant **toujours** à 7,6 mm.

⚠️ **Et une mesure qui ne voyait pas ce qu'elle mesurait.** Le premier jet comptait les pixels
« verts » et annonçait **90 pixels de filigrane** sur une page qui en portait **23 714** : à 22 %,
les traits antialiasés tombent sous n'importe quel seuil de teinte. L'épreuve mesure désormais par
**différence de pixels** entre la page avec et la page sans la couche.

### Ce que l'application ne prétend pas

Le filigrane **n'authentifie rien et ne prouve rien** — c'est de l'identité visuelle. L'écran de
réglage le dit, parce que sur une ordonnance une marque de fond peut être prise pour autre chose.

### Non-régression

`tests/navigateur/pw_filigrane.js` — 29 contrôles, vérifiée en rouge en remettant le fond CSS, le
zébrage et le pied sans signature : **6 tombent**. 91 suites statiques, 23 épreuves navigateur.

---

## v1.20.0 — ma mention en bas de feuille, et des feuilles sans dossier

### Ce qu'il a demandé

> « *Je veux pouvoir éditer une fiche de constantes vierge (pas de données patient déjà
> renseigné) ailleurs que depuis la fiche patient. Aussi je souhaite pouvoir mettre une mention en
> bas de page et en choisir la taille. De plus je veux pouvoir la taille car actuellement c'est
> écrit trop petit.* »

> « *Pour la feuille des constantes je ne veux que la mention que je souhaite et plus les
> indications de normes. Je veux pouvoir modifier à chaque fois la mention qui s'affiche en bas
> mais avoir en proposition la précédente, car pour certaines périodes je vais modifier le nom ou
> le cabinet ou bien mettre un message d'actualités type joyeuses fêtes.* »

Puis, en trois mots : **une seule mention pour les trois feuilles**, **le poids et les glycémies
comme les constantes**, et dans « Mes outils » **seulement ce qui sert en vierge** — « *la relève
vierge ne sert pas* ».

### Ce qui change

⚠️ **LES NORMES NE SONT PLUS EN BAS DE FEUILLE.** Elles y étaient d'office, construites depuis
`p.thresholds` ; sa mention ne pouvait que les remplacer, et le remplacement n'était pas gardé :
l'écran rouvert repartait du texte d'origine. Désormais le pied ne porte que `S.feuilleMention`,
commune aux trois feuilles. `normesDefaut()` reste dans le fichier pour qui veut recopier les
repères chiffrés dans sa mention — elle n'est plus appelée à l'impression.

⚠️ **ELLE EST ENREGISTRÉE AU TIRAGE, PAS À LA FRAPPE.** `mentionFeuilleSet()` est appelée depuis
`out()` — aperçu, impression, partage — et non depuis l'`oninput`. *Un champ à demi tapé puis
abandonné ne doit pas devenir la proposition de la fois d'après.*

⚠️ **LA TAILLE DU PIED EST RÉGLABLE** (`S.feuillePiedPt` : 7 / 8,5 / 10 pt, défaut **8,5**). 7 pt
était en dur, et c'est ce qu'il décrivait comme trop petit.

### La mesure qui a commandé une correction qu'il n'avait pas demandée

Nombre de pages du **PDF** (densité serrée, 31 jours, mesuré par Chromium — pas la hauteur du bloc
à l'écran, qui est fausse : le `padding` de l'aperçu et `min-height:277mm` donnent 305 mm à
toutes les tailles et font croire que même 7 pt déborde) :

| hauteur de ligne | 1 ligne de mention | 2 à 4 lignes | 5 lignes à 10 pt |
|---|---|---|---|
| **8,1 mm** (avant) | 1 page | **2 pages** | 2 pages |
| **7,6 mm** (`ROW_AVEC_PIED`) | 1 page | **1 page** | 2 pages |

⚠️ **Une mention de deux lignes renvoyait la feuille serrée au verso, à toutes les tailles** — ce
qui ruine la seule chose qu'on lui demande, tenir sur une face. La ligne se resserre donc à 7,6 mm
**quand il y a un pied, et seulement alors** : sans mention, le tableau garde ses 8,1 mm.

⚠️ **Et une affirmation à ne plus répéter :** le tableau **ne perd jamais de ligne**. Les 31 jours
sont là à 7 comme à 10 pt. C'est la page qui déborde, pas le mois qui se raccourcit. (Un contrôle
de l'épreuve ne garde que ça.)

### Les feuilles sans dossier

`sheetFeuilles(pid, type0)` accepte `pid` nul : l'en-tête devient deux lignes à remplir à la main
(`.lg`), le reste est identique. **Pas de second chemin** — c'est le même écran et la même
fonction de rendu, avec un patient vide.

Nouvel écran **`sheetDocsVierges()`**, dans Réglages → Mes outils (`data-sec="vierges"`, présent
dans les deux modes d'affichage du menu) : les trois feuilles, le courrier, l'ordonnance, et —
quand les essais correspondants sont actifs — les modèles et l'ordonnance de matériel. Chaque
entrée ouvre **l'écran qui existe déjà**. La relève et l'export des constantes n'y sont pas : sans
patients et sans historique, ils n'ont rien à imprimer.

### Ce que l'épreuve garde

`tests/navigateur/pw_feuilles.js` — 36 contrôles. Vérifiée en remettant le code d'avant
(normes en dur, 7 pt, pas de mémoire, ligne à 8,1 mm) : **16 tombent**, dont les quatre qui
comptent — les normes reviennent, la mention n'est pas proposée à la réouverture, le pied est à
7 pt, et une mention de deux lignes repasse sur deux pages.

⚠️ **Un piège trouvé en l'écrivant :** les normes passaient par `esc()` sur un chemin (`&gt;`) et
pas sur l'autre (`>`). Cherchées sous une seule forme, le contrôle des constantes restait **vert
sur le code d'avant**. *Un contrôle qui ne tombe pas sur le défaut qu'il garde ne garde rien.*

### Un rapiéçage d'épreuve qui dormait hors du dépôt

⚠️ **`_test_draft.js` plantait** sur « CSS is not defined » : jsdom n'a pas `CSS.escape`, dont
`_restoreDraft` se sert pour retrouver la pastille d'un soin. Le correctif vivait dans une copie
locale du dossier d'exécution — **invisible au dépôt, et perdu au premier recopiage**. Il est
désormais dans l'épreuve elle-même. Le défaut est celui de l'environnement d'épreuve, pas de
l'application : `CSS.escape` existe dans tous les navigateurs et dans la WebView Android.

### Non-régression

91 suites statiques : **zéro écart** avec v1.19.0. 21 épreuves navigateur passées une à une.

---

## v1.19.0 — une vigilance qu'on peut taire, une valeur qui reste

### Ce qu'il a vu

« *J'ai une patiente qui a une tension plus élevée que d'habitude. C'est normal à ce moment-là,
mais j'ai une vigilance qui s'affiche sur la carte. J'aimerais pouvoir la supprimer.* »

### Le défaut trouvé en chemin, plus large que la demande

⚠️ **`statusOf` appelait `alertes(v.consts)` SANS passer `p.thresholds`.** Mesuré : une patiente
dont le seuil de tension est relevé à 18, avec un relevé à 17/9, ne produit plus d'alerte au
calcul — et sa carte restait rouge. *Régler le seuil d'un patient enlevait le rouge sur le chiffre
et laissait la carte en alerte : le réglage semblait ne servir à rien.*

⚠️ **Et le balayage a montré que le défaut était systémique.** 26 appels à `alertes()` : la relève
en mode « RAS » et « DAR », le filtre « événements », l'historique par mois — tous ignoraient les
seuils du patient. **17 appels corrigés**, et `isEvent()` reçoit désormais le patient, faute de quoi
une vigilance tue sur la carte faisait quand même entrer son passage dans la relève : *l'alerte
ressortait par la porte de derrière.*

### La sourdine, en deux temps

Un appui sur une valeur en vigilance ouvre la portée — **ce relevé** ou **cette patiente** — puis
la trace. Les séparer évite le geste unique qui fait les deux sans qu'on l'ait voulu. « Cette
patiente » calcule le seuil qui convient à partir de la valeur et l'écrit dans sa fiche ; « ce
relevé » pose `v.sourdine = { ta:"raison ou vide" }`.

⚠️ **Constante par constante, jamais en bloc.** Taire une tension attendue ne doit pas taire
l'hypoglycémie du même passage.

### Ce qui a tranché un désaccord

La réserve posée était celle de l'application elle-même : *un réglage d'affichage ne doit jamais
cacher une alerte*. Sa réponse l'a levée :

> « Si on écrit quand même dans le dossier la constante en alerte, en tout cas sa valeur exacte.
> Le soignant est capable d'interpréter après sa valeur, c'est son travail. »

⚠️ **Rien n'est caché : ce qui change, c'est la couleur.** La valeur reste enregistrée, reste
affichée sur la carte — y compris quand sa constante n'est pas cochée dans les réglages, comme
toute valeur hors seuil — et porte un **🔕** avec un soulignement en pointillés. Une remplaçante
lit 17/9 et juge elle-même. *La sourdine éteint le signal, pas la donnée.*

### Non-régression

20 épreuves navigateur, 91 suites statiques, aucun écart.

---

## v1.18.0 — le décor qui se repeignait à chaque image

### Ce qu'il a vu, et la phrase qui a tout dénoué

« *J'ai toujours le problème de scroll vertical qui saccade. Cependant, j'ai remarqué que ce
problème ne se produit uniquement sur la carte du patient quand je suis dans le mode déroulé.
Quand je suis en dehors du mode déroulé que je consulte la carte du patient, je n'ai pas le
problème.* »

⚠️ **C'est cette observation qui a résolu l'affaire, pas une mesure.** Trois hypothèses avaient été
testées et démenties la veille ; aucune n'aurait été trouvée sans qu'il désigne l'écran.

### La cause

Le décor du thème Réunion était posé en `background-attachment:fixed` sur `body`. Un fond fixe ne
bouge pas avec le contenu : le navigateur ne peut donc pas se contenter de faire glisser un calque
déjà peint — il **repeint le décor** sur toute la surface découverte, à chaque image.

⚠️ **Et voilà pourquoi seulement dans le déroulé.** Hors déroulé, le `backdrop-filter` de chaque
carte promeut le décor en couches composites, que le compositeur translate : le coût disparaît.
Dans le déroulé il n'y a **qu'une carte**, donc pas de promotion, et le décor se repeint.
*L'écran qui semblait le plus simple était le seul privé de ce garde-fou involontaire.* C'est aussi
ce qui réconcilie la mesure de la veille, où retirer le flou **dégradait** le défilement d'un
facteur sept : le flou ne coûte pas, il promeut.

### La correction, et les deux pistes écartées

Le décor passe dans un `body::before` en `position:fixed`, `z-index:-1`, avec `will-change`. Même
image, même cadrage, même comportement fixe — mais une couche que le compositeur fait glisser.

| Piste | Mesure | Verdict |
|---|---|---|
| Alléger les ombres des cartes dans le déroulé | 20,1 → 18,5 ms de moyenne | sous le bruit, abandonnée |
| `background-attachment:scroll` | 16,7 / 21,5 ms | bons chiffres, mais **décor étiré sur toute la page**, texte illisible par endroits |
| **Décor en couche dédiée** | **16,7 / 19,3 ms** | retenue |

Repère : un thème sans décor donne 16,7 / 19,6 ms. La correction ramène donc exactement au niveau
d'un écran sans image de fond.

### Comparer deux images sans connaître leur bruit

⚠️ La comparaison avant/après donnait 15 à 22 pixels de différence sur Réunion. **Mais deux
captures du MÊME code, à quelques secondes d'écart, en diffèrent déjà de 120** : les pastilles
d'alerte clignotent. L'écart mesuré est donc *sous* le bruit — il n'y a pas de différence.

⚠️ **Et cosmos a été soupçonné à tort.** Il affichait 872 pixels d'écart alors qu'il n'avait pas
été touché : son semis d'étoiles scintille, pour un bruit propre de 285 pixels. *Comparer deux
images sans mesurer d'abord ce qu'elles bougent toutes seules fait accuser une correction de ce
qu'une animation produit.*

### Pourquoi Réunion seul

Les décors de `verre`, `tubes` et `hopital` sont aussi en `fixed`. Le même traitement leur
profiterait — mais appliqué à eux, il déplace de **vrais** pixels : **47 697 sur `verre`**, très
au-delà de son bruit propre, qui est nul. Leurs dégradés semi-transparents ne se recomposent pas à
l'identique dans une couche séparée.

⚠️ *Un gain de fluidité ne vaut pas un thème qui change d'aspect sans qu'on l'ait demandé.* Les
trois restent tels quels, et l'épreuve vérifie qu'ils n'ont pas bougé — une correction silencieuse
passerait sinon pour un effet de bord.

### Ce que l'épreuve garde

`pw_themes` vérifie, pour les trois scènes : le décor n'est plus un fond de `body`, il est dans une
couche `fixed` en `z-index:-1`, et **`body` garde sa couleur de repli** — si l'image tarde ou
échoue, on a la bonne teinte et jamais du blanc. Elle garde le montage, pas le chiffre : un `fixed`
qui reviendrait sur `body` ramènerait les saccades sans que rien ne le signale.

### Non-régression

19 épreuves navigateur, 91 suites statiques, aucun écart.

---

## v1.17.0 — les doublons que le déroulé avait semés

### Ce qu'il a vu

« *J'ai des lignes en trop avec la même valeur sur le même jour mais à une heure différente. Il faut
que je puisse corriger ça.* » Et, dans la même demande : pouvoir **écarter des lignes** avant
d'exporter, et choisir le **format** du tableau.

### L'origine, datée

⚠️ **Avant la v1.15.1, dans le déroulé, valider avec le bouton du bas puis appuyer une seule fois
sur → créait un second passage.** Le formulaire restant rempli, ce doublon portait **les mêmes
constantes**, à l'heure de la navigation. C'est exactement la forme décrite : même jour, mêmes
valeurs, quelques minutes d'écart. Le défaut est corrigé depuis le 15 octobre ; les données qu'il a
laissées, non.

⚠️ **Une hypothèse a été testée puis écartée par la mesure.** On a d'abord supposé le défaut des
constantes rechargées (v1.16.0) : le formulaire du soir prérempli, validé sans y toucher, aurait
créé un doublon. Mesuré en remettant le code d'avant : ce chemin **modifie** le passage du matin,
il n'en crée pas un second. L'explication était plausible, elle était fausse.

### Deux gestes qui se ressemblent et ne font pas la même chose

| | Ce que ça touche |
|---|---|
| **☑️ Choisir** | Retire des lignes du **document** qu'on imprime. Les données ne bougent pas. |
| **🔍 Repérer les doublons** | Désigne des **passages à effacer**. Définitif. |

Ils partagent les cases à cocher, jamais le bouton d'action : l'un dit « Exporter sans ces lignes »,
l'autre « Supprimer ». *Un seul bouton pour les deux aurait fini par effacer un relevé qu'on voulait
seulement écarter d'une feuille.*

### Le repérage : strict par construction

Seuil retenu avec lui : **5 minutes**. La fonction exige en plus une **égalité stricte** des
constantes — mêmes clés, mêmes valeurs. Deux relevés qui diffèrent d'un chiffre, ou dont l'un porte
une constante de plus, sont deux vraies mesures et ne sont jamais proposés.

⚠️ *Un relevé effacé à tort ne se retrouve pas.* L'épreuve porte donc autant sur ce qu'il faut **ne
pas** proposer que sur ce qu'il faut trouver : 6 minutes d'écart, une valeur qui diffère, une
constante en plus, deux jours différents, des passages sans constantes — et **23 h 58 / 00 h 01**,
qui appartiennent à deux dates et ne sont pas comparés.

⚠️ **Le premier est gardé, les suivants proposés** : c'est le premier qui porte l'heure du vrai
passage, le doublon ayant pris celle de la navigation. Le tri se fait sur l'heure, pas sur l'ordre
d'arrivée dans le tableau.

### Supprimer un doublon n'archive pas sa mesure

⚠️ **C'est le seul endroit de l'application où une mesure ne survit pas à son passage.** Partout
ailleurs, supprimer un passage archive ses constantes — « une courbe trouée efface une évolution
qu'on ne peut plus reconstituer ». Pour un doublon c'est l'inverse : archiver le laisserait tracé
deux fois, et la suppression n'aurait rien réglé.

⚠️ La suppression emporte aussi les **mesures déjà archivées** du même horodatage — celles qu'un
ancien 🗑 avait laissées derrière lui et qui polluent encore les courbes. Vérifié par l'épreuve, sur
une mesure archivée **sans son passage**, qui est la situation réelle.

### Le classeur

Le format **📊 Excel** rejoint PDF, HTML et Texte. Il ne porte que le tableau : un classeur de
courbes n'a pas de sens, on y retravaille des chiffres.

⚠️ **Les tensions y sont séparées en systolique et diastolique**, et les dates sont de **vraies
dates**, pas des chaînes. Sans cela, Excel trie « 10 oct. » avant « 9 oct. », et ni moyenne ni
graphique ne sont possibles — c'est tout l'intérêt du format face au PDF. Volets figés, filtre sur
les colonnes, valeurs hors seuil en rouge.

### Le défilement : trois hypothèses, trois fois démenti

Son observation a resserré le champ : *« ça ne saccade que sur la carte patient quand je suis en
mode déroulé »*. Trois mesures ont suivi, toutes négatives :

| Hypothèse | Mesure |
|---|---|
| L'écouteur de défilement de `seq.js` (lecture de géométrie à chaque image) | **1 image perdue d'écart** sur ~140 — du bruit |
| Le handler privé de sa lecture de géométrie | aucun gain mesurable |
| Le déroulé plus coûteux que le tableau de bord | **l'inverse** : 1 image perdue dedans, 2 dehors |

⚠️ **Le banc ne reproduit pas le symptôme**, et c'est le résultat le plus utile : il défile par
`scrollTo` programmatique, sans carte graphique, alors que la plainte porte sur un **geste du
doigt**. Continuer à mesurer là aurait produit des chiffres propres sur la mauvaise question. Trois
essais lui ont été proposés — thème, fini, zoom — chacun désignant une cause différente.

### Une erreur de livraison, attrapée avant de partir

⚠️ Le remplacement de version dans `package-lock.json` a écrasé la version d'une **dépendance**
(`@exodus/bytes`, en 1.16.0) en même temps que celle du projet. Son champ `resolved` pointait
toujours sur le vrai paquet : une réinstallation aurait échoué. Corrigé en relisant le `resolved` de
chaque dépendance, et la v1.16.0 déjà livrée a été vérifiée saine. *Un remplacement de texte sur un
numéro de version touche tout ce qui porte ce numéro, pas seulement ce qu'on vise.*

### Non-régression

19 épreuves navigateur, 91 suites statiques, aucun écart.

---

## v1.16.0 — un passage par passage, et l'historique qui se lit

### Ce qu'il a vu

« *Quand je suis dans le déroulé du matin, j'enregistre des constantes. Puis, en fin de journée,
je fais le déroulé du soir. Si je modifie une constante, il modifie également celle qu'il y avait
précédemment.* » Et, à la question posée pour trancher : « *Le soir, quand j'ouvre un patient, les
constantes du matin sont déjà renseignées.* »

### La cause : « déjà vu aujourd'hui » voulait dire « je modifie ce passage »

`_restoreDraft` rechargeait le passage du jour dans le formulaire et posait `_editUid` dessus.
L'intention, écrite dans son propre commentaire, visait un cas réel — la patiente qui demande un
soin de plus deux minutes après la validation. Mais la condition ne regardait **que la date** :
elle ne distinguait pas « je reviens tout de suite » de « c'est le soir, huit heures plus tard ».

⚠️ **La vue Journée suffisait à déclencher le défaut, créneaux activés ou non** (`sl === "jour"`),
et cette vue est posée automatiquement au retour au Moniteur. Ce n'était donc pas un cas de bord :
c'était le chemin ordinaire.

### Le défaut caché derrière le défaut

Le symptôme était **capricieux** — tantôt un second passage correct, tantôt l'écrasement du
premier. Trois mesures contradictoires avant d'en trouver la raison : `_saveDraft` reconstruit
`_formDraft` à chaque frappe, **sans reporter `_editUid`**.

⚠️ **Le lien vers le passage se perdait au premier caractère tapé.** Selon qu'on avait touché le
formulaire ou non avant de valider, le même geste écrasait le passage précédent ou en créait un
second. *Un comportement qui dépend d'une frappe ne se décrit pas, il se subit* — et c'est
pourquoi le défaut a résisté à trois sondes successives avant d'être compris.

### La règle retenue, et ce qu'elle coûtait

À sa demande : **ouvrir un patient ouvre toujours un passage neuf**. La question « compléter celui
d'avant ou en garder deux ? » reste posée au moment de valider, par la boîte qui existait déjà
dans `commitVisit` — et que le rechargement court-circuitait.

⚠️ **Cette suppression avait un prix, relevé avant de l'appliquer :** `_editUid` n'était posé QUE
par ce rechargement. En le retirant, un passage validé devenait définitif dès qu'un autre le
suivait. La contrepartie est due dans la même version — d'où le bouton **✏️ sur chaque passage de
🕐 Historique**. Ce que l'app décidait toute seule au mauvais moment, l'utilisateur le demande
maintenant au bon, sur le passage qu'il choisit.

⚠️ Corriger un passage **ne le reclasse pas** : son créneau est repris, sinon un passage du matin
corrigé le soir deviendrait un passage du soir et disparaîtrait de la vue du matin.

### L'historique des constantes : ce qui manquait n'était pas ce qu'on croyait

Demande : « *la courbe d'historique est actuellement valable pour la tension systolique, la
diastolique et le pouls. Je voudrais qu'elle soit également valable pour la glycémie, mais
également la saturation.* »

⚠️ **Mesuré : les sept séries étaient déjà tracées**, glycémie et saturation comprises. Ce qui
manquait, c'était l'inverse d'un ajout : `available` **masquait purement** toute série sans mesure
sur 90 jours. Une glycémie jamais relevée disparaissait de l'écran, et l'absence se lisait
« l'application ne sait pas la tracer ». Elle le savait depuis toujours — il manquait des mesures,
ce qui n'est pas la même chose et doit se dire. Les séries vides restent désormais affichées,
éteintes, avec « aucune mesure ».

### Lire en chiffres : trois formes, deux crans

*« J'aime bien le fait d'avoir une courbe, mais je veux aussi une version texte avec les dates et
l'heure de passage. »* Trois formes maquettées, les trois retenues : **Série** (une ligne par
mesure de la série choisie), **Passage** (un bloc par passage, toutes constantes), **Tableau**.

⚠️ **Deux crans plutôt que quatre positions** : 📈 Courbe / ☰ Liste d'abord, puis Série · Passage ·
Tableau. Quatre positions tiennent sur la largeur d'un téléphone, mais plus avec des libellés
lisibles — et le tableau est celui qu'on va chercher exprès, pas celui qu'on frôle.

⚠️ La rangée des séries ne paraît que là où elle agit — en Courbe et en Série. En Passage et en
Tableau toutes les constantes sont déjà montrées : sept pastilles y occupaient trois lignes
d'écran sans rien commander. *Un bouton qui ne fait rien là où il est posé est pire qu'un bouton
absent.*

### L'export : le glissant ne se range pas

⚠️ **L'écran d'export existait déjà** — période, format, aperçu avant impression, document avec
courbes et tableau. Ce qui manquait tenait dans un mot : la période était **glissante**. Imprimé
le 3 novembre, « 1 mois » donne du 4 octobre au 3 novembre ; le mois suivant rechevauche de deux
jours, et sauter un mois laisse un trou que rien ne signale. Pour un classeur qu'on complète mois
après mois, ça ne tombe jamais juste.

Trois modes désormais : **Glissant** (gardé — c'est la question du chevet), **Mois** calendaire,
**Du… au…**. Et le contenu du document au choix : **Courbes**, **Tableau**, ou **Tout**.

⚠️ Les bornes de mois sont gardées par l'épreuve, pas par la relecture : février 2026 au 28,
février 2028 au 29, décembre qui bascule sur janvier sans se décaler d'un jour. Un
`new Date(an, mo+1, 0)` donne le bon dernier jour, mais une conversion ISO passant par UTC le
ramène au 30 à 23 h depuis Toulon — bornes justes à l'écran, fausses dans le filtre.

### Deux écrans ne peuvent pas porter le même nom

⚠️ L'écran des constantes rebaptisé « Historique » entrait en collision avec **🕐 Historique**, qui
montre les passages — deux boutons voisins sur la même carte. Le retour de l'export disait encore
« Courbes », un écran qui n'existait plus sous ce nom.

### Non-régression

19 épreuves navigateur, 91 suites statiques. Un seul écart au diff, **favorable** :
`_test_affichages.js` plantait dans la baseline et rend de nouveau ses quatre erreurs connues —
vérifié stable sur trois passages, et identique à la baseline v1.15.4 d'origine.

---

## v1.15.5 — une pastille cochée se lit

### Ce qu'il a vu

Une capture du thème **Réunion** en scène « jour » : les pastilles de soins **cochées** sont plus
difficiles à lire que les autres. « *Il faudrait surtout mettre en noir l'écriture et un peu plus
épaisse.* »

### La cause : la même couleur des deux côtés

`.chip.on` portait `color:var(--accent)` sur `background:var(--accent-soft)` — c'est-à-dire le
**même accent**, posé une fois plein et une fois à 13 %. Texte et fond de la même teinte :
contraste **1,00**. Le peu qui restait lisible ne venait que du voile noir que le fini Relief pose
par-dessus, qui assombrit le fond sans toucher au texte.

⚠️ **Ce n'est pas un défaut de thème.** Le couple « texte accent sur fond accent » vaut *partout* ;
ailleurs le fond du thème est sombre, donc l'accent ressort et l'on ne s'en aperçoit pas. Le
contraste était faux quand même. La correction s'applique donc aux neuf thèmes, pas au seul
Réunion.

### Ce que la mesure a renversé

Trois pistes ont été maquettées puis **mesurées** — et la mesure a corrigé deux fois ce que
l'œil annonçait :

⚠️ **La piste A visait `--accent-ink` (blanc) sur l'accent plein : 3,91.** Le noir pur sur le même
fond donne **5,38**. L'encre prévue pour l'accent n'était pas la plus lisible dessus.

⚠️ **La piste C a d'abord été annoncée à 7,77 — en ne mesurant que la scène de jour.** En scène
« soir », la même piste tombe à **1,34**. `--accent-soft` est **semi-transparent** : il laisse
passer le décor, et Réunion est le seul thème dont le fond est une image. Un fond qui dépend du
décor ne peut pas porter du texte. Sans cette seconde mesure, une piste instable aurait été
proposée avec un bon chiffre à l'appui.

D'où la piste retenue, **B** : fond `--surface`, qui lui est stable, écriture `--text` en gras, et
c'est le **liseré** qui dit « coché ».

> **La couleur signale, elle n'écrit pas.** Ce qui porte l'information « fait », c'est le contour ;
> la teinte des lettres n'a qu'à être lisible.

⚠️ Le fini Relief posait un voile de 40 % de noir sur les pastilles cochées. Sur une écriture claire
il creusait l'écart ; sur l'écriture sombre qu'on vient de poser, il le détruirait. Il est retiré :
le relief leur vient désormais de leur ombre seule.

### Le liseré : 4 px, et la pastille ne bouge pas

« *Il faut que ce soit simple à visualiser du premier regard.* » Le liseré est passé de 2 à **4 px**.

⚠️ **L'inquiétude « le trait va manger la pastille » était infondée** — mesuré dans les quatre
épaisseurs essayées : la pastille reste haute de **44 px**, exactement comme une non cochée. Le
trait est tracé vers l'intérieur, il ne décale aucune ligne.

Résultat sur les 13 thèmes × 3 finis, soit 39 combinaisons : toutes au-dessus du seuil, minimum
**11,13**, contre **1,00** avant.

### L'épreuve, et ce qu'elle garde vraiment

`pw_themes` mesure maintenant le contraste d'une pastille cochée sur les neuf thèmes, en
**composant les surfaces semi-transparentes sur le fond** et en retenant, pour Réunion, la **pire
des deux scènes** — c'est précisément ce qu'oubliait la mesure qui avait validé la piste C.

⚠️ **Vérifiée en remettant le défaut, elle ne fait rougir que deux thèmes sur neuf** : `bloc`
(3,66) et `reunion` (2,27). Les sept autres restent verts, parce que leur fond sombre fait ressortir
l'accent. C'est cohérent avec la cause — le défaut était partout, il ne se *voyait* que sur fond
clair — mais il faut le dire sans arrondir : **cette épreuve garde franchement les thèmes clairs**,
et elle ne rattraperait pas une régression équivalente sur un thème sombre.

### Non-régression

⚠️ **Le diff des 91 suites contre la baseline v1.15.4 a d'abord montré sept écarts** — des
« CSS is not defined » disparus, un test qui plantait. Aucun ne pouvait venir d'une règle CSS.
`jsdom` était passé de **30 à 29.1.1** entre les deux exécutions, et jsdom 29 expose `CSS`.
La baseline a donc été **refaite dans l'environnement courant**, bloc v1.15.5 retiré : **zéro
écart**. Comparer deux exécutions séparées d'une heure, ce n'est pas comparer deux versions.

---

## v1.15.4 — le contour bariolé

### Ce qu'il a vu

Une capture zoomée : la pastille **« 🚫 Aucune »** a un contour en pointillés dont les tirets ne sont
pas de la même couleur — blancs en haut à gauche, sombres en bas à droite, et dans les angles
arrondis un même tiret change de teinte en son milieu.

### La cause : deux intentions qui se contrarient

Le fini **Relief** donne aux petits éléments **quatre couleurs de bordure** pour simuler le volume :

```css
border-color:rgba(0,0,0,.5);
border-top-color:rgba(255,255,255,.24);
border-left-color:rgba(255,255,255,.09);
```

Sur un contour **plein**, ces quatre couleurs se fondent l'une dans l'autre : c'est exactement
l'effet recherché, la lumière vient d'en haut. Sur un contour **en pointillés**, chaque tiret prend
la couleur de son propre côté — et le fondu devient un damier.

Un contour en pointillés n'a donc désormais qu'**une seule couleur**. Le relief lui reste donné par
son ombre et son dégradé, qui eux ne se découpent pas en tirets.

⚠️ Au passage, le `style="border-style:dashed"` écrit en dur dans `ui.js` est devenu une classe
`.fchip.vide`. Le pointillé est une **information** — aucune tournée choisie — et c'est la feuille
de style qui doit pouvoir décider comment la dessiner selon le fini.

### On balaie, on ne liste pas

⚠️ **Le fini Relief s'était déjà fait avoir par une liste écrite à la main.** Son propre commentaire
le dit : *« Ils avaient leurs propres classes, absentes de ma liste écrite à la main… Tout élément
hors de la liste restait plat sans que rien ne le signale — d'où le test qui balaie l'app à la
fin. »* Refaire une liste ici, c'était retomber dans le même trou.

L'inventaire a donc été établi **par la mesure** : une sonde parcourt tous les éléments de plusieurs
écrans et retient ceux qui sont en pointillés sur plusieurs côtés avec des couleurs différentes.
Trois familles exactement, et pas une de plus :

| élément | où |
|---|---|
| `button.fchip` « 🚫 Aucune » | la rangée Tournée |
| `div.pcard.absent` | un dossier marqué absent |
| `button.chip.add` « ＋ autre… » | l'ajout d'un soin |

Les boutons `＋ Ajouter` en pointillés, eux, ne ressortent pas : `.btn-ghost` ne reçoit pas de
couleurs de côté séparées. Mesuré, pas supposé.

Ce balayage vit maintenant dans `pw_themes`, sur trois finis × trois thèmes : il refuse **tout**
élément en pointillés dont les côtés diffèrent, et c'est lui qui attrapera le prochain oubli plutôt
qu'une liste.

⚠️ Vérifié en remettant le défaut : les six combinaisons **relief** et **gravé** rougissent, les
trois **plat** restent vertes — ce qui est juste, le fini plat ne colore pas les côtés séparément.
Un contrôle qui rougirait aussi sur « plat » accuserait du code sain.

⚠️ Un seul côté en pointillés — le liseré de statut d'un 2ᵉ passage dans le listing — est écarté du
balayage : il ne peut pas être bariolé, il n'a qu'une couleur par construction.

---

## v1.15.3 — le décor qui traversait les cartes

### Deux captures, deux défauts, une même cause de fond

Sur le thème Réunion, les cartes des patients **déjà vus** laissaient voir la montagne et la mer au
travers, et leur texte devenait illisible. Sur la seconde capture, une carte **dépliée** n'était
opaque que sur son en-tête : tout le formulaire en dessous flottait sur le décor.

### ① L'opacité d'état, multipliée par un fond déjà translucide

`.pcard.seen{opacity:.62}`. Le thème Réunion pose `--surface:rgba(255,251,242,.9)` avec un
`backdrop-filter:blur(8px)` pour compenser.

**0,9 × 0,62 = 0,56.** Près de la moitié du décor passait — et l'`opacity` affaiblit en prime le
flou censé masquer ce qu'il y a derrière, puisqu'elle s'applique à l'élément entier, filtre compris.
Reproduit et mesuré avant correction.

La correction ne touche à aucun thème : **le fond reste plein, seul le CONTENU s'estompe.**

```css
.pcard.seen{ opacity:1 }
.pcard.seen > button{ opacity:.62 }
.pcard.seen > .st{ opacity:1 }     /* un signal d'état ne s'estompe jamais */
```

⚠️ Le même calcul valait pour `.absent` (.75) et pour le style de carte « bande » (.78) : les trois
sont traités ensemble, sinon le défaut reviendrait par la porte d'à côté.

### ② Une carte dépliée fait 1 795 px de haut

Mesuré. Un `backdrop-filter` sur un élément de cette taille n'est pas composité en entier par
WebKit : au-delà de la zone peinte, le voile disparaît et le décor revient à pleine force. C'est
exactement ce que montre la capture — en-tête opaque, reste transparent.

⚠️ **Je ne peux pas le reproduire ici** : Chromium composite la carte entière, le défaut est propre
au moteur de l'iPhone. Ce que je peux affirmer, c'est que la hauteur est hors de toute limite
raisonnable pour un flou composité, et qu'un flou n'a de toute façon rien à faire derrière un
formulaire qu'on remplit. La carte dépliée ne porte donc plus de `backdrop-filter`, et son fond
devient franchement opaque.

### `--surface-plein` : la même couleur, sans transparence

Six thèmes posent un voile translucide sur leur fond. Le jeton donne la couleur **que l'œil voit
déjà**, mais opaque — obtenue en composant `--surface` sur `--bg`, calculée et non choisie à la
main. ⚠️ Mon premier jet en avait posé deux au jugé (`#040D07`, `#140C00`) alors que le commentaire
juste au-dessus affirmait qu'elles étaient calculées ; corrigées en `#04130B` et `#160E00`.

⚠️ **La feuille de saisie n'est PAS touchée.** Elle a le même défaut potentiel — très haute, voilée,
floutée — mais il ne l'a pas signalée, et plusieurs thèmes lui donnent un fond propre. On ne répare
pas ce qui n'a pas été observé, surtout en élargissant le risque à six thèmes d'un coup.

### Le contrôle, et le seuil que j'ai dû jeter

Premier jet : « le fond d'une carte doit être opaque à au moins 85 % ». **Quatre thèmes tombaient** —
Verre fumé, Hôpital de nuit et les deux rétro ont un `--surface` autour de 5 %, délibérément : leur
fond est uni, la carte y est un voile, rien ne traverse. *Un contrôle qui condamne un parti pris
assumé n'est pas un contrôle, c'est une opinion.*

Ce qui est vraiment en cause, c'est que **l'état de la carte dégradait son fond**. Le contrôle
compare donc, dans les neuf thèmes, l'opacité effective d'une carte « vue » à celle d'une carte
« à voir » : elles doivent être identiques, quel que soit le parti pris de chacun. Et le seuil de
85 % est conservé pour Réunion seul — c'est le seul thème dont le fond est une **image**, où tout ce
qui passe devient un motif sous le texte.

⚠️ Vérifié en remettant le défaut : « reunion 56 % contre 90 % ». L'épreuve tombe bien sur ce
qu'elle garde.

---

## v1.15.2 — valider sans descendre

### La demande

*« Le bouton valider le passage d'un déroulé est en bas et c'est très bien ainsi. Mais j'aimerais
qu'il apparaisse aussi en haut. »* Le bouton du bas ne bouge pas ; on en ajoute un second dans le
bandeau, pour ne plus descendre tout en bas du formulaire puis remonter prendre la flèche.

### Trois endroits proposés, et pourquoi B

- **A** — dans la rangée qui ne contient que « Quitter ». Zéro hauteur ajoutée… mais cette rangée
  **n'est pas collée** : elle sort de l'écran dès qu'on défile, c'est-à-dire précisément avant le
  moment où l'on veut valider.
- **B** — dans la barre collée, en pleine largeur sous le nom. Elle suit partout.
- **C** — une pastille ✓ qui n'apparaît qu'en barre réduite. ⚠️ Mon premier jet **cassait la
  barre** : la barre compacte est une grille à trois colonnes, et le ✓ faisait retomber la flèche
  « Suiv. » à la ligne. Corrigé pour que la comparaison soit honnête — mais C met alors **deux
  boutons verts de 44 px côte à côte**, à un pouce d'écart, pour deux actions sans rapport :
  valider un passage, ou changer de patient. Écartée pour cette raison.

### La gêne de B, mesurée plutôt que décrite

Il a répondu : *« je comprends pas ce que tu me dis pour la gêne »*. C'était justifié : je l'avais
énoncée au lieu de la montrer. Trois téléphones de 430 × 620 px, au même endroit du formulaire,
avec les hauteurs relevées **sur la page** :

| | bandeau | place pour remplir |
|---|---|---|
| Avant | 57 px | 559 px |
| B tel quel | 111 px | 505 px |
| **B+** | **80 px** | **536 px** |

Le bandeau est collé : **tout ce qu'il occupe, le formulaire ne l'a pas**, pendant toute la saisie.
B coûtait 54 px en permanence pour un bouton qui ne sert qu'à la fin.

### B+ : le bouton rétrécit avec la barre

⚠️ **Rétrécir « un peu » ne sert à rien.** Mon premier essai réduisait police et marge : il ne
récupérait que **15 px sur 54**. Le bouton doit devenir une vraie bande — pleine largeur, haute
comme une ligne de texte.

⚠️ **Dix pixels partaient sans qu'on les voie.** Même en le réduisant franchement, je mesurais 91 px
au lieu des 81 attendus : `.seq-nav` est une grille portant `gap:10px`, et cet écart de rangée
s'ajoutait à la marge du bouton. D'où le `row-gap` explicite. Ce genre de chose ne se trouve pas en
lisant le code.

Mesures finales, relevées dans l'app : barre **131 → 80 px**, bouton **36 → 20 px**, libellé entier
conservé dans les deux états — *« je préfère que ce soit lisible mais petit »*.

### Le bouton du haut ne valide pas lui-même

⚠️ **Il appuie sur celui du bas.** Un seul chemin de validation, donc un seul endroit où un défaut
peut se loger — et aucun risque de voir réapparaître, par cette porte, les doublons qu'on vient de
supprimer en v1.15.1. L'épreuve vérifie explicitement que le toucher deux fois ne double pas le
passage.

⚠️ **Il dit la même chose que celui du bas, au même instant.** `majValiderHint` appelle un crochet
que le déroulé installe : les deux s'éteignent ensemble quand il n'y a rien à valider. Un bouton du
haut qui promettrait une validation refusée par l'app serait un piège, pas un raccourci.

⚠️ **Et il dit quand c'est fait.** Après validation il devient « ✓ Passage enregistré — modifier ».
Sans ça, en haut de fiche, on ne saurait jamais si c'est enregistré — et on appuierait « au cas
où », ce qui est exactement le geste qui fabriquait des doublons.

⚠️ **Pleine largeur, délibérément**, et l'épreuve le garde (`largeur > 300 px`). C'est la largeur
qui le rend impossible à confondre avec la flèche verte d'à côté.

### Un détail vu seulement à la capture

Le libellé se collait à gauche : le bouton se lisait comme une étiquette, pas comme une action.
Centré, comme celui du bas.

---

## v1.15.1 — naviguer n'est pas valider

### Sa remarque, et ce qu'elle cachait

*« Quand je suis dans le déroulé et que je reviens sur un patient pour vérifier quelque chose, puis
que je retourne à ma place avec les flèches, il me compte ça comme un second passage. »*

La mesure a montré **pire que ce qu'il décrivait**. L'épreuve, écrite avant la correction :

```
le bouton du bas enregistre bien UN passage      ✓
→ avance au patient suivant                       ✓
… sans toucher au passage du 1er              ⚠ → 2
```

**Il n'y avait même pas besoin d'aller-retour.** Valider avec le bouton du bas, puis appuyer une
seule fois sur →, donnait déjà deux passages. Son geste de tous les jours.

### La cause

`seq.js` branchait ←, → et Quitter sur la même fonction, dont la règle était écrite dans le code :

> rien de saisi → on navigue sans rien enregistrer ; saisie présente → on enregistre puis on navigue.

Cette règle ne pouvait pas distinguer **un formulaire rempli par une saisie neuve** d'un **formulaire
rempli par le passage qu'on vient d'enregistrer** — un patient validé revient à l'écran avec ses
soins cochés. Pour `seqFormVide()`, ce n'est pas vide : la flèche enregistrait. Et comme le déroulé
enregistre en mode silencieux, la question « compléter ou garder deux passages ? » n'était même pas
posée. **Le doublon se créait sans un mot.**

### Le drapeau « touché »

La bonne question n'est pas *le formulaire est-il vide* mais **a-t-il bougé depuis le dernier
enregistrement**. C'est `f._touche`, posé sur tout `input` et tout clic, remis à zéro par les trois
sorties réussies de `commitVisit`.

⚠️ **Écouté en phase de CAPTURE, et les boutons du pied de formulaire sont exclus.** En phase de
bulle, le clic sur « ✓ Valider » arriverait *après* que l'enregistrement a remis le drapeau à zéro,
et le rallumerait aussitôt — le défaut serait revenu par la porte de derrière.

### Un seul chemin crée un passage

Il l'a dit lui-même : *« je valide toujours avec le bouton du bas »*. Les flèches ne font donc plus
que naviguer. C'est aussi la seule règle qu'on puisse expliquer en une phrase.

⚠️ **Mais on ne jette jamais une saisie.** Perdre ce qui vient d'être tapé est bien pire qu'un
doublon. Si le formulaire a été touché sans être validé, la saisie part dans « 💾 saisie gardée » —
le mécanisme qui existe déjà — et l'écran le dit. Le parcours complet (garder, revenir, reprendre,
valider) est éprouvé dans Chromium : il crée **un** passage, pas zéro, pas deux.

### Quatre suites gardaient la règle supprimée

- `_test_seq_nav` : « → avec saisie : Alpha enregistré et passe à Beta » — réécrite à la règle
  inverse, avec la raison dans le fichier.
- `_test_haptique` et `_test_tension` : trois recherches de texte sur du code qui n'existe plus
  (`await form._commitVisit(true)`). Réécrites pour garder l'inverse : *le déroulé ne valide plus de
  son côté*, *une saisie non validée est gardée*.
- ⚠️ `_test_seq_save` **est devenu vert sur du vide** : il validait par `#sq-next` et vérifiait que
  le passage était en base 70 ms plus tard. Le passage n'étant plus créé, il affichait
  « ✗ encore en attente »… **sans compter l'échec**, puisque la ligne n'était que journalisée. Il
  valide désormais par le bouton du bas, et l'échec compte.

### Un manque de l'environnement d'essai, comblé

`_restoreDraft` emploie `CSS.escape`, standard dans tout navigateur, que jsdom n'expose pas dans ce
contexte d'évaluation. Tant que le déroulé ne gardait pas de saisie, ce chemin n'était jamais
emprunté et l'erreur restait latente ; la correction l'a réveillée. Un bouchon `CSS.escape` est posé
dans la suite concernée — c'est un défaut de l'outil d'essai, pas de l'application, et le vrai
parcours est vérifié dans Chromium.

### Le manuel disait le contraire

> « Chaque passage est enregistré automatiquement quand tu passes au suivant — inutile de valider
> séparément. »

Cette phrase décrivait exactement le comportement qu'il fallait supprimer. Réécrite dans le manuel
et dans le guide de l'app, avec la règle et ce qu'elle remplace.

---

## v1.15.0 — le passage qui disparaissait avant d'avoir eu lieu

### Un défaut trouvé en préparant une fonctionnalité

Il voulait un troisième passage chez deux patients, temporairement. Avant de dessiner quoi que ce
soit, j'ai sondé l'application : un patient membre du **matin** et du **soir**, avec un seul passage
enregistré, celui du matin.

```
créneaux        : true
membre de       : matin, soir
statut en matin : done
statut en soir  : done        ← le problème
compteurs soir  : À voir = 0 · Vus = 1
```

**Le passage du soir disparaissait avant d'avoir eu lieu.** `statusOf(p)` répondait « vu » dès qu'il
existait *un* passage dans la journée, sans regarder le créneau — alors que chaque passage enregistre
pourtant le sien dans `v.slot`. La donnée était juste depuis le début ; c'est la lecture qui ne s'en
servait pas.

Ce défaut n'attendait pas le passage supplémentaire : il suffisait d'un patient vu matin **et** soir,
et il était là depuis que les créneaux existent. La fonctionnalité demandée n'aurait rien donné
par-dessus : le patient serait passé au vert au premier passage et les suivants se seraient évaporés.

⚠️ **L'épreuve a été écrite avant la correction et vérifiée en rouge.** `pw_creneaux.js` tombait sur
`done` au lieu de `todo` et sur « à voir = 0 ». *Une épreuve qui ne tombe pas sur le défaut qu'elle
garde ne garde rien.*

### Le statut se lit par créneau, et par rang

`statusOf(p, slot, rang)`. Deux ajouts, et une règle de non-régression :

- **le créneau** filtre les passages du jour sur `v.slot` ;
- **le rang** sert au passage supplémentaire : le Nᵉ passage enregistré dans un créneau remplit la
  Nᵉ occurrence, **dans l'ordre des heures**. Aucun champ nouveau sur la visite — on compte. Un champ
  de plus aurait fallu l'écrire à la saisie, le migrer, et le réparer quand il manque.
- **sans créneaux, rien ne change** : `slot` arrive indéfini, le filtrage ne s'applique pas, le rang
  vaut 1, la réponse est exactement celle d'avant. C'est le gros des dossiers existants, il ne doit
  rien sentir — et l'épreuve le vérifie explicitement.

### Le passage supplémentaire : un rang, pas un créneau

Il a écarté lui-même le créneau de midi : *« pas forcément à midi, juste une option sur la carte
patient qui indique passage supplémentaire dans la matinée ou le soir »*. Donc pas de quatrième
pastille sur la barre Moment, et pas de structure permanente pour un besoin de quelques semaines.

⚠️ **La clé d'occurrence.** L'ordre de passage est une liste d'identifiants de patients ; le même ne
peut pas y figurer deux fois. Le second rang y entre sous `p1#2` — **une chaîne**, que les tableaux
existants acceptent sans changer de forme. Aucune migration, et une sauvegarde ancienne se relit
telle quelle.

⚠️ **Un rang jamais placé tombe en fin de créneau.** `indexOf` rend −1 et le tri renvoie les inconnus
à la fin : mieux vaut le trouver en bas et le remonter que le voir surgir au milieu de la tournée.

⚠️ **Le ménage du démarrage a failli l'effacer.** `init.js` purge les « fantômes » — les identifiants
d'un ordre qui ne correspondent à aucun dossier. Lue telle quelle, la chaîne `p1#2` n'est dans aucun
dossier : **le second passage aurait perdu sa place à chaque ouverture de l'app**, sans un message.
Le purgeur redescend désormais au dossier avant de juger. Trouvé en cherchant qui lit `patientOrder`,
pas en l'exécutant.

⚠️ **Pas de case à cocher sur un 2ᵉ passage** dans l'écran de composition. La décocher voudrait dire
quoi — le sortir de la tournée ? On le retire là où on l'a créé, sur le dossier. Une case qui ne peut
signifier qu'une chose ambiguë ne doit pas exister.

⚠️ **La date prévient, elle n'efface pas.** Une date qui supprime toute seule peut faire rater un
passage ; une date qui informe, non. Au jour dit, le dossier affiche « À retirer ? » et c'est
l'utilisateur qui retire.

⚠️ **La boîte « fusionner ou garder séparé » devait se taire.** Elle s'ouvre quand un deuxième
passage arrive dans le même créneau — utile pour un doublon accidentel, absurde chez un patient à
passage supplémentaire, où elle aurait été posée **tous les matins**. Elle ne se pose plus que
au-delà du nombre de rangs prévus.

### Ce que l'épreuve n'a pas vu, et la capture si

La ligne du 2ᵉ passage affichait **« vu aujourd'hui à 07:20 »** — l'heure du *premier*, lue par
`lastVisit`, qui rend le passage le plus récent du dossier. Un passage qui restait à faire se
présentait comme fait : exactement la confusion qu'on répare. Chaque rang lit maintenant **le sien**
(`visiteDuRang`). Trouvé en regardant une capture, pas en lisant le code, et garanti depuis par trois
contrôles.

### La rangée Affichage, refondue (maquettes A · B · C)

Il a signalé deux choses sur le même écran : la liste n'affichait pas la liste, et les deux boutons
étaient mal intégrés — « un en bout de ligne, l'autre au début de la ligne suivante ». En regardant,
j'ai trouvé **trois** défauts, dont deux invisibles à la capture.

**1. La vue Liste était purement ignorée en vue Journée.** La branche « sections Matin / Soir »
passait avant et ne consultait jamais `S.boardListe` : le bandeau annonçait « Listing — ordre de
passage » et l'écran continuait d'afficher des cartes. **Le bouton mentait.**

**2. Le bouton compact ne faisait rien quand la liste était allumée.** Toutes les règles de
`body.compact-board` visent `.pcard` ; aucune ne touche aux lignes du listing. On appuyait sur un
bouton qui ne répondait pas, sans que rien ne le dise.

**3. Deux natures de réglage dans une même rangée.** *Tous · Sans passage · Absents* répondent à
**quoi montrer** ; 📋 et ☰ à **comment le montrer**. Cinq pastilles de même forme dans la même boîte :
l'œil y lit une famille à cinq choix, elles débordent en 4 + 1, et les deux dernières sont des icônes
muettes — un `title` ne s'affiche jamais au doigt.

Trois mises en page lui ont été proposées **en maquette cliquable**, après qu'il a répondu, à juste
titre : *« tu me proposes 3 pistes sans visuel, comment je fais pour choisir »*. La maquette m'a fait
changer d'avis : je penchais pour A (la vue dans la ligne de titre), mais une fois dessinée, ses
icônes restaient indiscernables au doigt — le défaut qu'on voulait corriger survivait. **B** l'a
emporté : deux rangées titrées, *Afficher* et *Vue*, et un sélecteur segmenté **Cartes · Compact ·
Liste** où les trois états sont visibles, nommés, et exclusifs. L'exclusivité supprime le mensonge
n° 2 au lieu de l'habiller.

Et en vue Journée, **J1** : les sections restent, avec leurs compteurs et leur repli, et ce sont
leurs contenus qui passent en lignes. La liste est une façon de **dessiner**, pas de trier.

⚠️ `ligneDe` et `cardOf` sont désormais **une seule fabrique chacune**, partagée par la vue Liste et
par les sections. C'est ce partage qui répare le défaut n° 1 — deux fabriques auraient fini par
diverger, une seule ne le peut pas.

⚠️ `.slotsec-b` est une **grille à deux colonnes**, comme `#board` : sans en sortir, la liste s'y
retrouvait écrasée sur une demi-largeur. Exactement le défaut trouvé à la capture en v1.11.0, qui
serait revenu par une autre porte.

---

## v1.14.0 — les calculs : la concentration d'abord

### Ce qui a été demandé, et ce que ça voulait dire

Cinq phrases : les calculs de doses à améliorer, un tableau de conversion qui ne se limite pas à la
glycémie et à l'IMC, les équivalents des héparines, la seringue électrique mieux expliquée, la dose
mieux expliquée. En les lisant ensemble, elles disent une seule chose : **l'écran donnait des
nombres justes sans dire ce qu'il attendait.** Trois champs nus et un résultat. Celui qui sait déjà
s'en sort ; celui qui vient vérifier ne sait pas quoi mettre où.

### Les héparines — le refus, puis la révision

J'ai d'abord refusé « les équivalents des héparines » : il n'existe aucune équivalence officielle
entre HBPM, et en fabriquer une serait une recommandation. Il a répondu par une capture d'écran — un
tableau « 1 mL = 5 000 UI · 1 mg = 100 UI · 50 mg = 5 000 UI = 1 mL » — et « regarde les sources et
creuse ».

Il avait raison sur le sujet, et j'avais répondu à côté : sa capture parle de l'**héparine non
fractionnée**, pas des HBPM. Trois sources relues le 11/10/2026 :

| Source | Ce qu'elle dit |
|---|---|
| RCP ANSM, Héparine sodique Panpharma 5 000 UI/mL | ampoule 1 mL = 5 000 UI · flacon 5 mL = 25 000 UI · **aucun milligramme d'héparine** (seuls les excipients) · « Toutes les héparines n'étant pas à la même concentration, les prescriptions doivent être rédigées en U.I. » |
| ANSM, héparine calcique | **25 000 UI/mL** · seringues préremplies 5 000 UI/0,2 mL et 7 500 UI/0,3 mL **arrêtées**, plus disponibles en ville · restent 12 500 UI/0,5 mL et 20 000 UI/0,8 mL |
| MSF, héparine injectable | 1 000 et 5 000 UI/mL en IV, 25 000 UI/mL en SC · « Bien vérifier la concentration avant utilisation » · le ratio 100 UI/mg y concerne la **protamine** |

**Le facteur 5.** Le tableau de sa capture n'est vrai que pour la sodique. Devant une ampoule de
calcique, le même millilitre fait 25 000 UI. Entre les extrêmes de la gamme — 1 000 UI/mL en IV
faible et 25 000 UI/mL en SC — le facteur est de **vingt-cinq**.

C'est ce qui a décidé la forme : **pas un tableau, un calculateur**. Un tableau figé porte sa
concentration en creux ; un calculateur la demande en premier et ne calcule rien sans elle. Trois
raccourcis de présentation, une saisie libre « je lis l'étiquette », et le résultat **redit la
concentration employée** — « 4 mL à 5 000 UI/mL » — pour qu'un raccourci cliqué par erreur se voie
dans la réponse et pas seulement dans le bouton.

Les milligrammes existent quand même, parce qu'une vieille ordonnance peut en porter : **repliés,
derrière un dépliant, et étiquetés pour ce qu'ils sont** — convention d'étiquetage ancienne, absente
des RCP. Jamais au même niveau que les UI.

⚠️ **Ce qui n'y est pas et n'y sera pas** : passer d'une héparine à une autre. C'est une décision de
prescription, et aucun texte ne la fonde.

### La seringue électrique, en trois temps

Elle était un champ « concentration » qu'il fallait avoir calculé ailleurs. Elle est maintenant une
suite numérotée, chaque étape portant sa couleur :

1. **Ce qu'il y a dans la seringue** → ampoule et volume total après dilution donnent la
   concentration en mg/mL ;
2. **Ce qui est prescrit** → la posologie, dans l'unité de la prescription ;
3. **Ce qu'on affiche sur la pompe** → le débit en mL/h, et la **durée de tenue** de la seringue.

Quatre unités de prescription au lieu d'une : µg/kg/min, mg/h, mg/kg/h, UI/h. ⚠️ Le poids n'est
exigé que par les unités qui le portent dans leur nom — réclamer un poids pour des mg/h bloquerait
un calcul qui n'en a pas besoin.

La durée de tenue est le calcul que personne ne demande et que tout le monde refait : volume de la
seringue divisé par le débit. « Tient 11 h 54 » dit si la seringue passera la nuit.

### La dose : on recopie l'étiquette

Deux changements de fond. Les libellés ne demandent plus une « concentration » mais **ce qui est
écrit sur l'ampoule** : *dose de l'ampoule* et *volume de l'ampoule*. Et le calcul est
**bidirectionnel** — mg → mL pour préparer, mL → mg pour vérifier ce qui a été prélevé. Deux
pastilles, un seul jeu de champs.

La dose au poids affiche en plus la **répartition par prise** : 1 200 mg en trois prises font trois
fois 400 mg. C'est le chiffre qu'on reporte sur le pilulier.

### Les conversions — l'échelle entière d'un coup

Quatre nouveaux sous-écrans à côté de la glycémie et de l'IMC : **masse, volume, concentration,
héparines**. Les deux premiers n'affichent pas un résultat mais **toute l'échelle** : 250 mg se lit
d'un coup 250 000 µg · 250 mg · 0,25 g · 0,00025 kg, l'unité saisie mise en évidence. Un seul coup
d'œil remplace quatre conversions successives.

La concentration traduit un pourcentage en g/L et donne la masse contenue dans une poche : 0,9 %
font 9 g/L, et 4,5 g dans 500 mL. Le G5 % d'une poche de 500 mL contient 25 g de glucose — ce qu'on
cherche sans l'avoir sous la main.

⚠️ `calcNb()` : `toPrecision` bascule en notation scientifique sous 1e-6, et « 2.5e-4 » n'est pas un
nombre qu'on lit au chevet d'un patient. L'autre moitié de la fonction pose l'**espace fine
insécable** des milliers : 250 000 et non 250000, parce qu'une dose d'héparine ne se compte pas du
doigt zéro par zéro.

### Un défaut d'architecture trouvé en ajoutant un résultat

⚠️ `calcMajResultats()` appariait **une liste de noms à l'ordre des blocs** dans le DOM. Ajouter un
résultat au milieu de l'écran décalait silencieusement tous les suivants : le volume s'affichait à
la place du débit. Les blocs portent désormais un `data-cr` et chacun est visé par son nom. Le
défaut était latent depuis l'origine — il ne pouvait se déclencher qu'au premier ajout en milieu
d'écran, c'est-à-dire ici.

⚠️ `champ()` n'échappe plus son libellé, pour permettre « Volume **total** après dilution ». Tous
les libellés sont des littéraux du module ; **aucune donnée de dossier n'entre dans un libellé**, et
le commentaire le dit à l'endroit du code où la tentation reviendra.

### L'épreuve, et la seule manière de lui faire confiance

`tests/navigateur/pw_calculs.js`, environ soixante contrôles. En-tête du fichier :

> CHAQUE RÉSULTAT EST VÉRIFIÉ CONTRE UN NOMBRE CONNU D'AVANCE, pas contre ce que rend le code. Un
> contrôle qui recalcule avec la même formule que celle qu'il garde ne garde rien.

Les valeurs de contrôle sont posées à la main : 250 mg = 250 000 µg = 0,25 g · 0,9 % = 9 g/L = 4,5 g
dans 500 mL · G5 % dans 500 mL = 25 g · 250 mg/50 mL = 5 mg/mL, soit 4,2 mL/h à 5 µg/kg/min pour
70 kg, et la seringue tient 11 h 54 · 500 mg dans 5 mL → 3,5 mL pour 350 mg · 60 mg/kg × 20 kg =
1 200 mg = 400 mg × 3 · 20 000 UI à 5 000 UI/mL = 4 mL · 1 mL de calcique = 25 000 UI · 40 mg
d'énoxaparine = 4 000 UI.

### Ce qui a été écrit à côté du code

Le chapitre 35 du manuel est réécrit — « La seringue électrique, en trois temps », « La dose : on
recopie l'étiquette », « Les conversions d'unités », « Les héparines — la concentration d'abord ».
Et l'écran de la base des médicaments porte un bloc de guide, là où on arrive quand on cherche une
présentation.

### Décisions prises sans réponse

Les deux maquettes posaient huit questions ; la réponse a été « Ok vas y ». Les préférences
annoncées ont été retenues, et sont **toutes réversibles** : conversions en échelle entière
(disposition A) · les trois unités de seringue supplémentaires, pas seulement mg/h · durée de tenue
affichée · milligrammes d'héparine repliés et étiquetés (option B) · trois raccourcis de présentation
plus la saisie libre · rappel de concentration sous le résultat · carte de lecture des présentations
intégrée aux raccourcis de l'écran Calculs plutôt qu'à la base des médicaments.

---

## v1.13.0 — l'écran vide qui enseigne

### Quatre défauts sur un seul écran

L'onglet **Infos** d'un dossier neuf. Il demandait « comment mieux comprendre l'ajout » ; en lisant
l'écran, j'ai trouvé quatre choses, pas une.

**1. La règle arrivait avant les faits.** On expliquait « relève » et « fiche » au-dessus d'une liste
vide — elle décrivait des pastilles qui n'existaient pas encore — et au moment où elle compte, la
première ligne créée, elle était loin au-dessus. Elle vit maintenant **sous la liste**, et seulement
à partir du moment où il y a une pastille à régler.

**2. Les six types étaient cachés derrière un bouton générique.** L'écran de choix les explique très
bien, mais il fallait deviner qu'il existait. L'écran vide citait des exemples **en gris, non
touchables**. Les types tiennent désormais la place eux-mêmes, et la grille se replie en un bouton
dès la première information. Deux gestes au lieu de trois.

⚠️ `ajouterInfo(type)` est **le seul chemin de création** : le bouton apporte `null` et passe par la
grille, la tuile apporte déjà son type. Deux chemins séparés auraient fini par diverger.

⚠️ `dessineAjout()` est appelée **à chaque dessin**, en fin de `drawInfos`. Sans cela, supprimer la
dernière information laissait un écran vide **sans aucun moyen d'ajouter quoi que ce soit**.

**3. Trois boutons en pointillés du même poids.** Les deux « document » passent sous un intertitre
*Depuis un document*, en corps réduit : ce sont des chemins de traverse.

**4. « Documents rattaché ».** Le `s` était posé sur l'adjectif, le nom écrit au pluriel en dur. On
lisait l'accord fautif sur tout dossier comptant moins de deux documents — c'est-à-dire presque
partout. Nom et adjectif s'accordent maintenant ensemble, et « ordonnance » étant féminin, les deux
blocs ne disent pas la même chose.

### Les appareillages : deux endroits, assumés

Le champ libre de l'onglet et la rubrique « Appareillage & matériel » du type *Autre* font double
emploi. Il a demandé à **garder les deux** : on l'écrit à l'écran plutôt que de laisser découvrir
qu'il y en a deux — l'un se remplit vite, l'autre se range et puise dans un catalogue.

### Le piège de l'accent grave, deuxième fois

Un commentaire HTML contenant un accent grave, à l'intérieur d'un gabarit : il referme la chaîne et
casse tout le fichier. Je l'avais rencontré en v1.11.0, **documenté**, et j'y suis retombé.

Le contrôle de syntaxe le voyait déjà, mais annonçait « missing ) after argument list » au milieu
d'un autre module : on cherchait au mauvais endroit. `build.js` **nomme maintenant le fichier, la
ligne et le commentaire**.

⚠️ Et mon premier jet du garde-fou cherchait l'accent grave « quelque part entre un `<!--` et un
`-->` » : l'expression traversait plusieurs commentaires et **accusait cinq modules sains**. On
découpe d'abord les commentaires, puis on cherche dans chacun. Un garde-fou qui crie au loup ne
garde rien.

### Deux contrôles faux, dans mon épreuve

⚠️ `/Document rattaché\b/` — en JavaScript, **« é » n'est pas un caractère de mot** : `\b` ne fait
pas frontière après lui. L'expression ratait « rattaché » suivi d'une espace et attrapait
« rattachés ». Trois contrôles rouges sur du code juste. On compare le libellé exactement.

⚠️ Et supprimer toutes les lignes d'un coup ne marchait pas : `drawInfos()` reconstruit la liste
après le premier retrait, les boutons suivants étaient déjà détachés. L'épreuve relit le document
entre chaque suppression.

### Le catalogue des soins

« Instillation oculaire (collyre) » ajoutée à **Gestion médicamenteuse et coordination** — le seul
chapitre qui lui convienne, à côté de « Distribution / Aide à la prise », qui est le même geste par
voie orale. Les voies nasale, auriculaire, cutanée et rectale manquent encore ; à compléter quand le
besoin se présentera plutôt que d'allonger la liste au hasard.

---

## v1.12.2 — `--bg` n'est pas une surface

Sur le thème **Île de la Réunion**, les blocs en creux des écrans — champs du cabinet, lignes de
médecins, rangées d'annuaire, cartes de catalogue — sortaient en **ardoise foncée sous du texte
sombre**. Contraste mesuré : **1,32:1**, contre 4,5:1 pour du texte lisible.

### La cause n'était pas dans le thème

Vingt-huit règles peignaient ces blocs avec `background:var(--bg)`, pour les faire paraître
enfoncés dans la surface. Ça marche tant que `--bg` est **du même côté** que `--surface`.

⚠️ Réunion est le **seul** thème où ce n'est pas vrai : il pose un décor en image, et son `--bg`
est la couleur de ce DÉCOR — `#2B3A46` — pendant que ses surfaces sont crème. Les vingt-huit blocs
se retournaient d'un coup.

### Le jeton plutôt que le rustine

`--inset`, défini dans `:root` comme `var(--bg)`. Aucun thème ne bouge — c'est vérifié jeton par
jeton sur les neuf thèmes — et Réunion lui donne sa propre valeur, un crème un peu plus profond que
sa surface. Rapiécer vingt-huit règles aurait laissé le piège intact pour le thème suivant.

⚠️ **Trois dépassements, rattrapés.** Mon remplacement avait aussi touché trois
`background-color:var(--bg)` qui ne sont PAS des panneaux en creux mais des **sous-couches
opaques** : leur couleur visible vient du `background-image` posé juste après. L'une d'elles
(`[data-fini] .sheet`) forme une paire avec la ligne au-dessus, restée en `--bg` : les deux
n'auraient plus dit la même chose.

### Ce que l'épreuve mesure

`pw_themes.js` calcule le contraste WCAG réel sur neuf thèmes, pour les deux familles de champs
(`.lc-in` des listes et `.rec-in` du recueil — elles ont des règles de fond DIFFÉRENTES, et un
contrôle sur une seule aurait laissé l'autre passer).

⚠️ Les fonds sont translucides : prendre leur couleur brute donnerait un contraste imaginaire.
L'épreuve **compose** chaque couche sur celle du dessous avant de mesurer.

Vérifié en retirant la correction : l'épreuve rend bien **1,32:1** sur Réunion. Une épreuve qui ne
tombe pas sur le défaut qu'elle est censée garder ne garde rien.

---

## v1.12.1 — le jeu : un bouton qui en cachait deux

### Le bouton de sortie recouvrait les boutons du jeu

`#jeu-sortie` était posé en `position:fixed; top:10px; right:12px` **par-dessus le cadre** du jeu.
Or `tubulure.html` met ses propres boutons **🏆 SCORES** et **🔊 SON** exactement là.

⚠️ **Les scores étaient donc inatteignables** — et impossible à deviner : le bouton semblait
simplement mal placé, pas coupable. Deux remarques de l'utilisateur (« le bouton Quitter n'est pas
terrible » et « je ne vois pas la liste des scores ») n'en faisaient en réalité **qu'une**.

Le cadre vit maintenant sous une **barre** à lui. Rien ne se superpose, et le retrait de la barre
d'état du téléphone (`env(safe-area-inset-top)`) vit **dans cette barre**, une fois pour toutes :
auparavant l'heure d'Android se posait sur le titre du jeu.

### Le pavé se trouve au pouce, pas à l'œil

56 × 44 px, 6 px d'écart, au milieu d'un grand vide noir. On regardait le pavé au lieu de regarder
le jeu. Il descend (`.app-container` remplit la hauteur, `space-between` pose le moniteur en haut et
le pavé en bas), il grossit, et surtout il **s'écarte** — c'est l'écart entre les touches, pas leur
taille, qui permet de les distinguer sans les voir.

⚠️ Tailles en `min(<n>vw, <max>px)` : sur un petit écran le pavé rétrécit au lieu de déborder. Une
rangée de boutons coupée serait pire que des boutons petits. Le cadre du jeu garde son
`aspect-ratio:1/1` : il ne se déforme pas, c'est l'espace entre les blocs qui s'étire.

### Un tableau vide est indiscernable d'un tableau cassé

`getHighScores()` rend `[]` si le stockage est refusé. On affichait alors quatre en-têtes au-dessus
de rien. Une phrase le dit désormais.

### Deux erreurs de mon épreuve, pas de l'application

⚠️ Le contrôle « les touches commandent toujours le jeu » interrogeait une variable `nextDir`
**qui n'a jamais existé** : il passait au vert sur `null === null`. Le vrai nom est
`gameState.nextDirection`.

⚠️ Et forcer `gameState.running = true` à la main faisait tourner la boucle sur un état jamais
initialisé : l'erreur qui en sortait était ensuite attribuée à l'application par le contrôle de
console suivant. **Une erreur fabriquée par l'épreuve elle-même est pire qu'une épreuve absente.**
On lance la partie par son vrai bouton.

---

## v1.12.0 — deux raccourcis, et un cul-de-sac refermé

### ① Inscrire au cabinet un médecin saisi dans un dossier

`🏥 Depuis le cabinet` ne marchait que **dans un sens**. Un médecin découvert chez un patient
restait prisonnier de ce dossier et se retapait au patient suivant.

`cabInscrire({nom, metier, tel})` le crée en **partenaire** — jamais en « praticien », qui est
réservé à l'IDEL et ses confrères — et la famille se déduit toute seule du métier par `cabFamille`.

⚠️ **Jamais de doublon.** `cabMemeNom` compare les noms normalisés : un contact déjà présent est
**rendu** plutôt que recopié, et l'appelant s'y rattache. Le compte rendu distingue les deux cas, et
on le DIT — sinon l'IDEL croirait avoir créé une fiche et chercherait un doublon qui n'existe pas.

⚠️ `« traitant »` est un **rôle auprès d'un patient**, pas un métier : il n'a aucun sens dans un
annuaire partagé entre dossiers. On retient « Médecin », vrai dans tous les cas, plutôt que de
deviner « généraliste ».

⚠️ `_versCab` est un **état d'écran** : une intention, pas une donnée. `nettoyerContacts` la retire
à l'ouverture comme à l'enregistrement — sinon elle serait partie vers les collègues à la synchro,
et aurait réinscrit à chaque réouverture de fiche.

Deux moments d'écriture, et c'est voulu : la **fiche de renseignements** a un « Annuler », donc
l'écriture attend l'enregistrement (cocher puis annuler doit laisser l'annuaire intact) ; la **fiche
de recueil** enregistre au fil de la saisie, donc elle écrit tout de suite — il n'y a rien à
annuler, et un orphelin est impossible.

⚠️ **Le défaut que le navigateur a donné et que la lecture n'aurait pas donné :** la pastille était
écrite **sous condition du nom**… mais taper un nom ne redessine pas la ligne (le champ range sa
valeur, c'est tout). Elle n'apparaissait donc jamais. Le bloc est maintenant **toujours émis** et
simplement masqué : un redessin à chaque frappe aurait volé le focus au champ suivant.

### ③ L'ordonnance qui n'existe pas encore

`choisirDocLien` ne proposait que les documents **déjà** au dossier, et répondait « ajoute-le
d'abord dans 📎 Documents » quand il n'y en avait aucun. Sept gestes pour en faire un.

`_ordoEnCours` est de la même famille que `_plaieEnCours`, qui faisait déjà ce trajet pour les
photos de plaie : **même rail, pas un nouveau**. Le raccourci emprunte l'import habituel, le
pré-règle, et sait revenir — avec le document **déjà rattaché**, sinon il n'aurait fait gagner qu'un
écran sur sept.

⚠️ **On impose la FAMILLE, jamais le TYPE.** `docFamImposer("presc")` retire les autres familles de
l'écran de qualification : pas de compte-rendu d'imagerie rattaché par erreur à un plan de
traitement. Mais entre ordonnance médecin, IDE, kiné, biologie et matériel, **choisir serait
deviner** — et un document mal typé est pire qu'un document à typer.

⚠️ **Toutes les sorties ferment le voyage**, pas seulement la réussie : « Annuler » de l'écran des
sources, la flèche de la barre (sans elle, `openSheet` posait `closeSheet` et on sortait en laissant
l'état ouvert), la qualification abandonnée, et l'arrivée normale sur 📎 Documents. Un état laissé
derrière soi aurait rattaché la **prochaine photo de plaie** à la fiche de traitement.

⚠️ L'en-tête de la famille imposée **ne se replie pas** : un toucher malheureux aurait caché les cinq
seuls types disponibles, sans rien d'autre à ouvrir à la place.

⚠️ Le plafond de 5 rattachements est **relu à l'arrivée** : il a pu être atteint pendant le voyage.
Le document reste alors au dossier et on le dit — on ne le perd pas.

### ② reporté

« Reprendre un médecin du cabinet en un geste » : dans le code actuel, `＋ Ajouter un médecin` et
`🏥 Depuis le cabinet` sont **déjà côte à côte au même niveau**, et le second n'exige pas de passer
par le premier. Soit la version installée est antérieure, soit il s'agit d'un autre écran. On
attend la vidéo plutôt que de corriger un écran non identifié.

---

## v1.11.0 — six remarques d'usage, et trois boutons qui ne faisaient rien

Six demandes après quelques jours de tournée. Trois se sont révélées être des **défauts**, pas des
manques : un bouton qui ne répondait pas, un bouton qui jetait les deux tiers de sa donnée, et un
écran livré deux jours plus tôt qui servait le mauvais usage.

### ③ « Le prescripteur reste bloqué » — deux boutons qui n'en étaient qu'un

Reproduit à partir de la vidéo, puis isolé : un médecin ajouté **à la main** recevait un `id:uid()`.
Un médecin **repris depuis l'annuaire du cabinet**, non — `cabChoisir()` rendait
`{ nom, tel, spec, cabRef }` et rien d'autre.

⚠️ Conséquence sur la fiche de traitement : `data-tpr="${esc(m.id)}"` avec `m.id` indéfini donne
`data-tpr=""`, **exactement la valeur de la pastille « Médecin traitant »**. Les deux boutons
étaient le même bouton. Toucher le spécialiste reposait `presc = ""` : l'écran se redessinait, et
rien ne changeait. D'où « je clique plusieurs fois mais rien ne se passe ».

Réparé des deux côtés : `_idsContacts()` pose un identifiant **à la lecture** (les dossiers déjà
saisis sont concernés, et personne ne va les rouvrir un par un), et la reprise depuis l'annuaire en
pose un à la source. `cabRef` dit **d'où** vient le contact, `id` dit **qui** il est au dossier :
deux choses différentes, qu'on avait confondues en n'en gardant qu'une.

### ② Le GPS — deux boutons pour le même geste, un seul juste

`adresseComplete()` existait et joignait adresse + CP + ville. La pastille 📍 des cartes l'utilisait.
Le bouton 🗺️ GPS de la fiche faisait `encodeURIComponent(p.address || "")` : **il jetait le code
postal et la ville**. D'où le contournement de l'utilisateur — recopier la ville dans la ligne du
haut — et la répétition qui se retrouvait ensuite partout où l'app réassemble.

La cause de fond est plus ancienne : avant que le CP et la ville aient leurs propres cases, tout
tenait sur une ligne. Les dossiers de l'époque, et les sauvegardes de l'époque, portent la
répétition **en donnée**. D'où `adresseRepetition()` et un écran de reprise.

⚠️ **Le piège, trouvé par un essai et pas par une relecture :** mon premier jet coupait aussi une
ville seule en fin de ligne, et transformait **« 3 rue de Toulon » en « 3 rue de »** pour un dossier
à Toulon. Le commentaire au-dessus prétendait justement que ce cas était protégé. La règle est
maintenant : on ne coupe que sur le **code postal**, ou sur une ville **précédée d'une ponctuation**.
Conséquence assumée : « 12 rue des Lilas Toulon », sans code postal ni virgule, n'est pas corrigé —
laisser une répétition est moins grave que mutiler un nom de rue.

Deuxième piège du même essai : le **tiret cadratin** « — » n'est pas le trait d'union « - ». Ma
classe de caractères ne le voyait pas et laissait « 12 avenue de la République — » derrière elle.

### ⑥ Le listing — un écran livré deux jours plus tôt pour le mauvais usage

La vue ☰ de la v1.10.0 faisait déjà une liste, mais **alphabétique et nom seul** : elle servait à
*retrouver* quelqu'un, pas à *faire* la tournée. Plutôt qu'un troisième affichage, elle est reprise :
ordre de passage **par défaut**, lignes enrichies, A→Z en second tri.

⚠️ Les séparateurs de lettres ne sortent plus qu'en alphabétique. C'est précisément ce qu'il
reprochait : une ligne de plus tous les deux patients, pour rien.

Trois défauts qu'aucune relecture n'aurait donnés, et que la **capture d'écran** a donnés tout de
suite :
- `#board` est une **grille à deux colonnes** (c'est elle qui range les cartes). Le listing y était
  écrasé sur une demi-largeur, les noms coupés à « M… ». **C'était déjà vrai de la v1.10.0.**
- Sur un dossier chargé, la dernière pastille **se coupait en deux**. Bornées à trois, le reste
  compté en « +2 ».
- L'âge poussait le nom à se tronquer. L'âge cède sa place avant le nom.

Les informations de droite suivent le réglage des cartes (`carteMontre`, `vitalsHtml` avec le
dossier en paramètre). Deux réglages pour deux écrans qui montrent la même chose, c'était un
réglage de trop.

### ④ Un troisième rythme

`sibesoin` seul ne couvrait pas le Prolia semestriel ni le méthotrexate du lundi. `l.freq` est un
**texte libre**, et `traitRythme()` / `traitPoso()` sont les **seuls** endroits qui tranchent et
rédigent — la posologie était recopiée en cinq points (écran, tableau, fiche, DLU, export) : ajouter
un rythme aurait voulu dire cinq corrections, dont une oubliée.

⚠️ **Aucune date de prochaine prise n'est calculée.** Une date fausse sur une injection semestrielle
est plus dangereuse qu'une phrase qu'on relit. C'est écrit à l'écran, pas seulement dans le code.

En prime, l'import de classeur en profite : « 1 fois par mois » tombait dans « fréquence non
comprise » et partait en remarque ; il a maintenant une case.

### ⑤ Douze formes, et une liste qui mentait

Cinq cases (gélule, spray, inhalation tombaient toutes dans « Autre ») → douze. ⚠️ **Les cinq codes
d'origine ne changent pas** : ils sont écrits dans les dossiers déjà saisis. On ajoute, on ne
renomme pas.

⚠️ Piège d'ordre dans la table de lecture, trouvé au navigateur : **« dispositif TRANSDERMIQUE »
contient « dermique »**, et la pommade l'attrapait. `patch` passe avant `pom`, et la table va
désormais du précis au large.

⚠️ La liste déroulante du classeur Excel était **recopiée à la main** : elle annonçait cinq formes
quand l'app en proposait douze. Elle se construit depuis `FORMES`.

### ① Une coordonnée se touche

La demande portait sur les e-mails. Le constat est plus large : **aucune coordonnée n'était
actionnable dans l'annuaire, pas même les téléphones**. `cabLien()` est le seul endroit qui fabrique
un lien, et il rend `null` quand il n'y a rien à faire — un fax ne se compose pas depuis un
téléphone. Le bouton n'existe alors pas ; il n'est pas grisé.

⚠️ Les boutons d'action sont **hors** du bouton de la ligne : un bouton dans un bouton n'est pas du
HTML valide, et le toucher partait au mauvais des deux sur Android. Même découpage que les rangées
du listing.

### Le quatrième numéro écrit à la main

Le **pied de page de l'écran d'accueil** annonçait `v1.7.3` alors que l'app était en `1.10.0` —
sept versions de retard, sous les yeux de l'utilisateur à chaque ouverture. Troisième après le
manuel et le livrable. `build.js` l'écrit désormais depuis `package.json`.

⚠️ Et mon premier contrôle de ce remplacement criait au loup à chaque reconstruction sans montée de
version : il testait que le texte avait **changé**, au lieu de tester que le motif **existait**.

### Les suites qui ont protesté, et qui avaient raison

`_test_recueil_import` gardait « gélule rangée en comprimé », « sirop rangé en gouttes », « une
pommade tombe dans Autre ». Ces contrôles disaient vrai pour la v1.10.0. Ils sont **retournés, pas
supprimés** — et le piège `patch`/`pom` y est maintenant gardé explicitement.

⚠️ Ce contrôle-là s'est trompé une première fois : `["pom",` apparaît **aussi** dans la déclaration
des douze formes, bien avant la table de lecture. Il comparait deux endroits sans rapport. On
découpe la table d'abord, puis on y cherche.

### Un accent grave dans un commentaire HTML

`<!-- ⚠️ `type="email"` ET … -->` à l'intérieur d'un gabarit : l'accent grave **referme la chaîne**
et rend tout le fichier invalide. Invisible à la lecture, attrapé par le contrôle de syntaxe de
`build.js`.

---

## v1.10.0 — alertes vivantes, créneaux par tournée, et ce qui était invisible

### Les alertes — le socle existait, et il était cassé

`@capacitor/local-notifications` était installé **depuis longtemps**, et
`scheduleRappelNotifications()` programmait déjà J-3, J-1 et le jour J à 8 h pour tout rappel daté.
Mais rien ne l'annonçait, rien ne permettait de l'éteindre — et surtout :

⚠️ **LE BRANCHEMENT N'AVAIT JAMAIS ÉTÉ INSTALLÉ.** seq.js déclarait

```js
const _hookedSave = function(){ _origSave.apply(this, arguments); scheduleRappelNotifications(); };
```

…et ne l'assignait **nulle part**. `save` n'était jamais remplacé, donc les notifications n'étaient
reprogrammées **qu'au démarrage de l'app** : un rappel créé en tournée ne programmait rien.
Même famille que le `pointer-events:none` du message — du code qui a l'air d'être là et qui ne
tourne pas. Le vrai branchement vit maintenant dans `alertes.js`, remplace réellement `save`, et
temporise de 800 ms (une saisie déclenche plusieurs enregistrements d'affilée).

⚠️ **Les trois permissions Android n'avaient jamais été déclarées** dans `postcap.js` :
`POST_NOTIFICATIONS` (sans elle, depuis Android 13, l'autorisation ne peut même pas être demandée),
`SCHEDULE_EXACT_ALARM` et `USE_EXACT_ALARM` (sans elles, depuis Android 12, le système décale
l'alerte, voire l'avale si le téléphone dort).

### Une seule mécanique, notes et rappels

Objet `alerte` identique des deux côtés : `{ on, date, heure, avant[], repete, tel, app, vu }`.
`alerteBloc(obj, pre, dateFixe)` rend l'écran, `alerteBind()` le câble, et le préfixe `pre` permet à
deux blocs de coexister. Deux mécaniques séparées auraient divergé au premier changement.

⚠️ **`on:false` par défaut — trouvé en éprouvant au navigateur.** Avec `on:true`, le simple fait
d'ouvrir l'éditeur d'une note posait une alerte active, et le premier toucher de l'interrupteur
l'**éteignait** au lieu de l'allumer. Et `alerteNettoyer()` retire une alerte éteinte plutôt que de
la garder morte dans les données, où elle partirait en synchro.

⚠️ **Canal d'importance BASSE (2), sans son ni vibration** — il l'a demandé explicitement : un simple
affichage dans la barre d'Android. On travaille chez des patients.

⚠️ **Le bandeau à l'ouverture** (`alertesBandeau()`, redessiné à chaque `render()`) rattrape ce que
la notification rate : téléphone silencieux, notification balayée, app rouverte trois jours plus
tard. Le **retard est en rouge, à part** : une alerte passée inaperçue est celle qui comptait. Le
`✓` marque la date comme acquittée (`alerte.vu`) et **n'efface ni la note ni le rappel**.

⚠️ L'autorisation se demande **au moment où l'utilisateur pose sa première alerte**, pas au
démarrage : une permission réclamée sans raison visible se refuse par réflexe, et ne se redemande
plus.

### Savoir que c'est enregistré

⚠️ **LE TÉMOIN EXISTAIT, MAIS `.veil` LE RECOUVRAIT.** `#save-badge` vit dans la barre du titre ;
`.veil` est `position:fixed; inset:0; z-index:90` avec un voile noir à 55 %. Or **on modifie ses
données dans les panneaux**. Le seul témoin de l'application était donc invisible exactement au
moment où il sert. `navHeader()` en pose un dans chaque barre de panneau, et `majBadges()` met les
deux à jour ensemble — deux témoins qui diraient des choses différentes seraient pires qu'un seul.

⚠️ **L'échec est le cas qui compte.** Il partait dans un journal que personne ne lit : le témoin
reste désormais **rouge** (`.save-badge.ko`, « ⚠ non enregistré ») tant que l'écriture n'a pas
abouti, contrairement au ✓ qui s'efface au bout de 3 s.

`prisEnCompte(sel)` affiche « ✓ pris en compte » **sous la section**, pas sous chaque champ : trente
petits ✓ qui s'allument sur un écran de recueil, c'est du bruit, pas une réponse. Branché sur
`recueil.js` (dans `maj()`, seul point de passage après chaque enregistrement) et sur
`traitement.js` (drapeau `_trTouche`, pour ne pas l'afficher au simple affichage de la fiche).

⚠️ **Aucun bouton « Enregistrer » ajouté** là où l'app sauvegarde déjà seule. 38 écrans en ont un,
les autres écrivent au fil de l'eau ; en mettant le bouton partout on créerait le doute inverse —
« si je n'appuie pas, est-ce que je perds ? »

### Les créneaux, tournée par tournée

`S.slotsEnabled` était **commun à toutes les tournées**, lu à **30 endroits dans 8 modules**. Un
helper unique, `slotsOn(tour)` dans globals.js, et les trente lectures y passent — elles auraient
divergé une par une. `slotsData()` reprend l'ancien réglage global sur chaque tournée à la première
ouverture : on retrouve exactement ce qu'on avait, puis on éteint tournée par tournée.

⚠️ **ÉTEINDRE N'EFFACE RIEN.** `S.slotMembers` et `S.slotOrder` étaient déjà rangés par tournée :
l'interrupteur masque, il ne détruit pas, et rallumer retrouve tout. C'est le genre de décision
qu'on regrette quand elle a été prise dans l'autre sens.

⚠️ `slotsOn("all")` et `slotsOn("none")` rendent **faux** : en vue d'ensemble, deux tournées peuvent
être réglées différemment. Et `engine.js` interroge le réglage **de la tournée concernée** : une
relève peut en couvrir plusieurs.

Interface : pastille `☀️🌙` sur chaque ligne de tournée (à côté de 👥 et 🔐, déjà par tournée), le
même interrupteur en tête de l'écran de composition, et le bouton global réduit à « tout activer /
tout éteindre ».

### Vue liste du Moniteur

Bouton `☰` **séparé** du `📋` existant, pas un troisième état : un bouton qui tourne entre trois
valeurs ne se devine pas, et on ne peut pas revenir en arrière d'un geste. Tri **alphabétique** avec
les lettres en intertitre — cette vue sert à retrouver quelqu'un, les cartes gardent l'ordre de
passage.

⚠️ **La pastille de statut et le repère de vigilance RESTENT**, contre la demande littérale (« juste
nom prénom »). C'est la règle posée pour les réglages d'affichage des cartes : *un réglage
d'affichage ne doit jamais cacher une alerte*. Deux pastilles de 9 px ne gênent pas la lecture d'un
nom ; une liste qui masquerait une vigilance serait l'écran où l'on passe à côté de quelque chose.

### Archives par cabinet

⚠️ **Le cabinet est INSCRIT à la mise de côté** (`p.archCab`), pas déduit plus tard. Il se déduit de
la tournée — mais si cette tournée est renommée ou supprimée après coup, le lien se perd.
« Appartenance initiale » veut dire **figée**. Les dossiers déjà archivés reçoivent le leur une
bonne fois (`archGroupes()`), puis c'est écrit. Groupes repliables, comme l'annuaire des
partenaires : même geste, même habitude.

### La base des médicaments : 226 → 267

Deux familles manquaient, désignées par deux noms introuvables un matin de tournée —
**Coaprovel** et **Binocrit**. Ce n'étaient pas deux oublis mais deux trous structurels : la base
avait onze associations et **aucune en cardiologie**, et un ou deux noms par molécule injectable
alors que neuf groupes de biosimilaires sont substituables en officine depuis l'arrêté du
20 février 2025.

32 associations fixes portent `asso:true` et un filtre les isole. ⚠️ **Chacune rappelle qu'elle est
UNE seule ligne de traitement, pas deux** — le piège de la double posologie, déjà rencontré à la
lecture d'ordonnance. Un test vérifie que les 32 le portent : au premier jet, **15 ne l'avaient
pas**.

⚠️ **Repêchage par mots** : les ordonnances portent des noms composés
(« IRBESARTAN/HYDROCHLOROTHIAZIDE ARROW ») qui ne tombent sur rien cherchés en entier. L'écran
redécoupe et propose les mots qui donnent un résultat.

Deux corrections de nomenclature vérifiées en source : **COSIMPREL** (et non « Cosyrel », qui
n'existe pas en France), et ézétimibe + atorvastatine qui n'y a **aucun nom de marque**.

### Les boîtes grises d'Android

Neuf `confirm()` natifs subsistaient alors que l'app a `askDialog` depuis longtemps — dont un sur le
chemin de restauration d'un dossier archivé. Tous remplacés. ⚠️ `askDialog` **s'attend** : six
fonctions appelantes ont dû passer en `async`, dont deux `setTimeout(() => …)`.

### Pièges d'épreuve rencontrés

⚠️ Un script Python qui échoue sur une assertion **n'écrit rien** : quatre remplacements avaient
l'air appliqués et ne l'étaient pas. Vérifier le fichier, pas la sortie du script.

⚠️ `node --check` sur **engine.js** échoue — et c'est normal : c'est l'un des modules volontairement
incomplets, refermé par share.js. **Seul `node build.js` fait foi.**

---

## v1.9.1 — la documentation rattrape trois versions

⚠️ **POURQUOI UNE VERSION À PART.** La v1.9.0 était déjà poussée et taguée quand ces correctifs sont
arrivés. Le workflow crée une **GitHub Release avec l'APK signé** sur chaque tag `v*` : déplacer le
tag v1.9.0 aurait laissé en ligne une release dont l'APK ne correspond plus au code du tag. Et ce
lot n'est pas purement documentaire — `sheets.js` et `build.js` changent, donc `app.js` change,
donc l'APK change. **Un tag publié ne se déplace pas : on en pose un nouveau.**

### Le guide simple était en retard de trois versions

Ni l'import du classeur (v1.7.4), ni la sélection multiple, la note soignante et les deux
impressions (v1.8.0) n'y figuraient. Six rubriques ajoutées — cinq dans « Traitement et documents »,
une dans « Démarrer ».

### ⚠️ Les pastilles de comptage mentaient

Les sept parties du guide annonçaient leur nombre de rubriques **en dur dans le HTML**.
« 🔐 Données et sécurité » annonçait **6 rubriques pour 29** : vingt-trois sections ajoutées au fil
des mois sans que personne ne touche le nombre. Elles se calculent désormais dans `gdMaj()` sur les
`.cat-head` réellement présents — même principe que le numéro de version du manuel, écrit par
`build.js` depuis qu'il était resté figé à 1.0.68 pendant onze versions.

### ⚠️ Le mode d'emploi livrable avait dérivé de 23 chapitres

`JMSante_Mode_emploi.html` était une copie figée : **15 chapitres contre 38** dans le manuel
embarqué, sans la synchro, le cabinet, le coffre ni le traitement. Deux documents qui disent des
choses différentes sont pires qu'un seul. `build.js` le régénère depuis `www/manuel.html` à chaque
compilation, dans les deux branches (dev et prod).

**La leçon est la même trois fois : tout nombre ou toute copie écrits à la main finissent par
mentir.** Les trois correctifs sont structurels, pas des retouches de contenu.

### Autres documents remis à jour

`README.md` (il décrivait une app à 9 modules et annonçait SQLite « en v2 »), `README_TECHNIQUE.md`
(il s'arrêtait à v1.7.3 — les chapitres v1.7.4, v1.8.0 et v1.9.0 ci-dessous ont été écrits à cette
occasion), `JMSante_Cahier_des_charges.md` (en-tête « état applicatif v1.0.10 », treize versions en
arrière) et `JMSante_Journal_de_creation.md` (quatre épisodes).

### ⚠️ `androidVersionCode` passé à 218

Il était resté à **217** alors que la v1.9.0 était publiée. Le numéro affiché et le versionCode sont
deux nombres distincts, et **le versionCode ne doit jamais reculer ni stagner** d'une version
publiée à l'autre. À vérifier : rien dans le dépôt ne lit ce champ — le workflow fait `npx cap add
android` à neuf et `postcap.js` n'écrit que la signature. Soit il est maintenu à la main pour les
compilations locales, soit il faudrait que `postcap.js` l'injecte dans `app/build.gradle`.

---

## v1.9.0 — la base des médicaments

226 molécules en 14 chapitres, consultables depuis **Réglages → Mes outils → Médicaments** et
depuis la **loupe 🔎 de chaque ligne du plan de traitement**.

**Deux modules, données d'abord** : `medicaments_base.js` (`MED_BASE`, `MED_VOIES`, `MED_VERIF`,
`medTotalBase()`) puis `medicaments.js` (écran, recherche, correction, classeur). L'ordre dans
`ORDER_DEV`/`ORDER_PROD` n'est pas indifférent : l'interface lit les données au rendu, mais
`build.js` garde désormais les deux modules par leur fonction sentinelle.

### La doctrine, et ce qui la tient

⚠️ **AUCUNE INTERACTION MÉDICAMENTEUSE N'EST EMBARQUÉE.** Une liste partielle est plus dangereuse
qu'une liste absente : elle laisse croire qu'on a vérifié. `medInteractions(dci)` ouvre un dialogue
qui dit *pourquoi*, puis renvoie vers la base publique des médicaments.

⚠️ Pas de posologie, pas de contre-indication, pas de code de remboursement. La frontière tenue :
*ce que le soignant fait au moment de l'administration, oui ; ce que le médecin décide, non.*
« À jeun 30 min avant le petit-déjeuner » entre ; « à distance du calcium » est une interaction et
reste dehors.

`_test_medicaments.js` refuse une entrée qui contiendrait le mot « interaction », une posologie
chiffrée, une contre-indication annoncée comme telle ou un montant. C'est ce qui empêche la dérive
dans six mois, quand on ajoutera une molécule en vitesse.

⚠️ Le cadre « pas une aide à la prescription » est rendu **sur chaque fiche** (`.md-cadre`), pas une
fois dans un écran d'accueil qu'on ne relit jamais. Même choix que `bilans.js`.

### La recherche

`medPli(s)` plie accents et casse. ⚠️ **CHAQUE REMPLACEMENT DE `_MED_PLI` FAIT UN SEUL CARACTÈRE**,
donc la chaîne pliée a exactement la même longueur que l'originale : c'est ce qui permet à
`medSurl(txt, q)` de retrouver ses positions dans le texte d'origine pour poser les `<mark>`. Une
table où `œ` donnerait `oe` décalerait tout le surlignage d'un cran après chaque `œ`. Un test
vérifie que toutes les valeurs de la table font 1 caractère.

`medIndex(m)` construit le texte cherché : **DCI + tous les noms commerciaux + famille +
indication**. Sans les noms commerciaux la base ne sert à rien — on lit « TAHOR » sur une
ordonnance, pas « atorvastatine ».

### La loupe depuis le plan de traitement

`medRequeteDepuis(nom)` retire le dosage (`\d+(,\d+)? (mg|g|µg|UI|mL|%)`) et les mots de forme
(`_MED_BRUIT` : cp, LP, gélule, injectable, matin, si, besoin…), puis rend **le premier mot qui
tombe dans la base**. ⚠️ Elle ne devine aucune molécule : elle remplit un champ de recherche, le
soignant lit et décide. Si rien ne tombe, elle rend quand même le premier mot — l'écran proposera
d'ajouter l'entrée manquante.

⚠️ `data-mdlp="${esc(l.id)}"` porte **l'identifiant de ligne, jamais le libellé** : rien qui vienne
d'un dossier ne part dans un attribut HTML.
⚠️ `ev.stopPropagation()` sur le clic : sans lui, la loupe déplierait la note soignante.
⚠️ Le retour capture `const pid = p.id` et rappelle `sheetTraitement(pid)` : garder l'objet patient
en mémoire rouvrirait une fiche périmée.

### Corriger et compléter

`S.medPerso = { modifs:{ <DCI d'origine>: champs }, ajouts:[ … ] }`. `medListe()` applique les
corrections sur la liste en dur puis ajoute les entrées nouvelles.

⚠️ **La DCI d'une entrée d'origine n'est jamais réécrite** : c'est la clé qui relie la correction à
son original, donc ce qui permet d'y revenir. Le champ est `disabled` à l'écran.
⚠️ Une correction qui redonne exactement l'original **efface la correction** plutôt que de la
stocker : sinon l'entrée resterait marquée « corrigé » et le compteur mentirait.
⚠️ À l'import, **une cellule vide n'efface pas ce que l'entrée d'origine disait** (`fus[k] =
champs[k] || base[k] || ""`). Sans cette règle, un classeur rempli à moitié viderait la moitié de la
base sans que personne ne s'en aperçoive.

Le classeur fait **huit colonnes** (DCI, Noms commerciaux, Famille, Voie, Indication, Surveillance,
Bon à savoir, Chapitre), alias d'en-têtes dans `MED_XLS_COLS` sur le modèle de `TRAIT_XLS_COLS`.
`medVoiesDepuis(txt)` ramène « sous-cut », « S/C », « perfusion » aux clés connues plutôt que
d'inventer une voie. ⚠️ Rien n'entre dans un dossier de patient ici : l'import annonce son **bilan
chiffré** avant d'écrire (`askChoice` : compléter / remplacer) au lieu de faire relire 226 lignes,
ce que personne ne ferait.

### Vérification des noms commerciaux (07/10/2026)

31 spécialités douteuses confrontées à la base publique des médicaments et aux fiches Vidal.
**Six anomalies**, toutes corrigées et expliquées dans la fiche concernée :

| Spécialité | Verdict |
|---|---|
| Diclogesic, Ordus, Atmex | n'existent pas en France |
| Nisis (2021), Mecir LP (2024), Xelevia (2025), Motilium (fin 2022) | arrêt de commercialisation |
| Josir | plus de présentation ni d'AMM active |
| Gel-Tim | s'écrit **Geltim LP**, et c'est un **gel ophtalmique**, pas un collyre |
| Klipal Codéine | renommé **Klipal**, composition inchangée |

Aussi repris : dompéridone (indication restreinte, pédiatrie supprimée), fluindione
(⚠️ réservée aux renouvellements par l'ANSM, ne doit plus être instaurée), Lasilix Spécial
(500 mg, insuffisance rénale sévère — à ne pas confondre avec le 40 mg), Stagid (700 mg d'embonate
= **280 mg de metformine base**, ce n'est pas l'équivalent d'un Glucophage 700), kétoprofène
(« dérivé propionique », pas propanoïque).

⚠️ `MED_VERIF` est affiché à l'écran et dans le classeur exporté. **Une base qui dit son âge est
honnête ; une base muette vieillit en silence.**

### Habillage

Aucune couleur nouvelle : accent pour la molécule, `--blue` pour la surveillance (même registre que
la note soignante), `--amber` pour ce qui est de la main du soignant. L'écran suit donc les deux
thèmes sans une règle de plus — un test refuse une couleur en dur dans les règles `.md-*`.

⚠️ `window.open(url, "_system")` et pas `"_blank"` : dans la WebView Android, une fenêtre sans
parent ne rend pas la main. Piège déjà documenté pour l'impression.

### Tests

`_test_medicaments.js` — 56 contrôles statiques (données, doctrine, corrections de vérification,
manques comblés, recherche, branchement, classeur).
Épreuve navigateur réelle — 60 contrôles sur l'écran vivant : recherche par nom commercial, pliure
et surlignage, fiche, filtres, loupe et retour, ajout, correction, retour à l'origine, lecture des
voies écrites à la main.

---

## v1.8.0 — effacer en lot, note soignante, deux versions imprimées

### Effacer plusieurs lignes d'un coup

Mode sélection (`#tr-sel`) avec cases à cocher, « Tout cocher / Tout décocher » (`#tr-all`) et
suppression groupée. Raccourci **📋 Nouvelle ordonnance** (`#tr-neuve`) : entre dans le mode
sélection avec **tout déjà coché**, et réutilise `supprimerLot()` — une seule mécanique de
suppression, pas deux.

⚠️ **`selMode`, `pris`, `soigOn` et `deplie` vivent DANS la fermeture de `sheetTraitement`**, pas au
niveau du module. Une sélection qui survivrait d'un dossier à l'autre ferait supprimer les lignes du
mauvais patient.

`supprimerLot()` garde une copie (`const avant = L.map(l => ({ ...l }))`) et propose **Annuler
pendant 8 secondes**. Une ordonnance effacée par erreur, c'est une saisie complète à refaire.

⚠️ **DÉFAUT ANCIEN TROUVÉ ICI, ET PAS DANS CE LOT** : `#toast` portait `pointer-events:none` et rien
ne le relevait jamais — **aucun bouton « Annuler » de l'application n'avait jamais été cliquable**,
y compris celui d'un passage validé. Trouvé parce que l'épreuve navigateur n'arrivait pas à cliquer
le bouton. Correctif : `pointer-events:auto` sur `#toast.with-act` **seulement** — un message simple
doit rester traversant.

### La note soignante

Second champ `l.soig` sur chaque ligne, pastille `.tr-i`, pli `.tr-soig` ouvert en touchant le
**nom** (`data-tsoig`), interrupteur global `#tr-soigall`.

⚠️ `ev.stopPropagation()` sur `data-tsoig` : sans lui, ouvrir une note cocherait la ligne en mode
sélection.

### Deux versions à l'impression

```js
function traitHtml(p, opts){
  const soignant = !!(opts && opts.soignant);   // ⚠️ le défaut est la version SÛRE
```

⚠️ **Le défaut d'un paramètre absent doit être la version patient.** `sortirTrait()` ne pose la
question que si au moins une note existe, et propose **👤 Version patient** en premier (`non:`), la
version soignant en second (`oui:`).

⚠️ `traitTexte(p)`, lu par le **DLU et la relève**, ne lit que nom + posologie : aucune fuite par ce
chemin. Un test le vérifie explicitement.

`_test_traitement_lot.js` (26 contrôles) + épreuve navigateur.

---

## v1.7.4 — dates, claviers, et le plan de traitement depuis un classeur

### Date de naissance en JJ/MM/AAAA

`globals.js` est le **seul** passage entre ISO et JJ/MM/AAAA : `jmaDepuisISO(iso)`,
`isoDepuisJMA(txt)` (accepte `01/01/1945`, `1-1-45`, `01011945`, ISO ; rend `""` si impossible),
`isoDe(a,m,j)` et `dateValide(a,m,j)`.

⚠️ `dateValide` refuse le 31 février via `new Date(a, m, 0).getDate()` : une date impossible est
rejetée avec un message et restauration du champ, jamais enregistrée en silence.

### Claviers

`TEL_ATTRS = 'type="tel" inputmode="tel" autocomplete="tel"'`, passé par le nouveau paramètre
`attrs` de `champ(id, lbl, val, ph, large, attrs)` dans `recueil.js`.

### Import Excel du plan de traitement

`TRAIT_XLS_COLS` (alias d'en-têtes, repérage par titre où que soit la colonne), `traitFreqLire()`
(comprend « 1-0-1-0 », « si besoin »), `traitFormeDepuis()`, `traitModeleXlsx()`,
`traitImportXlsx()`, `traitRelire()` (écran de relecture avant écriture).

⚠️ **Aucun exemple dans l'onglet de saisie du modèle** : une ligne de démonstration oubliée serait
importée avec les vraies et ferait entrer un médicament que le patient ne prend pas. Les exemples
sont dans « Lisez-moi ».

⚠️ On n'accole pas un dosage déjà présent dans le nom : « DOLIPRANE 1000 mg » + colonne « 1000 mg »
donnerait un libellé absurde.

⚠️ **Décision de cadrage** : pas d'IA ni de scan d'ordonnance *dans* l'application. L'import d'un
classeur rempli par le soignant est l'alternative retenue — c'est lui qui transcrit, l'app ne déduit
rien d'une ordonnance.

`_test_recueil_import.js` (49 contrôles).

---

## v1.7.3 — « à jeun » visible, caisse et mutuelle

### L'information « à jeun » était enfouie

Elle existait, mais **dans la rubrique « au prélèvement » de 5 fiches sur 45** : invisible depuis la
liste, donc inutilisable pour préparer une tournée du matin.

⚠️ **TROIS ÉTATS, PAS DEUX** (`j:1` à jeun · `j:2` selon le laboratoire · `j:0` pas nécessaire) :
« rien » était ambigu — pas nécessaire, ou information absente ? **Les 45 analyses sont tranchées**,
avec leur raison en commentaire.

`jeunPuce()` affiche le marqueur dans la liste ; `jeunResume(noms)` donne le rappel groupé au moment
de composer un bilan — ⚠️ ce qui compte alors n'est pas chaque ligne mais « faut-il qu'il soit à
jeun ? ».

**Arbitrages notables** : glycémie à jeun (le jeûne est la *définition* de l'examen), triglycérides
et LDL (très influencés par le repas de la veille, et le LDL est le plus souvent *calculé* à partir
des triglycérides) ; HbA1c et NFS sans contrainte ; transaminases et ferritine « selon le
laboratoire », où les consignes varient réellement.

### Caisse et mutuelle

Quatre champs (`caisse`, `mutuelle`, `mutuelleNum`, `mutuelleAmc`) ⚠️ **à côté du numéro de sécurité
sociale** : c'est là qu'on les cherche, et c'est au même moment qu'on les recopie de la carte ou de
l'attestation.

⚠️ **Ils ne sortent sur AUCUN document produit** — une ordonnance n'a pas l'usage d'un numéro de
mutuelle. Dit à l'écran sous les champs. Ils voyagent dans la synchro comme le reste de l'identité.

## v1.7.2 — le narratif se tait sur la routine, et les cadres ne se télescopent plus

### ⚠️ Deux bords en relief se superposaient

**Signalé sur photo.** `.rowbox`, `.slotsec-h` et `.grp-head` sont des **CONTENEURS** et recevaient
le même relief que les **BOUTONS** qu'ils contiennent : le bord du bouton venait se poser sur celui
du cadre.

**La hiérarchie est maintenant explicite** : un conteneur se **creuse**, un bouton se **soulève**.
⚠️ Le trait de gauche de `.rowbox` n'est pas un cadre → plus aucun volume. ⚠️ Un peu de padding
ajouté : un bouton collé au bord superpose forcément les deux traits.

**Balayage automatique sur 12 écrans × 2 finis** : plus aucun enfant en relief dont le bord est à
moins de 3 px de celui d'un parent en relief.

### Le narratif ne répète plus la routine

⚠️ **CE QUI NE VARIE PAS NE S'ÉCRIT PAS.** Reprendre tout le plan de soins à chaque passage allonge
la relève sans rien apprendre. Seuls sont détaillés les soins **hors plan** et ceux qui portent un
**commentaire** ; le plan tenu se résume à « Soins du plan réalisés. »

⚠️ **Mais un soin du plan NON fait se dit** (« Non réalisé : Insuline ») — c'est une information,
pas un silence.

⚠️ **Même principe pour les constantes** : une valeur identique à la veille est tue. ⚠️ **Sauf en
cas d'alerte**, où tout est cité : là, le contexte compte.

Réglable par l'interrupteur **« Taire ce qui ne bouge pas »**, actif par défaut.

## v1.7.1 — la relève en fiches (HTML et PDF)

Le **texte brut reste inchangé** : c'est le seul format qui se colle dans un message, se lit sans
pièce jointe et ne se déforme nulle part.

**Pour les sorties HTML et PDF**, chaque patient devient une **fiche encadrée** : nom à gauche et
âge à droite dans l'en-tête, **constantes en pastilles**, le reste en texte.

⚠️ **PAS DE CADRE ROUGE en cas d'alerte** (choix de l'utilisateur) : le cadre **sépare**, il ne
signale pas. La couleur reste sur les **valeurs** hors seuils, là où elle informe.

⚠️ **C'est le cadre qui permettra la relève mixte** : un patient en narratif à côté d'un
télégraphique ne gênera pas la lecture, la fiche fait la séparation.

⚠️ **Le découpage suit le format RÉEL des lignes** — `📊 5 oct. — TA 13/8 · T° 36,7` avec un `⚠` en
fin de ligne quand une valeur sort des seuils. Première version écrite sur une forme devinée :
aucune pastille ne se formait. Vérifié sur le HTML réellement produit, pas sur le code.

⚠️ **Word reste en texte** : `docxWithAnnexes` fabrique des paragraphes, pas de mise en page.

**Piège de test rencontré** : l'envoi exige `S.confidentialityAck` (rappel déontologique au premier
partage) et les constantes n'entrent dans la relève que si `v.constRel` est vrai.

## v1.7.0 — vocal par patient, et relève narrative (essai)

### Le vocal d'un patient

La carte n'avait que la **dictée** ; le vrai enregistrement n'existait que sur la relève globale.
⚠️ **Le micro flottant de la carte est retiré** : celui du clavier dicte mieux, et il occupait la
place du bouton d'enregistrement. Le champ invite désormais à « dicter avec le micro de ton
clavier ».

**150 s par patient** (`VOICE_MAX_PAT`), contre 180 pour la relève : un vocal de patient précise un
point, il ne raconte pas le passage. `voiceStart(onTick, onStop, maxS)` accepte le plafond.

⚠️ **IL VOYAGE AVEC LA RELÈVE, PAS AVEC LES DONNÉES** : joint à l'envoi, **absent de la synchro**.
⚠️ **Effacé après envoi** (`pVoixPurgeApresEnvoi`), comme le mot pour la prochaine relève.
⚠️ **La mention part dans le TEXTE** (« 🎤 note vocale de 0:42 »), même si les rappels sont masqués :
un destinataire qui ne peut pas écouter doit savoir qu'un son existe.

### La relève narrative — `narratif.js`, essai `narratif`

⚠️ **L'APP ASSEMBLE, ELLE NE CONCLUT PAS.** Elle écrit « TA 13/8 (précédemment 14/8) », jamais
« en amélioration ». **Un test vérifie l'absence** de « amélior / dégrad / aggrav / état stable »
dans le code hors écran.

⚠️ **Des fragments, pas de la prose** : 10 gabarits de soins (`NARR_SOINS`) enchaînés. Fabriquer
des phrases « naturelles » produirait des tournures qui sonnent juste et disent faux.

⚠️ **Les comptages sont des faits** : « réfection du pansement 3 fois, en 8 jours » se vérifie ;
« suivi irrégulier » serait un jugement.

⚠️ **Les notes libres ne sont JAMAIS reformulées** : rassemblées telles quelles et datées. L'app ne
sait pas lire « un peu confuse ».

⚠️ **L'alerte ouvre le bloc** — elle ne doit pas se lire comme le reste. ⚠️ **Décimales
françaises** (`36,7` et non `36.7`) : un chiffre à l'anglaise se relit de travers.

**La télégraphique reste disponible et inchangée.**

### ⚠️ Le piège de l'`async` orphelin, fermé

Troisième occurrence en deux jours : un commentaire glissé entre `async` et `function` casse le
chargement, et `node --check` sur un module ne le voit pas — **chaque module est volontairement
incomplet, il se referme sur le suivant**. `build.js` refuse désormais de produire l'app dans ce
cas ; garde-fou éprouvé en l'introduisant exprès.

## v1.6.9 — le second filet, et son sens au choix

Le bloc patient est désormais pris **entre deux traits** : celui qui ferme l'en-tête et celui qui
ouvre la prescription. Il devient une zone nette.

`pdfFilet(doc, y, sens)` : `1` = plein à gauche comme l'en-tête, `-1` = en miroir. Le premier
filet est toujours à `1` ; le second suit `S.ordoFilet` (`miroir` par défaut).

⚠️ **L'interrupteur est dans l'écran de l'en-tête, mais ce réglage-ci est DURABLE** — contrairement
au reste de cet écran qui ne vaut que pour le document en cours. Dit à l'écran, pour qu'on ne
s'attende pas à l'inverse.

L'aperçu reprend le même sens (`.ap-filet.mir`).

## v1.6.8 — le cabinet était écrit deux fois sous la mention

**Signalé sur PDF produit** : « Remplaçant du Cabinet X » puis, ligne suivante, « Cabinet X ».

`pdfEnTete()` saute désormais la ligne du cabinet quand la mention le nomme déjà — comparaison
insensible aux accents, à la casse et aux espaces multiples. ⚠️ **Seulement dans ce cas** : la
forme « remplaçant d'un praticien » garde la ligne du cabinet, puisque la mention nomme une
personne et non la structure. L'aperçu applique la même règle.

## v1.6.7 — mention de remplacement et numérotation des prescriptions

### Trois formes de signature, au même endroit

« Qui signe » proposait déjà le remplacement d'un **praticien nommé** (nom, métier, RPPS depuis
l'annuaire). S'y ajoute le remplacement d'un **cabinet**, sans nommer personne. Les trois sont
désormais dans l'écran de l'en-tête de l'ordonnance : Moi · Je remplace ce cabinet · Je remplace
un praticien.

⚠️ **Le titulaire se choisit dans l'annuaire**, jamais à la main : son RPPS ne doit pas être saisi
de mémoire. ⚠️ **L'app ne dit pas quelle forme est réglementaire** pour une situation donnée —
même ligne que « Qui signe » depuis la v1.1.0.

⚠️ **Bug trouvé au test** : la mention s'imprimait **deux fois**, `pdfEnTete()` l'écrivant déjà
sous le titre et `ordoDispoProduire` la répétant. Visible seulement sur le PDF produit.

### Numérotation en marge droite

⚠️ **Collé au texte, « 1 Mepilex » se lisait comme une QUANTITÉ.** Le numéro part donc en **marge
droite**, dans sa propre colonne (12 mm) séparée par un **filet vertical** sur la hauteur de la
ligne ; le texte garde la largeur utile.

⚠️ **Le total ferme la liste juste avant la signature** (« Ordonnance comportant 3 prescriptions »),
sur un trait plein : **une ligne ajoutée après coup ne correspondrait plus au compte**. Affiché
même pour une seule prescription, pour que son absence ne crée jamais de doute.

L'aperçu reprend la même mise en page (`.ap-li-n`, `.ap-tot`).

## ⚠️ v1.6.6 — « Partage indisponible » : la fonction n'existait pas

**Signalé sur capture** : « Partager » affichait toujours « Partage indisponible — enregistré
dans Fichiers ».

⚠️ **CAUSE : `partagerFichier()` était APPELÉE SANS AVOIR JAMAIS ÉTÉ ÉCRITE.** Le garde
`typeof partagerFichier === "function"` échouait **en silence** et tombait systématiquement sur le
message de repli. **Une fonction protégée par un `typeof` qui n'existe nulle part ne lève aucune
erreur** — rien ne le signalait.

`fichierPartager(nom, b64, mime)` reprend la voie des autres exports de l'app : écriture en
**CACHE** puis `Share.share({ url })` sur appareil, `navigator.share({ files })` en navigateur.
`pdfPartager()` en est le raccourci PDF ; l'export du classeur de dispositifs y passe aussi.

⚠️ **Une annulation du menu n'est PAS une erreur** : `cancel` (Capacitor) et `AbortError`
(navigateur) sont avalés — le document est déjà enregistré.

⚠️ **Le message de repli dit maintenant POURQUOI et OÙ** : « Partage impossible sur cet appareil —
enregistré dans … ». Un « indisponible » sans suite laisse l'utilisateur démuni.

**Testé sur trois situations** : plugins présents, utilisateur qui ferme le menu, appareil sans
partage. Un test vérifie en plus qu'aucun appel à la fonction fantôme ne subsiste.

## v1.6.5 — classement du catalogue, et en-tête modifiable

### Une référence ajoutée atterrissait en fin de famille

« Mepilex Border Flex » se retrouvait après d'autres marques, loin de « Mepilex Border ».
`trierRefs()` classe chaque famille de matériel par `localeCompare` avec `numeric:true` (pour que
« 10×10 » précède « 15×15 »), ce qui **regroupe naturellement les déclinaisons d'une gamme**.

⚠️ **SEULEMENT LES FAMILLES DE MATÉRIEL.** Les domaines issus de l'arrêté (vaccins, examens,
médicaments) gardent l'ordre du texte : il y a une logique de lecture qu'un tri alphabétique
casserait.

### L'en-tête de l'ordonnance composée était figé

La feuille vierge permettait de le corriger, pas l'ordonnance venue du catalogue —
`sheetOrdoEntete(pid)` ouvre les mêmes champs (nom, titre, RPPS, AM, cabinet, adresse, tél, mail).

⚠️ **LA MODIFICATION NE VAUT QUE POUR CE DOCUMENT** (`_ordoEnteteMod`) : elle n'écrit ni dans Ma
fiche ni dans le cabinet, sinon une correction ponctuelle deviendrait définitive sans qu'on l'ait
voulu. Le bouton affiche « — modifié », et « ↺ Revenir à ma fiche » annule.

`ordoEntete(p)` est le point unique : l'écran, l'aperçu et le PDF le lisent.

## v1.6.3 — les tailles saisies à la main ne se découpaient pas

**Signalé à l'usage** : une référence ajoutée par l'utilisateur (« Mepilex Border Flex ») avec
plusieurs tailles ne proposait aucun choix à la prescription.

⚠️ **CAUSE** : le découpage ne connaissait que le « · » du socle (`ref.d.split("·")`). Une saisie
en « / », « ; » ou séparée par des espaces donnait **un seul bloc**.

`tailleListe(txt)` lit désormais en deux passes : séparateurs francs (`· ; | /`, retour-ligne, et
le **tiret entouré d'espaces** — ⚠️ entouré seulement : « Mepilex Border-Flex » ne doit pas se
couper),
puis — s'il ne reste qu'un bloc — reconnaissance des motifs « nombre × nombre » et des calibres
(`CH 14`, `5 cm`). ⚠️ Le tiret large était nécessaire pour les tailles **non numériques**
(« petit - moyen - grand », « classe 2 - classe 3 ») que la reconnaissance de motifs ne voit pas.
**11 cas de test** couvrent les écritures courantes. ⚠️ **LA VIRGULE N'EST PAS UN SÉPARATEUR** : en français c'est une décimale
(« 12,5×12,5 »), la découper casserait la taille en deux.

⚠️ **Ce que l'app a compris est MONTRÉ à la saisie** (« 3 tailles reconnues » + la liste) : une
taille mal découpée ne se verrait qu'au moment de prescrire, trop tard. Si une seule est reconnue
alors que le champ n'est pas vide, l'app propose de corriger.

⚠️ **Second bug trouvé en passant** : le choix lisait `ref.d`, devenu la clé du domaine depuis
l'élargissement du catalogue (v1.5.1) — les dimensions sont dans `ref.dim`. Corrigé en
`ref.dim || ref.d`.

## ⚠️ v1.6.2 — deux documents n'offraient que « Enregistrer »

**Signalé sur capture** : l'ordonnance vierge produisait le PDF sans aperçu ni partage.

**L'audit a trouvé deux manques** : `ordonnancePdf` et `courrierPdf` ne recevaient pas `mode` et
n'appelaient pas `sheetApercu`. Les trois autres documents étaient corrects — une fausse alerte en
plus sur `aideProduire`, où mon détecteur buttait sur une parenthèse dans l'appel.

Les deux passent désormais par l'**aperçu générique**, avec Modifier / Enregistrer / Partager.
⚠️ Le courrier est en `sansPatient:true` — un encadré patient vide laisserait croire qu'il manque
une information.

⚠️ **PIÈGE RENCONTRÉ POUR LA DEUXIÈME FOIS EN DEUX JOURS** : en insérant un commentaire devant
`function X`, l'`async` est resté **avant** le commentaire → « async is not defined » au chargement,
et `node --check` ne le voyait pas (il vérifie chaque module, pas le fichier assemblé). **Toujours
recharger l'app après une édition d'en-tête de fonction.**

⚠️ **Second piège** : un remplacement automatique de l'appel `pdfLivrer(...)` a doublé `, mode` dans
un cas et l'a omis dans l'autre — les parenthèses imbriquées de `new Date().toISOString()` cassent
une expression régulière naïve. Vérifié ensuite sur le comportement réel, pas sur le code.

**Un test balaie maintenant tous les modules** : il liste tout producteur de PDF qui ne reçoit pas
ou ne transmet pas le mode.

## v1.6.1 — les boutons que le relief avait oubliés

**Signalé sur captures** : filtres Tournée/Moment/Affichage, outils dans la carte, compteurs,
en-têtes Matin/Soir et grand bouton du bas restaient plats.

⚠️ **CAUSE : la liste des classes à styler était écrite à la main.** `.fchip`, `.tool`, `.spill`,
`.slotsec-h`, `.selb`, `.mic` n'y figuraient pas — et **rien ne le signalait**. C'est la faiblesse
d'une liste manuelle : tout élément absent reste plat en silence.

⚠️ **LE FILTRE ACTIF EST ENFONCÉ, pas surélevé** : un bouton sur lequel on a appuyé reste pressé ;
le faire ressortir se lirait comme « pas encore choisi ». En gravé, l'inverse — l'actif est le seul
en relief au milieu des creux.

⚠️ **OMBRE COURTE sur ces éléments** (`0 2px 4px` au lieu de `0 22px 38px`) : petits, nombreux et
serrés, ils flotteraient avec l'ombre d'une carte.

**Restent plats volontairement** : le logo, l'indicateur de sauvegarde et le corps cliquable d'une
carte — tous transparents par nature.

**Mesuré** : 61 i/s au défilement, inchangé malgré le nombre d'éléments ombrés.

## v1.6.0 — le relief, partout

L'effet s'arrêtait aux cartes patient : barre d'outils, tuiles, boutons et onglets restaient plats,
et l'œil le voyait. Il couvre maintenant `.tbtn`, `.mtile`, `.e-doc`, `.pr-v`, `.factions .btn`,
`.btn`, `.pz-opt` et `.ftab` — en relief, en gravé et en haute définition.

⚠️ **LES OMBRES SONT CALIBRÉES PAR TAILLE** : les petits éléments s'arrêtent à `0 7px 13px`, les
cartes gardent `0 22px 38px`. Une tuile de 60 px avec l'ombre d'une carte de 300 flotte sans raison.

⚠️ **CE QUE ÇA APPORTE AU-DELÀ DU DÉCOR** : l'**onglet actif ressort** et les inactifs
**s'enfoncent** — on lit l'état sans chercher la couleur. Le bouton principal devient une touche
bombée qui s'enfonce au doigt (`:active`). C'est le seul endroit où le relief porte une
information, et toujours **en plus** de la couleur.

**Mesuré** : défilement sur 32 cartes → 40 images en 655 ms, soit ~61 i/s. Pas de régression.
En cas de saccade sur un appareil plus lent, **retirer l'ombre la plus large, jamais le biseau**.

⚠️ `prefers-reduced-motion` rend tout plat, onglets compris.

## ⚠️ v1.5.9 — le panneau des réglages laissait voir l'écran du dessous (thème HD)

**PIÈGE RENCONTRÉ POUR LA TROISIÈME FOIS** (déjà vu sur Moniteur 1994) : `--surface` sert AUSSI de
fond aux panneaux (`.sheet`, `.dlg-card`). Le thème HD la définissait en
`rgba(255,255,255,.055)` → le panneau devenait translucide et les deux écrans se superposaient.

Surfaces du thème HD rendues **opaques** (`#101A1F`, `#0B141A`, `#16232A`), la translucidité venant
du dégradé du fini par-dessus. **Et une règle générale ferme le sujet** : `.sheet, #sheet,
.dlg-card { background-color: var(--bg) }` quel que soit le thème ou le fini. Vérifié sur les
quatre thèmes.

## v1.5.8 — trois thèmes de plus, et un réglage de fini

**Trois thèmes** : `hd` (✨ Haute définition), `relief` (🧊) et `grave` (🪨), visibles dans la liste.

⚠️ **Le FINI est séparé des COULEURS** : `data-fini` sur `<html>` s'applique par-dessus n'importe
quel thème. Sans cette séparation, il aurait fallu **dupliquer chaque thème** en version plate,
relief et gravée. `S.fini` vaut `auto | plat | hd | relief | grave` ; « auto » suit le `fini` du
thème (chacun porte le sien), les autres valeurs l'emportent.

⚠️ **Ce qui crée le volume n'est pas l'ombre mais le BISEAU** : ligne claire en haut, ligne noire
en bas. L'œil lit une lumière venue d'en haut, donc un objet qui dépasse. Les quatre ombres ne font
qu'appuyer — en cas de saccade sur une longue liste, **retirer la plus large, jamais le biseau**.

⚠️ **« Gravé » est le même effet, sens inversé** : creusé dans la surface au lieu d'être posé
dessus. Moins spectaculaire, plus reposant sur quinze cartes.

⚠️ **Thème clair** : une ombre noire profonde y ferait une tache → `--om:.22` sur Papier blanc, et
le biseau porte seul le volume.

⚠️ **`prefers-reduced-motion` rend tout plat** : le relief est un confort, jamais une information.

⚠️ **Les couleurs de vigilance ne sont jamais touchées** — un test parcourt les règles de fini une
par une pour le vérifier. En relief, la carte en alerte **monte d'un cran**, mais en plus de la
couleur, jamais à sa place.

⚠️ **Piège rencontré** : un commentaire HTML inséré après la fermeture d'un gabarit JS → l'apostrophe
de « s'applique » a cassé le fichier. Vérifier où se ferme le backtick avant d'insérer.

## v1.5.7 — trois zones sur le papier, un seul parcours à l'écran

### Séparer le prescripteur du patient

⚠️ **Les deux identités se suivaient sans rupture** : l'œil ne savait pas où finissait l'une.
`pdfBlocPatient(doc, p, y, opts)` trace un **filet** qui ferme l'en-tête (plein sur 55 %, fin
ensuite) puis pose le patient dans un **encadré gris titré « PATIENT »**.

⚠️ **Une seule fonction pour tous les documents** : chaque écran réécrivait son bloc, et ils
divergeaient — le sexe manquait ici, le numéro s'appelait « N° » là. Sans patient, le bloc sort en
**pointillés à remplir** : c'est l'intérêt d'une feuille vierge emportée dans la sacoche.

### L'aperçu devient générique

⚠️ **Un écran d'aperçu par type aurait signifié les voir diverger au premier changement.**
`sheetApercu(doc)` reçoit une **description** — titre, en-tête, patient, corps, pied, et les
fonctions retour/modifier/produire — et sait afficher n'importe quel document.

**Cinq documents y gagnent l'aperçu, l'enregistrement et le partage** : ordonnance de dispositifs,
questionnaire pré-vaccinal, attestation, conduite à tenir — seule l'ordonnance de dispositifs
l'avait. `docProduire(cle, pid, mode)` et `aideProduire(mode)` acceptent le mode.

⚠️ `sansPatient:true` pour une **fiche interne** : un encadré patient vide laisserait croire qu'il
manque une information.

### Mes modèles : trois familles

**À remplir à la main** (ordonnance vierge, feuille à en-tête, liaison domicile) · **Courriers** ·
**Vaccination**. Des documents jusqu'ici dispersés — le courrier vivait dans Mon cabinet — se
retrouvent ici.

⚠️ **La feuille de liaison n'est qu'un RACCOURCI** (`sheetFeuilles()`) : ses réglages propres — ce
qu'elle affiche, sur combien de jours — n'ont pas leur place dans une liste de modèles.

## v1.5.6 — numéro du prescripteur, et titre neutre

⚠️ **Le numéro RPPS / ADELI ne sortait nulle part** sur l'ordonnance de dispositifs : elle n'a pas
de bloc d'en-tête propre comme l'ordonnance pré-imprimée, et `pdfEnTete()` n'écrivait que le nom
et le titre. Il figure désormais sous les coordonnées, avec le n° AM — **pour tout document composé
par `pdfEnTete`** (ordonnance, courrier, modèles).

⚠️ **Titre neutre : « Ordonnance »**, plus « Ordonnance de dispositifs médicaux ». Le catalogue
couvre vaccins, examens biologiques et médicaments : l'ancien titre rendait la feuille inexacte dès
qu'on prescrivait un examen. Aperçu et nom de fichier alignés.

⚠️ **Effet de bord corrigé dans la foulée** : l'en-tête ayant gagné une ligne, le bloc patient
venait se superposer. Marge minimale passée de 56 à 62 mm.

## v1.5.5 — taille et poids : champs libres

⚠️ **Plus de reprise automatique depuis les constantes.** Une mesure ancienne imprimée d'autorité
serait trompeuse, et le poids du jour n'est pas toujours dans l'app. Deux **champs libres**
(`dispoData().taille` / `.poids`), remplis à la volée quand c'est utile au matériel.

⚠️ **Laissés vides, ils sortent en pointillés** — à remplir à la main après impression, avec la
mesure du jour. C'est le cas d'usage de la contention : on mesure au lever, chez le patient.

`mesuresPatient()` ne sert plus qu'à **suggérer** la dernière valeur connue dans l'invite du champ
(`_mesureHint`), avec sa date : « Taille — 158 cm le 28/09/2026 ». Elle n'écrit jamais rien.

## v1.5.4 — les mentions de l'ordonnance de dispositifs

Complété d'après la grille fournie par l'utilisateur (règles générales de prescription) :

**Modalités d'utilisation par ligne** (`x.m`) — sans elles, la pharmacie délivre mais le patient
ne sait pas comment s'en servir. Imprimées sous la ligne qu'elles concernent.

**Durée de traitement et renouvellement**, sortis **en évidence** sous la liste et non noyés dans
les remarques libres : ce sont des mentions qui engagent la délivrance. ⚠️ Défaut
« Non renouvelable ».

⚠️ **Taille et poids** : ils ne sont pas des champs du dossier, ils vivent dans les **constantes
d'un passage**. `mesuresPatient(p)` prend la dernière valeur connue **et sa date** — une mesure de
l'an dernier sur une ordonnance de contention serait trompeuse. Proposés **seulement s'ils
existent**, et **jamais cochés d'office**.

**Déjà présents** : prescripteur (nom, qualité, RPPS, adresse, date et cadre de signature),
patient (nom, sexe, date de naissance et âge, n° de sécurité sociale), désignation précise et
quantité.

⚠️ **L'application met en page, elle ne valide aucune conformité.** Ces champs existent pour être
remplis, pas pour attester que l'ordonnance est régulière.

⚠️ **Piège rencontré** : un script Python dont une assertion échoue **n'écrit pas le fichier** —
le premier remplacement d'une série est perdu silencieusement si un suivant échoue. Vérifier le
résultat à l'écran, pas seulement le message de succès.

## v1.5.3 — l'identité du patient sur les documents

Trois manques signalés à l'usage sur l'ordonnance de dispositifs :

⚠️ **Le sexe ne figurait pas.** Une ordonnance doit identifier le patient sans ambiguïté :
« Femme » ou « Homme » suit désormais le nom, d'après `p.genre`.

⚠️ **L'âge n'accompagnait pas la date de naissance** : « Né(e) le 30/05/1940 **(86 ans)** ». Il
évite un calcul de tête au comptoir. Ajouté aussi sur l'**ordonnance pré-imprimée**, qui ne
l'avait pas non plus.

⚠️ **« N° » seul ne dit pas de quel numéro il s'agit** → « N° de sécurité sociale : ».

Corrigé dans **l'ordonnance de dispositifs, son aperçu, les modèles et l'ordonnance
pré-imprimée** — les quatre documents disent maintenant la même chose. Un test vérifie les trois
points et l'absence de `fmtFR` sur une date de naissance.

## v1.5.2 — la documentation rattrape les six dernières versions

**Guide dans l'app** : 85 → **88 rubriques**. « L'ordonnance pré-imprimée » devient « ✍️ Faire une
ordonnance » (une seule porte, deux voies) ; ajout de **Mon catalogue de prescription**, **Les
fonctions en essai** et **S'y retrouver dans les réglages**. ⚠️ Les chemins périmés sont corrigés :
l'écran Réglages a quatre sections depuis la v1.4.1, le guide citait encore les anciennes tuiles.

**Manuel** : 37 → **38 chapitres**. Le chapitre des dispositifs devient « Faire une ordonnance »
(catalogue à 7 domaines, choix de la taille, aperçu, enregistrer/partager, en-tête du cabinet du
patient) ; les bilans reçoivent les fiches de rappel, les deux unités et « au prélèvement » ;
nouveau chapitre sur l'organisation des réglages.

**Livrables** : `JMSante_Mode_emploi` **66 pages** (.docx + .html, 44 captures) ·
`JMSante_Guide_referent` **13 pages** (.docx + .html) — enrichi de quatre questions nouvelles
(« je ne trouve plus l'ordonnance pré-imprimée », « l'ordonnance sort au mauvais cabinet »,
« toutes les tailles sont listées », « le catalogue ne contient-il que du matériel ») et d'une
section sur **où s'arrête l'application** pour les fiches de bilan.

⚠️ **Vérifié : le code des essais ne figure ni dans le guide de l'app, ni dans aucun livrable.**
Un test l'impose désormais sur le guide. ⚠️ Les générateurs portent la version en dur : alignés
sur 1.5.1, à revérifier à chaque régénération.

## v1.5.1 — une seule porte vers les ordonnances, et le catalogue élargi

**Le problème** : « Ordonnance pré-imprimée » et « Mes dispositifs » se suivaient dans Actions sans
rien pour les distinguer. ⚠️ **« Pré-imprimée » décrit comment la feuille est fabriquée, pas ce
qu'on en fait.** La vraie différence tient en deux mots : **imprimé** ou **manuscrit**.

`sheetPrescrire(pid)` remplace les deux entrées par une — « ✍️ Faire une ordonnance » — et pose
le choix avec une phrase chacun. ⚠️ **Sans patient, seule la feuille vierge est proposée** : le
catalogue n'aurait aucun sens. Entrée depuis **Ma fiche** pour en imprimer d'avance.

### Le catalogue passe de 1 à 7 domaines

⚠️ **Vérifié sur deux sources** : l'arrêté du 26 juin 2026 (NOR SFHH2617311A, JO du 27 juin), lu
intégralement, et l'analyse juridique de l'**AP-HP** ; la déclaration vaccinale confirmée par
l'**ordre national des infirmiers**. Le catalogue ne contenait que du matériel alors que le texte
ouvre six domaines : vaccins · plaies · santé sexuelle · sevrage tabagique · médicaments et
solutions · examens biologiques — plus les dispositifs hors plaie.

⚠️ **LES CONDITIONS SONT RAPPELÉES, JAMAIS VÉRIFIÉES** : l'app ne sait pas si le patient est
diabétique, ni ce qu'un confrère a prescrit. Aucun blocage, aucune validation. Dit à l'écran.

⚠️ **Les lignes issues du texte portent `fixe:true` et ne se modifient pas** — une ligne
réglementaire réécrite finit par ne plus correspondre au texte sans qu'on sache quand elle a
dérivé. Elles se **retirent** (`retires`), et l'ajout libre reste possible à côté.

### Les fiches de bilan sont complètes

**45 analyses sur 45** ont leurs cinq rubriques (mesure · valeur basse · valeur élevée ·
prélèvement · voix patient). Les 6 tubes n'en ont pas : ils ont leur propre écran. Un test vérifie
qu'aucune analyse n'est oubliée et qu'aucune rubrique ne manque.

## v1.5.0 — Bilans : deux unités et fiches de rappel

**Deux unités.** 18 analyses portent une seconde dénomination (`u2`), affichée sous la première,
introduite par « soit » : G/L et /mm³, mmol/L et g/L, µmol/L et mg/L. Pas de colonne
supplémentaire — un téléphone n'en a pas la largeur.

**`bilans_fiches.js`** — 37 fiches de rappel, deux voix : **🩺 Pour moi** (ce que ça mesure · ce
qu'une valeur basse ou élevée peut traduire · au prélèvement) et **💬 Pour le patient** (une
formulation simple à dire de vive voix).

⚠️ **CE N'EST PAS UNE AIDE AU DIAGNOSTIC**, et le cadre posé par l'utilisateur est repris tel quel
**dans chaque fiche**, pas une fois dans un écran d'accueil qu'on ne relit jamais : les valeurs
sont prises **une par une**, sans croisement entre elles ni avec l'état clinique ; un résultat ne
se lit jamais seul ; **l'infirmier ne pose pas de diagnostic médical**.

⚠️ **Aucune conduite à tenir.** On écrit ce qu'une valeur *peut traduire*, jamais ce qu'il faut
faire. Un test vérifie l'absence de « il faut donner / administrer / prescrire ».

⚠️ **Aucun lien avec les bilans d'un patient** : l'app ne lit aucun résultat, ne compare rien,
n'alerte sur rien. `bilans_fiches.js` ne référence ni `p.bilans` ni `getP()`.

⚠️ **La voix patient ne s'imprime pas et ne se remet pas** — remettre une feuille qui explique des
analyses reviendrait à se substituer au médecin qui les a prescrites. Dit à l'écran, sous la
formulation.

⚠️ La rubrique **« au prélèvement »** est celle qui sert le plus : c'est là que le geste infirmier
change le résultat (garrot et kaliémie, tube citraté et INR, tube EDTA et plaquettes, jeûne et
triglycérides).

## v1.4.4 — quatre retours sur l'ordonnance de dispositifs

**1. L'en-tête débordait sous le titre.** Téléphone et courriel étaient sur la même ligne ; une
adresse un peu longue suffisait à atteindre « Ordonnance de dispositifs ». Chacun sur sa ligne, et
la colonne de gauche est **bornée à 100 mm** — plus aucune adresse ne peut l'atteindre.

**2. Aperçu avant production.** ⚠️ **Dessiné dans l'app, pas en ouvrant le PDF** : sur Android un
PDF part dans une visionneuse extérieure, et revenir corriger oblige à quitter puis rouvrir
l'application. « ✏️ Modifier » ramène à la saisie sans sortir. ⚠️ L'écran dit que c'est un aperçu
et qu'il ne remplace pas la relecture du PDF. ⚠️ `.ap-page` est **blanche quel que soit le thème** :
c'est du papier qu'on prévisualise.

**3. Enregistrer et partager séparés.** `pdfLivrer(doc, base, mode)` — `"save"` enregistre,
`"share"` ouvre le menu de partage, sans mode les deux sont tentés (comportement d'avant,
conservé pour les autres documents).

**4. Les tailles.** Le catalogue liste les tailles **disponibles** ; les imprimer toutes
(« 7,5×7,5 · 10×10 · 12,5×12,5 · 15×15 ») laissait le pharmacien sans savoir quoi délivrer. On en
choisit **une** à l'ajout, avec saisie libre possible. La même référence peut revenir en **deux
tailles** (plaie qui évolue), mais pas deux fois la même.

⚠️ **PIÈGE RENCONTRÉ, à connaître** : en insérant un commentaire devant `function pdfLivrer`, un
`async` orphelin est resté **avant** le commentaire. `node build.js` a validé la syntaxe, mais le
chargement s'arrêtait sur « async is not defined » — d'où des variables en zone morte temporelle
plus bas. **Confirme la règle : la vérification de syntaxe ne garantit pas que l'app démarre.**

## ⚠️ v1.4.3 — un document sortait à l'en-tête du mauvais cabinet

**Symptôme** : ordonnance pour un patient du Cabinet A → en-tête du Cabinet B, à corriger à la main.

⚠️ **CAUSE STRUCTURELLE : rien ne reliait une tournée à un cabinet.** L'app ne *pouvait pas* savoir
à quel cabinet appartenait un patient, elle prenait donc `cabinet()`, celui qui est ouvert.

Un cabinet déclare désormais ses tournées (`cab.tours`) ; `cabinetDuPatient(p)` en déduit le sien,
`cabinetPourDoc(p)` retombe sur le cabinet ouvert si rien n'est déclaré — **on ne casse rien pour
qui n'a qu'un cabinet**. ⚠️ Une tournée n'appartient qu'à **un** cabinet, sinon la question n'a pas
de réponse : les cases déjà prises sont désactivées, jamais volées en silence.

⚠️ **Deuxième correction, sans laquelle la première ne sert à rien** : `enteteDocument(ch)`
relisait `cabinet()` en interne et annulait tout. Signature devenue `enteteDocument(ch, cab)` —
ordonnance, courrier, modèles et dispositifs passent le cabinet retenu.

⚠️ **Rapprochement automatique au démarrage** : comparer les chaînes entières échouait
(« Tournée Oliviers » ne contient pas « Cabinet des Oliviers »). On compare les **mots
significatifs**, en écartant « cabinet », « tournée », les articles et les mots de moins de 3
lettres. Un seul cabinet → toutes les tournées lui reviennent. Proposé une fois (`S.cabToursInit`).

**Le lien fixe le DÉFAUT, il ne verrouille rien** : « Qui signe » et les champs d'en-tête restent
modifiables. **Vérifié jusqu'au PDF** : avec le Cabinet du Port ouvert, l'ordonnance d'une patiente
des Oliviers porte bien « Cabinet des Oliviers ».

## ⚠️ v1.4.2 — le bouton retour ramenait à l'accueil

**Symptôme signalé** : depuis Réglages → Ma fiche, « ‹ Réglages » ramenait à l'écran d'accueil.

⚠️ **`bindNav()` SANS ARGUMENT revient à l'ACCUEIL** — piège déjà connu, jamais vérifié
systématiquement. Un écran dont l'en-tête annonce « Réglages » et qui appelle `bindNav()` nu
renvoie donc l'utilisateur à la case départ.

**La revue de toute l'app en a trouvé six, pas un** : `sheetMoi`, `sheetBilans`, `sheetDetente`
(→ `sheetTours`), `sheetEssais` (→ `sheetAppPanel`), `sheetCarnet` (→ `sheetGuide`), `sheetHist`
(→ `sheetPatient(p,"hist")`).

**Un test balaie désormais tous les modules** et compare le libellé de `navHeader()` à l'argument
de `bindNav()` : tout écran qui promet un retour qu'il ne fait pas est signalé par son nom.
Les dix retours ont par ailleurs été vérifiés sur appareil simulé.

## v1.4.1 — l'écran Réglages remis d'aplomb

Quinze tuiles à plat faisaient annuaire téléphonique : rien n'y distinguait « Tournées », ouvert
chaque semaine, de « Bilans », consulté deux fois par mois.

⚠️ **Pas de nouvel interrupteur** : celui qui bascule tuiles / liste existait déjà (`S.menuMode`).
Le travail était ailleurs — **le mode liste ignorait sept entrées** (Mon cabinet, Ma fiche, Mes
notes, Souffler, et les trois outils en essai), et le mode tuiles avait reçu les nouveautés en vrac.

**Quatre sections, les mêmes dans les deux modes** : Mon travail · Mes outils · Échanges ·
L'application. ⚠️ **Si les deux modes diffèrent, changer d'affichage revient à changer
d'application** — un test compare désormais les deux découpages.

⚠️ **La liste devient le défaut** (`S.menuMode || "list"`) : elle supporte mieux la croissance.
Mais un choix déjà enregistré est respecté — on ne change pas l'écran de quelqu'un sans le prévenir.

**Vérifié** : les 28 entrées de la liste ouvrent toutes un écran, aucune ne mène dans le vide.

## v1.4.0 — Mes notes : le pense-bête privé

`www/js/notes.js` · `S.notes[]` et `S.noteEtiq[]`. Étiquettes, épingles, cases à cocher, recherche
plein texte, citation de patients.

⚠️ **STRICTEMENT PRIVÉ** : ni les notes ni les étiquettes n'entrent dans `buildSyncFile`. Demande
explicite de l'utilisateur, et c'est ce qui permet d'y écrire sans se demander qui lira. **Un test
le vérifie sur le contenu de sync.js**, pas seulement sur l'intention.

⚠️ **Ce n'est pas un dossier de soin** : une observation clinique se note dans le passage du
patient, sinon elle ne part pas dans la relève et personne ne la lit. Dit à l'écran.

⚠️ **Les étiquettes appartiennent à l'utilisateur** : six proposées, toutes renommables,
recolorables, supprimables. Supprimer une étiquette la **retire des notes qui la portaient** —
sinon elles garderaient un identifiant mort.

⚠️ **Citation de patient par sélection**, pas par saisie libre : au pouce, une arobase se trompe
de personne. Le nom affiché ouvre la fiche. `notesOublierPatient(pid)` est appelé par
`trashPatient` — **même piège que les fantômes de l'ordre de passage** (v1.0.97).

**Trois accès** : outil de barre configurable (`TOOLS.notes`), tuile dans les réglages, et
Fiche → Actions filtré sur ce patient.

## v1.3.3 — date de naissance sur les cartes, et livrables HTML

`["dob","Date de naissance"]` entre dans `CARTE_OPTS` : réglable globalement **et** par dossier,
comme les cinq autres. ⚠️ **Masquée pour tout le monde à la première ouverture** (`S.carteDobInit`)
— une option nouvelle ne doit pas apparaître sans que personne l'ait demandée, surtout une date de
naissance sur un écran ouvert chez un patient.

⚠️ Écrite en clair (`dob.split("-").reverse().join("/")`), jamais via `fmtFR` qui abrège.

**Livrables HTML** : `JMSante_Mode_emploi.html` (le manuel de l'app, déjà autonome : styles et 44
captures intégrées) et `JMSante_Guide_referent.html` (généré, 29 Ko, sommaire ancré, feuille de
style d'impression).

## v1.3.2 — documentation à jour

**Manuel de l'app** : 31 → **37 chapitres**. Ajoutés : Ma fiche et qui signe · les fonctions en
essai · Mes modèles · Mes dispositifs · Bilans · Les calculs.

**Mode d'emploi `.docx`** : 58 → **64 pages**, les 44 captures conservées à leur place.

**Guide du référent `.docx`** : 11 → **12 pages**. Ajouts : ce qui a changé depuis la v1.1 (Ma
fiche, qui signe, les essais) · encadrer un testeur · quatre questions nouvelles, dont « je ne
trouve pas les fonctions activées » et « l'app peut-elle me dire si je peux vacciner » · le
mécanisme des essais · d'où viennent les contenus de référence.

⚠️ **Le code des essais ne figure dans aucun document** — vérifié. Le guide explique le mécanisme
et précise que **le code n'est pas une sécurité**, pour qu'aucun référent ne le présente comme tel.

⚠️ Les générateurs portaient la version en dur (`v1.0.88` en pied de page) : corrigé, à vérifier
à chaque régénération.

## v1.3.1 — Bilans : tubes et repères (essai)

`www/js/bilans.js` · essai `bilans`. Deux onglets : **valeurs usuelles** (10 groupes, 45
analyses, distinction homme/femme là où elle existe) et **tubes** (ordre de prélèvement, couleurs
courantes, précautions).

⚠️ **LES VALEURS SONT INDICATIVES** : chaque laboratoire publie ses propres intervalles, qui
dépendent de sa technique et varient avec l'âge, le sexe et la grossesse. **Ce sont celles du
compte rendu qui font foi** — dit en tête d'écran, pas seulement en commentaire.

⚠️ **Les couleurs de bouchon ne sont pas universelles** : elles varient d'un fabricant à l'autre,
et l'ordre peut être précisé par le laboratoire.

⚠️ **Aucune interprétation** : l'app n'a jamais dit « cette kaliémie est basse, fais ceci ». Aucune
valeur de patient n'est saisie ici — c'est une lecture. Même ligne que les constantes, les plaies
et le guide de prescription.

**Ajustable aux valeurs du laboratoire habituel**, réversible (`essaiData("bilans").groupes`).
⚠️ L'app ne vérifie pas ce qui est saisi, et le dit.

## v1.3.0 — lots 2 et 3 : dispositifs et calculs (en essai)

### Lot 2 — `dispositifs.js`, essai `dispositifs`

Catalogue de 58 références en socle, par famille, **enrichissable**. ⚠️ **Ni code LPP, ni tarif,
ni mention de remboursement** : consigne de l'utilisateur, et c'est ce qui écarte le plus gros
risque de péremption. ⚠️ **Socle modeste et assumé** : une liste vivante qu'on complète vaut mieux
qu'un pavé qui périme en silence.

⚠️ **Retirer masque, n'efface pas** : `retires[]` cache une ligne du socle, `ajouts[]` porte les
références propres. Le socle en dur n'est jamais modifié.

Classeur Excel export/import, **mêmes trois piles que l'annuaire** — rien n'est écrasé sans être
montré. Composition d'ordonnance → PDF. ⚠️ **Jamais de document final en un clic** : c'est un
brouillon à relire, signer et imprimer.

### Lot 3 — `calculs.js`, essai `calculs`

Quatre onglets : débit (gouttes/min, ml/h, durée restante, µg/kg/min), dose (volume à prélever,
dose/poids), dilution, conversions (glycémie, IMC).

⚠️ **Aucune recommandation** : ces outils divisent et convertissent. Une division n'est pas un
conseil — c'est ce qui les garde hors du champ de l'aide à la décision.

⚠️ **Le calcul est affiché sous chaque résultat** : un nombre seul ne se vérifie pas.

⚠️ **Pas de résultat partiel** : si une valeur manque ou qu'un dénominateur est nul, rien ne
s'affiche. Un zéro trompeur serait pire que rien.

**13 cas de test à valeurs connues** vérifiés : 500 ml en 4 h à 20 gouttes/ml → 42 gouttes/min et
125 ml/h ; 5 µg/kg/min pour 70 kg avec 250 mg/50 ml → 4,2 ml/h ; 5,5 mmol/L → 0,99 g/L.
**Formules recoupées** sur Outils Infirmiers (Y. El Koutami), Pocket Infusion Calculator, Memo IDE
et le Guide du calcul de doses du CHU de Nancy.

⚠️ `calcMajResultats()` ne redessine que les résultats : redessiner l'écran ferait perdre le
curseur à chaque chiffre tapé.

## v1.2.3 — la conduite à tenir du questionnaire pré-vaccinal

`AIDE_PREVAC` dans `modeles.js` : sept situations avec « si OUI / si NON », plus la procédure et
la traçabilité. **Texte fourni par l'utilisateur**, pas rédigé par Claude — et dit comme tel.

⚠️ **L'APPLICATION NE LIT PAS LES RÉPONSES ET N'EN DÉDUIT RIEN.** Elle n'affiche jamais « tu as
coché OUI, donc ne vaccine pas ». C'est un mémo qu'on ouvre quand on veut — exactement la ligne
du guide de prescription. Si elle décidait à partir des cases cochées, elle entrerait dans l'aide
à la décision clinique et changerait de nature. Un test vérifie qu'aucun lien n'existe entre une
case et un conseil.

⚠️ **Fiche interne** : elle sort dans **son propre PDF**, jamais accolée au questionnaire du
patient, avec un bandeau ambre « ne pas remettre au patient ».

Modifiable et réversible comme les autres modèles (`essaiData("documents").aide`).

## v1.2.2 — Mes modèles : documents produits et modifiables (essai)

`www/js/modeles.js` · essai `documents`. Deux modèles : **questionnaire pré-vaccinal** et
**attestation de vaccination**, repris des documents fournis par l'utilisateur.

⚠️ **Ne pas confondre avec `docs.js`**, qui nomme les documents **scannés** d'un dossier. Ici on
**produit** des documents vierges ou pré-remplis — d'où le nom `modeles.js` (un `docs.js`
existait déjà, failli écraser).

**Deux entrées** : fiche patient → ⚡ Actions (pré-rempli : identité, date de naissance, NIR) et
Ma fiche (vierge, à imprimer d'avance). Identité et RPPS viennent de `enteteDocument()`, donc du
choix de signataire.

⚠️ **Modifiables, jamais perdus** : les modèles modifiés vivent dans `essaiData("documents")`,
l'original reste en dur. « Revenir au modèle d'origine » fonctionne toujours.

⚠️ **L'utilisateur est prévenu de ce que ça engage** : ce qu'il écrit est imprimé tel quel sur un
document qu'il signe, l'app ne relit rien. Les lignes vides sont jetées — une question vide
s'imprimerait en ligne fantôme.

⚠️ **Règle du socle respectée** : aucune écriture dans un dossier. Le PDF est enregistré et
partagé, le rattachement viendra quand la fonction sera validée — et c'est dit à l'écran.

⚠️ **Piège rencontré** : `pdfEnTete()` renvoie un **objet** `{M, L, V, G, F, y}`, pas une
ordonnée. Le prendre pour un nombre donne des coordonnées NaN et « Invalid arguments passed to
jsPDF.text ». Et sa position de retour est plus haute que la fin réelle de l'en-tête à deux
colonnes : `Math.max(tete.y + 2, 56)` évite le chevauchement.

## v1.2.1 — lot 1 : le guide relu sur l'arrêté du 26 juin 2026

`www/js/guide26.js` · `GUIDE_PRESC_26`, 8 chapitres. S'affiche à la place de `GUIDE_PRESC`
quand l'essai `guide26` est actif. ⚠️ **L'ancien n'est jamais écrasé** : il revient dès qu'on
éteint.

**Source** : arrêté du 26 juin 2026, NOR SFHH2617311A, JO du 27 juin 2026, **lu intégralement**
(annexes I et II comprises) — pas reconstitué de mémoire : le texte est postérieur à mes
connaissances. Référence et date de lecture affichées en tête du guide.

**Quatre corrections** : antiseptiques (exclusion des produits contenant un antibiotique, fenêtre
de cinq jours, exclusion du pied diabétique) · contention (« à l'identique de la force de
compression », plus de « classes 1 à 4 ») · INR (renouvellement une fois, sauf déséquilibre
constaté) · examens du diabétique (patients connus, pas d'examen dans les trois derniers mois,
condition étendue aux trois examens).

**Sept ajouts** : antalgiques de palier I · adaptation de posologie · bilan sanguin du sevrage ·
perfusion à domicile · nutrition entérale · déclaration préalable pour les vaccins (annexe I) ·
mentions du renouvellement de contraceptif (annexe II) · traçabilité exigée du pharmacien
(article 3).

⚠️ **Trois repères au lieu de deux** : `Prescription` / `Renouvellement` / `Les deux` — le
vocabulaire du texte. « Autonome » et « Conditionné » n'y figurent pas.

⚠️ **Marqueur `dmp:true` sur chaque bloc issu de l'arrêté** (article 2 : toute prescription
s'inscrit au dossier patient ou au DMP, sans exception). `dmp:false` sur ce qui vient d'ailleurs.

⚠️ **Ce qui n'est pas du texte est signalé comme tel** : le bloc sur le statut de remplaçant
(autres textes, non lus) et les bonnes pratiques, marquées « (hors texte) ».

## v1.2.0 — le socle des fonctions en essai

`www/js/essais.js` · code d'accès saisi depuis ⚙️ Application → 🧪 Fonctions en essai.
⚠️ Le code lui-même ne s'écrit **dans aucun document du dépôt** : il est lisible dans
`essais.js`, et c'est le seul endroit où il doit figurer.
Il ouvre une liste d'interrupteurs, un par fonction neuve. Trois lots déclarés : `guide26`,
`dispositifs`, `calculs`.

⚠️ **RÈGLE ABSOLUE : une fonction en essai n'écrit jamais dans les données de tournée.** Tout ce
qu'elle enregistre passe par `essaiData(cle)` → `S.essaisData`, une seule clé qu'on efface sans
toucher à un dossier. Un module qui aurait besoin de modifier un dossier patient ne peut pas être
livré en essai : il attend d'être validé.

⚠️ **Cas particulier du guide** : il remplace du contenu existant. L'ancien reste intact et
revient dès que l'interrupteur s'éteint — rien n'est écrasé.

⚠️ **Le code n'est pas une sécurité** : il évite qu'un utilisateur tombe par hasard sur une
fonction non finie. Il ne protège aucune donnée, et le code le dit en commentaire pour éviter
qu'on s'y fie un jour.

**Deux sorties** : « tout éteindre » (retour à l'application habituelle, données d'essai
conservées) et « effacer les données des essais ». **Vérifié au test** : après l'un comme l'autre,
patients, visites et tournées sont identiques au départ.

Un bandeau `essaiBandeau(cle)` coiffe chaque écran en essai, avec un bouton pour éteindre
sur-le-champ : le testeur doit savoir qu'il essuie les plâtres.

⚠️ Piège rencontré : sans `width` explicite, une case à cocher dans un conteneur flex s'étire et
casse le libellé mot à mot — même piège que `.pz-row input[type=checkbox]`.

## ⚠️ v1.1.1 — le partage d'annuaire n'envoyait rien

**Symptôme** : cocher « Joindre l'annuaire du cabinet » à l'envoi d'une synchro ne produisait
aucun effet chez le destinataire. Aucun message, aucune erreur.

⚠️ **`sync.js` lisait encore `S.cabinet`**, l'ancien modèle à cabinet unique abandonné en v1.0.72.
Il n'y trouvait plus rien, donc n'ajoutait pas le bloc `cabinet` au fichier — **silencieusement**.
La réception, elle, était intacte depuis le début.

L'envoi lit désormais `cabinet()`, comme tout le reste de l'app. La case annonce le **nom du
cabinet** et le nombre de contacts, ou « aucun contact à envoyer » — un retour muet était
précisément le problème.

**Vérifié de bout en bout** entre deux appareils simulés : envoi, question à la réception,
comparaison en trois piles, reprise contact par contact, et conservation des étiquettes
« pros seuls ».

**Leçon** : lors d'un changement de modèle de données, chercher **toutes** les lectures de
l'ancienne forme. Un test le vérifie maintenant pour `S.cabinet` dans sync.js.

## v1.1.0 — Ma fiche : l'identité quitte le cabinet

⚠️ **Le RPPS était rangé DANS CHAQUE CABINET** (`C.entete`). Avec trois cabinets, il était saisi
trois fois — et une faute de frappe quelque part faisait diverger les ordonnances selon le lieu
de travail.

`S.moi` porte désormais l'identité : nom, titre, RPPS, n° AM, portable pro, **portable personnel**,
courriel, adresse. ⚠️ Le numéro personnel **ne sort sur aucun document** — même logique que les
coordonnées « pros seuls ». Reprise automatique depuis le premier `entete` de cabinet renseigné.

**`enteteDocument(ch)` compose** : qui signe vient de `S.moi`, où joindre vient du cabinet ouvert.

**Trois formes de signature**, choisies au moment d'écrire :
`moi` · `moi, remplaçant de…` (mention portant **nom, métier et RPPS du titulaire**) · `le cabinet`
(en-tête d'un titulaire). Le choix est **retenu par cabinet** (`S.signature[cabId]`) : on remplace
souvent la même personne au même endroit.

⚠️ **L'application ne dit jamais quelle forme est réglementaire** — cela dépend du cabinet et de la
situation. Aucune mention ne s'ajoute d'elle-même, et le défaut reste « moi, sans mention ».

Les contacts **praticiens** gagnent un champ RPPS, repris dans le classeur Excel (nouvelle colonne).

## v1.0.99 — partager une sauvegarde, c'est partager TOUT

Une collègue avait reçu une sauvegarde complète : elle s'est retrouvée avec **une tournée qui ne
la concernait pas**, et surtout avec des dossiers qu'elle n'avait pas à connaître.

`exportBackup(mode, tourFiltre)` savait déjà cloisonner par tournée — mais ce chemin n'était
proposé que depuis l'écran de synchro. Le bouton **Partager** de l'écran Données envoyait tout,
sans un mot.

Il pose désormais la question, en annonçant le contenu réel (nombre de dossiers et de tournées),
et propose **l'envoi cloisonné en premier**.

⚠️ `askChoice` ignorait un `sub` par option : deux libellés sans conséquence visible ne font pas
un choix éclairé. Les options peuvent maintenant porter une explication (`.dlg-opt.dbl`).

**Reste à corriger** : `sync.js` utilise encore l'ancien `S.cabinet` (modèle à cabinet unique
abandonné en v1.0.72). Conséquence : **cocher « Joindre l'annuaire du cabinet » n'envoie rien**,
silencieusement.

## ⚠️ v1.0.98 — le pavé numérique s'ouvrait pour une adresse électronique

**Symptôme** : dans une coordonnée de contact, choisir « E-mail » puis taper ouvrait quand même
le clavier numérique.

⚠️ **`inputmode` et `placeholder` sont posés AU DESSIN**, d'après `x.type`. Changer le type
ensuite enregistrait bien la valeur, mais **ne touchait pas le champ voisin** : ses attributs
restaient ceux du premier affichage.

Le changement de type met désormais à jour `inputMode`, `type` et `placeholder` du champ.
⚠️ **Le clavier d'Android ne change qu'au prochain focus** : si le champ est déjà actif, il faut
un `blur()` suivi d'un `focus()` pour le forcer. Et rien ne touche à la valeur déjà saisie.

**Revue faite sur toute l'application** : aucun autre champ n'a de clavier dépendant d'un choix,
et aucun champ de courriel ne porte un clavier numérique au dessin.

**Leçon** : tout attribut posé au dessin à partir d'une variable modifiable doit être remis à
jour quand cette variable change — ou le rendu doit être refait.

## ⚠️ v1.0.97 — une place vide après la suppression d'un dossier

**Symptôme** : supprimer un patient — un décès — laissait un espace vide là où était sa carte.

⚠️ **`trashPatient()` retirait le dossier et ses rappels, mais PAS son identifiant des ordres** :
`patientOrder`, `slotOrder`, `slotMembers`. Un fantôme y restait et occupait une place.
`oublierPatientPartout(pid)` le retire de tous.

⚠️ **Rattrapage au démarrage** : les fantômes créés par les versions précédentes sont nettoyés
une fois, en une seule écriture.

⚠️ **Effet de bord de la correction, détecté au test** : sans remise dans les ordres, un dossier
**restauré depuis la corbeille revenait INVISIBLE** dès que les créneaux sont activés — présent
dans les données, absent de tous les écrans. La restauration le replace en fin de tournée et dans
un créneau.

**Leçon** : un identifiant de patient vit dans six endroits (patients, rappels, patientOrder,
slotOrder, slotMembers, trash). Toute suppression ou restauration doit les parcourir tous.

## ⚠️ v1.0.96 — trois défauts de saisie dans la fiche contact

**1. Le menu des métiers était celui d'Android.** Il restait une `<datalist>` sur le champ
**Complément** — les suggestions du navigateur s'ouvrent **puis se referment aussitôt**,
recouvertes par le clavier : il fallait s'y reprendre cinq à dix fois. Même correction que pour
le métier en v1.0.80 : bouton **📋 Liste** + `askChoice`, avec mémorisation de ce qui est tapé.
**Il n'y a plus aucune `datalist` dans l'application.**

**2. Le champ du numéro était minuscule.** ⚠️ `habillerSelect()` ne copiait pas le **style en
ligne** du `<select>` : un `flex:0 0 110px` restait sur l'élément caché, et le faux bouton,
en `width:100%`, prenait toute la rangée. Le style est désormais transféré au bouton.

**3. La ligne de coordonnée était trop serrée.** Type et numéro côte à côte ne tiennent pas sur
un téléphone. Le type et le bouton de retrait sur une rangée, le **numéro en pleine largeur** sur
la sienne — de quelques pixels à 346. Le clavier et l'invite s'adaptent au type choisi
(téléphone, courriel, adresse).

## v1.0.95 — trois terminaux, et la transparence des panneaux

⚠️ **`.sheet` et `.dlg-card` sont peints avec `var(--surface)`, translucide par nature.** Dans un
thème dont `--surface` vaut `rgba(…, .045)`, le voile devient invisible : **l'écran du Moniteur
transparaissait sous les réglages**, les deux textes se superposaient. Les trois thèmes rétro
donnent donc un fond **opaque** à ces deux éléments.

**Leçon** : tout nouveau thème doit être vérifié avec un panneau ouvert, pas seulement sur
l'écran d'accueil.

**Trois thèmes, un seul déblocage** (`themesDispo()` teste `S.eggs.retro`) : vert phosphore,
**Terminal ambre**, **Papier blanc**. Trois chasses au trésor pour la même surprise n'auraient
aucun sens.

⚠️ **Terminal ambre** garde `--danger:#FF5A3C` : le rouge de l'alerte y ressort sans trahir
l'époque — les tubes ambre ont existé. C'est la variante la plus sûre côté vigilance.

⚠️ **Papier blanc est un thème CLAIR** : `--amber` et `--danger` sont **assombris**
(`#8A5A00`, `#A3261A`), sinon un ambre pâle sur fond blanc serait illisible. Contraste mesuré de
l'alerte : 6,1. Et **aucun halo** — sur fond clair il salit le texte au lieu de le faire briller.

## ⚠️ v1.0.94 — l'appui long ouvrait le menu « copier » d'Android

Un appui long sur du **texte** déclenche la sélection du système et son menu contextuel : le
geste n'atteignait jamais l'application, et le jeu ne s'ouvrait pas.

**Trois propriétés sont nécessaires**, et aucune ne suffit seule en WebView :
`-webkit-user-select:none`, `user-select:none`, `-webkit-touch-callout:none` (le menu surgissant),
plus `touch-action:manipulation`. Avec, en JavaScript, un refus du `contextmenu`.

⚠️ **NE PAS appeler `preventDefault()` sur `pointerdown`** pour y arriver : sur mobile il
supprime le `click` qui suit, donc les **sept touchers** du thème rétro — les deux gestes
partagent le même élément. On se contente d'effacer la sélection en cours.

**Leçon** : tout geste long posé sur du texte doit être accompagné de ces propriétés. Un bouton
ou une icône n'a pas ce problème ; un paragraphe, si.

## v1.0.93 — le carnet des surprises

`sheetCarnet()` (eggs.js) liste les cinq surprises et leur activation.

⚠️ **Il est lui-même caché** : trois touchers sur le slogan « Tout est dans la cigale », au-dessus
du guide d'utilisation. Une liste en clair dans le guide supprimerait le plaisir de chercher —
mais ne rien écrire nulle part condamnerait les surprises à l'oubli.

⚠️ **Ce qui n'est pas trouvé n'est pas dévoilé** : on lit une énigme, pas la marche à suivre.
Un bouton « Tout me montrer » existe, et ⚠️ **ne marque rien comme trouvé** : il affiche sans
fausser le compteur.

⚠️ **Le câblage du slogan doit venir APRÈS `openSheet`** du guide — posé avec les autres
gestionnaires, l'élément n'existe pas encore et le carnet reste inaccessible. (Même piège que le
bouton du guide de prescription en v1.0.85, dans l'autre sens.)

Livrable associé : `JMSante_Carnet_surprises.docx` — il révèle tout, c'est son objet.

## v1.0.92 — les surprises

`www/js/eggs.js` · `S.eggs` garde ce qui a été trouvé. Cinq choses cachées.

⚠️ **Les règles** : jamais sur un écran patient ni pendant un soin ; jamais dans un document
imprimable ; pas de geste à balayage (ils se déclenchent seuls en tournée) — uniquement des
répétitions délibérées.

**1 · La cigale** — sept touchers sur `.brand-logo`. ⚠️ L'écouteur **n'interfère pas** avec son
rôle : pas de `preventDefault`, la mascotte ouvre toujours les réglages.

**2 · Le concert** — cinq chants de suite dans Souffler : six cigales désaccordées, synthétisées
(six oscillateurs de plus, pas un fichier son).

**3 · La 31e fiche du ciel** — révélée en cherchant « cigale ». ⚠️ N'entre **jamais** dans la
rotation hebdomadaire : `cielListe()` ne l'ajoute qu'une fois trouvée.

**4 · Le thème « Moniteur 1994 »** — sept touchers sur `.footer-note`. `secret:true` le masque
dans `themesDispo()` jusqu'au déblocage ; ⚠️ ensuite **il y reste pour toujours** — un easter egg
qu'on doit reconquérir à chaque réinstallation devient une corvée.
⚠️ **Les couleurs de vigilance gardent leur teinte** (ambre, rouge) : une alerte ne doit jamais se
fondre dans le décor. ⚠️ **Pas de halo sur les saisies** : un texte flou en tournée serait un
défaut, pas un charme. Le balayage se coupe en `prefers-reduced-motion`.

**5 · Le jeu « Tubulure »** — appui long (1,1 s) sur la version, convention d'Android.
⚠️ **Chargé à la demande** dans une `<iframe>` plein écran : 43 Ko qui n'ont rien à faire au
démarrage. ⚠️ **Le bouton ✕ Quitter reste toujours visible** (position fixe, au-dessus du cadre) —
on peut être interrompu par un patient ; Échap fonctionne aussi.
⚠️ **Ses scores vivent dans SON `localStorage`**, hors de `S` : ni sauvegarde, ni synchro, ni
dossier grossi. Le fichier ne dépend de rien d'extérieur — un test le vérifie, car une version
antérieure chargeait Tailwind et trois polices distantes, ce qui cassait la mise en page hors
connexion.

## v1.0.91 — les constantes rejoignent les réglages de carte

⚠️ **Le réglage existait déjà, mais ailleurs** : `S.cstLigneOn`, dans la rubrique « Constantes »,
alors que l'utilisateur le cherchait dans « Cartes patient » avec l'âge et les badges. Il ne l'a
pas trouvé — et ce n'était pas réglable par dossier.

`["consts", …]` entre dans `CARTE_OPTS`, donc hérite **automatiquement** des deux niveaux :
global et par patient. `ligneActive(p)` rend simplement `carteMontre("consts", p)` — **une seule
vérité**, pas un second réglage à tenir en cohérence.

⚠️ **`migrerLigneConstantes()` reprend l'ancien réglage** au démarrage : un `cstLigneOn === false`
devient un `"consts"` dans `carteMasque`, puis la clé est supprimée. Sans cela, un utilisateur qui
avait masqué la ligne l'aurait vue réapparaître.

⚠️ La case de la rubrique « Constantes » écrit désormais dans `carteMasque` et renvoie vers
l'autre écran : deux entrées, un seul état.

⚠️ **Les valeurs hors seuil restent affichées** même ligne masquée (`_altOn`) : c'est un signal de
vigilance, pas une information de confort.

## v1.0.90 — « Revoir les aides » semblait sans effet

Le bouton remet `S.aides` à zéro : les bulles 💡 de première utilisation, et la légende des
couleurs du Moniteur si elle a été repliée. **Leur retour ne se voit que sur les écrans
concernés**, plus tard — d'où l'impression qu'il ne fait rien.

⚠️ **`_doSave()` annonçait « ✓ Sauvegardé localement » pour les trois premiers enregistrements
d'une session, et RECOUVRAIT le message de l'action en cours.** On cliquait et on lisait
l'enregistrement. Le message ne sort plus que si rien d'autre n'est affiché
(`!document.querySelector("#toast.on")`) ; la pastille 💾 ✓ suffit le reste du temps.

**Leçon générale** : un message automatique qui parle après chaque action masque les messages qui
comptent. Vérifier ce point pour toute rassurance périodique.

Le bouton annonce désormais combien d'aides sont masquées, combien il en a remises, et le dit
quand il n'y a rien à faire.

## v1.0.87 — l'affichage d'une carte, dossier par dossier

`carteMontre(k, p)` : si `p.carteMasque` est un tableau, ce dossier a **son** réglage ; sinon il
suit `S.carteMasque`. Écran `sheetCartePatient(pid)` depuis Fiche → Actions.

⚠️ **UN SEUL interrupteur décide** — « suivre le réglage général ». Tant qu'il est coché,
`p.carteMasque` **n'existe pas du tout**. Sans ce choix explicite, une modification générale
resterait sans effet sur certaines cartes sans qu'on comprenne pourquoi.

⚠️ **Décocher HÉRITE du réglage général** (`[...S.carteMasque]`) : l'exception commence là où le
commun s'arrête, on ne repart pas de zéro.

⚠️ **Les signaux de vigilance ne se masquent jamais** : valeur hors seuil, jours sans selle,
patient prioritaire, absence. Un réglage d'affichage ne doit pas pouvoir cacher une alerte.

⚠️ **L'écran général ANNONCE le réglage individuel** (`.pz-note`, v1.0.88), juste après les
options — là où la question se pose — avec le chemin complet : fiche → Actions → Ce qu'affiche
sa carte. Sans cela, la fonction n'était découvrable qu'en fouillant une fiche. Écartées : un
bouton qui aurait demandé un écran de choix de patient, et une aide effaçable qu'on ne revoit
jamais.

⚠️ **`cartesAPart()` compte les exceptions** et l'écran général les annonce, avec une remise en
commun. Sans ça, on ne sait plus au bout de quelques mois quels dossiers échappent au réglage.

## v1.0.86 — la rubrique « Souffler »

`www/js/detente.js` : respirer, s'étirer, la cigale, le ciel. Tuile `data-sec="souffler"`.

⚠️ **Ce n'est pas du soin** : aucune mesure, aucun suivi, **aucun historique d'humeur** — la même
ligne que pour les constantes et les plaies. Rien ne part dans une relève. Le terme « cohérence
cardiaque » est **proscrit** : il est médical, l'app n'est pas un dispositif de soin. On dit
« une minute pour souffler ».

⚠️ **Respirer** : 4 temps inspire / 6 expire — l'expiration plus longue est ce qui apaise. La
transition CSS dure exactement le temps de la phase, sinon le cercle et le compte se décalent.

⚠️ **La cigale est SYNTHÉTISÉE** (bruit filtré + modulation, WebAudio), comme l'ECG du thème
Hôpital de nuit. Un fichier son correct pèserait des centaines de Ko pour trois secondes — dans
une app qu'on vient d'alléger de 1,35 Mo.

⚠️ **Le ciel : 30 fiches, 3 par semaine.** Il travaille une semaine sur deux, donc cinq mois
sans répétition — et le feuilletage libre reste possible. Entièrement dessiné en SVG.
`preserveAspectRatio` en **meet**, pas « slice » : celui-ci agrandissait 3,8 fois et les étoiles
devenaient des disques.

**Écarté volontairement** : le bilan d'humeur (ce serait un suivi psychologique), la playlist (le
téléphone le fait mieux), les perles de soignants (une blague sur un patient, lue par-dessus une
épaule, devient autre chose).

## ⚠️ v1.0.85 — du code s'affichait dans le guide d'utilisation

Le guide montrait `{ closeSheet(); if (typeof sheetGuidePresc === "function") … }font-style:italic;
margin:-6px 0 10px">Tout est dans la cigale`.

⚠️ **Le câblage du bouton « Guide prescription » avait été inséré DANS un gabarit HTML** — le
corps de `$("#go-guide").onclick = () => { openSheet(\`…\`) }`, un long littéral de gabarit. Il a
coupé un attribut `style` en deux, et le code s'est affiché à l'écran.

**Règle** : poser un câblage avec les autres (`$("#go-route")`, `$("#go-sante")`), **jamais après
une affectation dont le corps est un gabarit**. Chercher « le dernier `;` après le motif » atterrit
au milieu du HTML.

Un test refuse désormais tout appel de fonction dans un attribut et vérifie la position de ce
câblage — en ignorant les commentaires, qui contiennent eux-mêmes le motif recherché.

## v1.0.84 — plus aucun menu dessiné par Android

⚠️ **Un `<select>` est habillé par le SYSTÈME**, pas par l'app : fond gris, pastilles rondes,
typographie d'Android. Au milieu d'un thème Cosmos ou Hôpital de nuit, la rupture saute aux yeux
— alors que l'annuaire du cabinet, qui passe par `askChoice`, est impeccable.

`habillerSelect()` (uikit.js) remplace l'apparence sans toucher au code appelant :

⚠️ **Le `<select>` reste DANS le document**, simplement masqué (`.sel-cache`). Tout le code
existant continue de lire `.value` et d'écouter `change` — le supprimer casserait dix écrans en
silence. Le bouton émet l'événement `change` lui-même, et se met à jour si le code change la
valeur de son côté.

⚠️ **Un `MutationObserver` surveille le document** plutôt qu'un appel par rendu : les écrans se
redessinent sans arrêt, un appel serait oublié quelque part. Vérifié : un menu ajouté après coup
est habillé aussitôt.

**Restent natifs, volontairement** : les champs `type="date"` et `type="time"`, dont le sélecteur
d'Android est plus pratique que tout ce qu'on écrirait.

## v1.0.83 — l'empreinte n'ouvrait plus au démarrage

**Symptôme** : empreinte active dans les réglages, mais seul le code est demandé à l'ouverture.

⚠️ **LA cause : la clé issue du déverrouillage était créée NON exportable**
(`unwrapKey(..., false, ...)`). Elle ne pouvait donc jamais être copiée dans le coffre-fort du
téléphone — **seule la toute première création fonctionnait**, celle où la clé venait de
`generateKey` en extractable. Passée à `true` : elle reste enfermée dans la page, elle n'est
exportée que vers le matériel.

⚠️ **Le déclencheur** : activer l'empreinte **avant** d'avoir créé un code. À ce moment il n'y a
pas de coffre, donc aucune clé à déposer — mais `S.bioLock` passait à vrai et plus rien ne posait
la clé ensuite. Le message le dit maintenant, et la création du code la dépose.

⚠️ **Auto-réparation** : `reparerEmpreinte()` s'exécute après chaque ouverture, une fois l'état
chargé (600 ms) — sinon `S` est encore nul et la fonction ne sait pas si l'empreinte est
demandée.

⚠️ **Le doigt est proposé dès que l'appareil sait le lire** (`bioAppareilDispo()`), et plus
seulement si le coffre porte la marque : sans cela, une installation abîmée n'offrait aucun moyen
de se réparer.

## v1.0.82 — trois défauts de terrain

### La boîte de choix ne défilait pas

⚠️ **`.dlg-card` avait `overflow:hidden` sans hauteur maximale** : une liste de 36 métiers
dépassait l'écran, rien ne défilait, et le doigt faisait glisser **le fond**. L'app semblait
figée, il fallait la tuer. Carte limitée à `min(86vh, 86dvh)`, `.dlg-in` en `overflow-y:auto`.

⚠️ `touch-action:none` sur le voile fige le fond — mais **bloquerait aussi le contenu** sans
`touch-action:pan-y` sur `.dlg-in`.

### Le thème clair

⚠️ **`color-mix(var(--bg), #000)` assombrit TOUJOURS** : le cadre du cabinet devenait gris foncé
sous un texte sombre. Mélanger à `var(--text)` fonctionne dans les deux sens.
`var(--faint)` se délave aussi sur fond clair → `var(--muted)`. Contraste du cabinet actif :
3,5 → 11,5.

### Le démarrage allégé

⚠️ **1,35 Mo chargés à CHAQUE ouverture** — jspdf, pdfjs, jsQR, qrcode — alors qu'ils ne servent
qu'à produire un document, lire un PDF ou scanner un code. Retirés de `index.html`, chargés par
`chargerLib()` au premier usage. **2683 → 1332 Ko au démarrage.**

⚠️ Chaque point d'usage doit **attendre** sa bibliothèque : `await pdfPret()`, `await
libPdfLire()`, `await libQrLire()` — sinon l'action échouerait silencieusement au premier appel.

## v1.0.81 — partenaires groupés et documents en PDF

### Le classement à deux niveaux

`CAB_FAMILLES` (métier) → `cabSousGroupes` (spécialité, chez les médecins seulement).

⚠️ **Deux niveaux de repliement coûtent deux touchers pour atteindre un nom.** Garde-fou : on
mémorise ce qui est **fermé** (`_cabSpecFerme`), pas ce qui est ouvert — un groupe déplié montre
tout, on replie pour gagner de la place.

⚠️ **Une spécialité à un seul médecin rejoint « Autres spécialités »** quand le groupe dépasse
six : sinon on lit une page d'intertitres portant un nom chacun.

⚠️ **Une recherche ouvre ce qu'elle trouve** — filtrer sans déplier n'afficherait rien.

### Les documents en PDF

⚠️ **Un `.html` confié à Android n'ouvre qu'une visionneuse** : ni impression, ni enregistrement.
Un **PDF** est accepté directement par le pilote d'impression, et « Enregistrer au format PDF »
devient inutile. `ordonnancePdf` et `courrierPdf` (jsPDF, déjà embarqué), repli HTML si absent.

⚠️ **La police du PDF ne porte PAS les émojis** : tout texte passe par `sansEmoji()`, et la
croix de l'ordonnance est **dessinée en rectangles**, jamais écrite.

⚠️ **Le document est enregistré PUIS confié au système** : c'est là qu'Android propose
impression, partage et enregistrement.

## v1.0.80 — retours de terrain

⚠️ **« traitant » ne veut pas dire « pas de filtre »** : `cabCorrespond` rendait `true` pour ce
statut, donc la pharmacie et le VSL étaient proposés au moment d'ajouter le médecin traitant.
`cabEstMedecin()` filtre désormais sur `SPECS`.

⚠️ **Une `datalist` est inutilisable sur mobile** : la liste s'ouvre puis **disparaît sous le
clavier**, il faut fermer le clavier et rouvrir. Remplacée par un choix en plein écran
(`askChoice`), avec « Autre… » qui **mémorise** le métier saisi dans `S.cabMetiers`.

⚠️ **Une entrée de menu posée dans un seul mode d'affichage est invisible** : le guide de
prescription n'était que dans le menu en mode liste, pas dans l'écran ⚙️ Application des tuiles.

⚠️ **La liste `["pharma","cabinet"].forEach` d'`enregistrerFiche` doit suivre les champs
affichés** : un contact absent de cette liste n'est **jamais enregistré**, quoi qu'on tape.
Le laboratoire ajouté l'a été aux deux endroits.

⚠️ **Le numéro de version du manuel était écrit en dur** et restait figé (1.0.68 alors que l'app
était en 1.0.79). `build.js` l'écrit maintenant depuis `package.json`.

## v1.0.79 — séparer le choix du cabinet des rubriques

⚠️ **Deux rangées de pastilles identiques donnaient l'impression de « cliquer sur les mêmes
boutons »** : la première change de **dossier**, la seconde de **page**. Une même forme pour deux
natures différentes.

`.cab-sel` : cadre propre, fond plus sombre, libellé **🏥 CABINET**. `.cabchip` rectangulaires
(rayon 8 px) contre `.chip` rondes (99 px) pour les rubriques — **deux formes, deux natures**.
L'actif en fond plein, le `＋` en bordure pointillée.

⚠️ **Le logo ne figure qu'UNE FOIS**, sur le libellé du bloc : répété sur chaque cabinet, il
ferait passer les noms longs à la ligne (« Motsch Carole & Larosa Stéphane » remplit déjà la
largeur).

`.cab-trait` : `radial-gradient(ellipse at center, …55%, transparent 78%)` — net au centre,
disparu sur les bords.

## ⚠️ v1.0.78 — une fonction qu'on ne trouve pas n'existe pas

Le suivi de plaie fonctionnait depuis la v1.0.44 : la ligne de plaie, dans la carte du patient,
ouvrait l'écran complet — fil, notes, schéma, photos, comparaison. **Mais rien ne le disait** :
pas de chevron, pas de libellé, et l'appareil photo à droite captait l'attention. L'utilisateur
a cherché un bouton « Suivi » à ce niveau, n'en a pas trouvé, et a conclu que la fonction
manquait.

Ajouté : un chevron `›`, le **nombre de notes de suivi** dans la ligne, et « touche pour le
suivi » dans l'en-tête du bloc.

**Leçon** : une fonction accessible sans affordance est une fonction absente. À vérifier pour
tout écran qui s'ouvre au toucher d'une ligne.

## ⚠️ v1.0.77 — deux pièges déjà connus, reproduits

### `window.open` fige la WebView

L'ordonnance et le courrier appelaient `window.open` + `print()`. En navigateur c'est correct ;
dans l'app installée, **la fenêtre s'ouvre sans parent et la boîte d'impression ne rend jamais
la main** : l'application se fige, il faut la tuer.

⚠️ **Le piège était DÉJÀ documenté** dans `fiche.js` (« Le WebView Android n'implémente PAS
window.print() ») et résolu par `imprimerDocument()`, qui écrit le fichier puis le confie au
système. Les deux documents y passent désormais. Un test refuse tout `window.open` dans
`cabinet.js`.

**Leçon** : avant d'écrire une sortie imprimable, chercher comment les écrans qui fonctionnent
s'y prennent — le problème a souvent déjà été payé une fois.

### `bindNav()` sans argument revient à l'ACCUEIL

Quatorze écrans l'appelaient ainsi : depuis Fiche → Actions, un retour ramenait à la liste des
patients au lieu de l'onglet d'origine.

⚠️ `sheetPatient(p, onglet)` accepte maintenant l'onglet d'ouverture. **L'onglet ET le panneau
doivent être accordés** : marquer l'onglet actif sans basculer `.fpane` affichait le titre
« Actions » au-dessus du contenu « Identité ».

⚠️ Le **sélecteur de cabinets** était masqué tant que le premier n'était pas nommé : on ne
découvrait jamais qu'on pouvait en créer un second. Toujours affiché.

## Guide de prescription (v1.0.76)

`www/js/guide.js` — `GUIDE_PRESC` : 9 chapitres, 14 blocs, extraits du document HTML de
l'utilisateur. **Contenu figé** : aucune écriture depuis l'app, pour qu'une fausse manœuvre
n'efface pas ce travail. Une mise à jour = une nouvelle version.

⚠️ **C'est une LECTURE, jamais une donnée de soin** : rien ne se rattache à un patient, rien ne
part dans une relève.

⚠️ **L'app ne suggère RIEN.** Elle n'écrit jamais « pour cette plaie, prescris un alginate ».
Même ligne que pour les constantes et les plaies — c'est ce qui la tient hors du champ du
dispositif médical. Un test refuse tout vocabulaire de suggestion dans ce module.

⚠️ **La condition remonte sous le badge** : « Conditionné » seul ne disait pas conditionné à
quoi. Elle est alors **retirée de la liste** des champs, sinon on lit deux fois la même phrase.

⚠️ **Une recherche ouvre ce qu'elle trouve** (`ouvert = q ? true : …`) : filtrer sans déplier
n'afficherait rien.

## Ordonnance pré-imprimée (v1.0.75)

`sheetOrdonnance(pid)` → `produireOrdonnance(d)`. Mise en page reprise du `.docx` validé par
l'utilisateur, rendue en HTML : l'app n'a pas à décompresser puis recompresser un Word, et le
téléphone sait ouvrir le résultat.

⚠️ **RÈGLE ABSOLUE : une donnée absente ne laisse AUCUNE trace.** L'aide `si(v, html)` n'écrit
rien sans valeur — pastille AM, ligne courriel, nom du patient. Jamais de `{{…}}` imprimé,
jamais de cadre à moitié rempli. Une ordonnance couverte d'accolades ne s'utilise pas.

⚠️ **Date, taille et poids restent vides** — écrits à la main, décidé avec l'utilisateur.

⚠️ **Le sexe est coché d'après `p.genre`, mais corrigeable** : un genre mal saisi ne doit pas
partir imprimé sans recours.

⚠️ **`fmtFR` abrège** (« 12 avr. ») : sur une ordonnance la date de naissance doit être complète
— `dob.split("-").reverse().join("/")`.

⚠️ **Le `.docx` reste le document de référence** (livré à l'utilisateur, à faire valider) ; le
HTML doit sortir identique.

## Courrier à en-tête (v1.0.74)

`sheetCourrier(opts)` → `produireCourrier(d)` : A4, en-tête sur deux colonnes, date, destinataire,
objet, corps, espace de signature.

⚠️ **L'en-tête est une COPIE de travail** : pré-remplie depuis la fiche cabinet, modifiable pour
un document précis, **sans toucher la fiche**. Un bouton « Reporter » apparaît seulement si
quelque chose a changé, et demande confirmation.

⚠️ **Le corps peut rester vide** : la feuille à en-tête qu'on remplit à la main est le besoin le
plus courant — le bloc du corps réserve alors 90 mm.

⚠️ **Impression via `window.open` + `print()`**, repli sur l'enregistrement du fichier si la
fenêtre est bloquée (WebView).

⚠️ **AUCUNE ordonnance produite** : mentions obligatoires, responsabilité engagée. Le bouton
existe et explique l'attente. Un texte antérieur annonçait le courrier comme « prêt à l'emploi »
alors que rien n'était codé — corrigé.

## Spécialités partagées et filtrage (v1.0.73)

`SPECS` (globals.js) fait foi **des deux côtés** : `CAB_METIERS = [...SPECS, ...CAB_AUTRES_METIERS]`.

⚠️ **Un annuaire avec son propre vocabulaire rendait le filtre impossible** : on cherchait
« Pneumologue » parmi des contacts marqués « Médecin spécialiste ».

⚠️ **« Médecin généraliste » ouvre `SPECS`** et se propose par défaut à la première ligne d'un
dossier neuf. **« traitant » reste un statut porté par la fiche patient** — un généraliste n'est
traitant que pour certains.

⚠️ **`CAB_EQUIV` / `cabSpecNorm` rattrapent les anciens libellés** (« Médecin », « Docteur »,
« Diabétologue ») : sans eux, les contacts déjà saisis devenaient invisibles au filtre.
`cabCorrespond` laisse aussi passer les libellés vagues (« Médecin spécialiste »).

⚠️ **Un filtre sans résultat ne montre jamais une liste vide** : il le dit et propose l'annuaire
entier.

## Plusieurs cabinets (v1.0.72)

```
S.cabinets = [ { id, nom, adresse, tel, mail, entete, contacts:[] } ]
S.cabinetActif = id     ·     cabinet() rend celui qui est ouvert
```

⚠️ **L'ancienne `S.cabinet` est reprise telle quelle** comme premier élément : aucune saisie
perdue, aucune migration à lancer.

⚠️ **Tout ce qui sort porte sur le cabinet ACTIF** : classeur, synchro, choix « Depuis le
cabinet ». Le nom figure dans le titre de l'écran et dans celui du fichier.

⚠️ **Retirer un cabinet détache, ne vide pas** : les fiches patient gardent les contacts repris.

⚠️ **« Jours » est devenu « Complément »** (titulaire, associé, remplaçant) : c'est le statut qui
distingue les praticiens, pas leur planning. Champ **libre**, suggestions non bloquantes —
`showErrorMessage: !libre` dans les listes du classeur, sinon Excel refuse toute valeur absente
de la liste.

## La fiche cabinet (v1.0.69)

```
S.cabinet = { nom, adresse, tel, mail, entete:{nom,titre,rpps}, contacts:[] }
contact   = { id, cat:praticien|partenaire|utile, nom, metier, jours, note,
              coord:[{ type, val, vis:"patient"|"pro" }] }
fiche patient : { nom, tel, spec, cabRef, visPro }   ← une COPIE + un lien
```

⚠️ **Une LISTE de coordonnées, pas trois champs** : `tel1/tel2/tel3` plafonne toujours trop
tôt — un médecin a deux numéros aujourd'hui et quatre demain.

⚠️ **La visibilité est portée par la coordonnée**, pas par le contact : un même praticien a un
numéro public et un numéro réservé. `contactsSansNumeroPro()` filtre les documents remis au
patient — fiche imprimée, DLU, dossier RGPD. **Tout nouvel export doit passer par là.**

⚠️ **La fiche patient garde une COPIE** (`cabRef` n'est qu'un lien) : supprimer un contact de
l'annuaire **détache** les fiches, il ne les vide jamais. L'annuaire met à jour, il ne commande
pas.

⚠️ **Propager n'est jamais silencieux** : `cabPropager` annonce le nombre de fiches liées et
laisse choisir — un numéro peut changer pour les pros sans descendre chez les patients.

⚠️ **La copie privilégie une coordonnée visible du patient** ; s'il n'y a que du « pros seuls »,
elle est prise mais **marquée** `visPro`.

### L'aller-retour Excel (v1.0.70)

`exceljs.bare.min.js` (860 Ko) dans `www/js/libs/`, **chargé à la demande** par `xlsCharger()` —
jamais au démarrage.

⚠️ **Les coordonnées sont un onglet à part, une ligne par coordonnée** : des colonnes
`tel1/tel2/tel3` plafonnent toujours trop tôt. Rattachement par `ref` masquée, sinon par nom.

⚠️ **Une protection Excel se retire en trois clics.** Le vrai filet est `cabVerifierClasseur()`,
qui contrôle noms d'onglets et signature des colonnes **avant** de lire une ligne, et refuse
franchement.

⚠️ **Format texte (`numFmt = "@"`) sur les numéros** : sinon Excel mange le zéro initial.

⚠️ **Les clés des cases à cocher doivent être celles des boutons** (`n0`, `dif0`) : avec de
simples index, rien n'était coché et le premier clic inversait l'effet attendu.

⚠️ **Une coordonnée orpheline est ignorée**, jamais transformée en contact inventé.

### La synchro de l'annuaire (v1.0.71)

`buildSyncFile(tour, docIds, avecOrdre, avecAnnuaire)` — l'annuaire n'est joint **que sur
demande** (case décochée par défaut) : c'est un carnet d'adresses, pas une donnée de tournée.

⚠️ **Les étiquettes « pros seuls » voyagent** : le fichier va à un confrère, pas à un patient.
Elles restent filtrées à l'arrivée par `contactsSansNumeroPro`.

⚠️ **`cabComparer` rend une promesse résolue seulement quand l'utilisateur a tranché.** Sans
cette attente, l'écran suivant de la réception recouvrait la comparaison, qui disparaissait sans
avoir servi. Un retour ou une fermeture compte comme réponse.

**Reste à faire** : gabarits de courrier et d'ordonnance.


## ⚠️ v1.0.68 — fusion de deux lignes de travail

Deux séances ont avancé en parallèle depuis la **v1.0.57**, ancêtre commun :

- une ligne **mobile** → v1.0.58 à v1.0.67 (Moniteur en cartes, échanges chiffrés, écran
  Personnaliser, thème Cosmos, étiquettes patient, vibration)
- une ligne **PC** → signature APK, Play Store, licence, accessibilité, coffre à trois portes,
  comparaison de photos, dossier patient RGPD

⚠️ **Le même numéro a servi deux fois** (deux v1.0.58 sans rapport, deux v1.0.61) et un
`push --force` a remplacé la branche par la ligne PC. **Rien n'a été perdu** : les tags portaient
le code, et `git merge-file` a permis une fusion à trois à partir de v1.0.57.

⚠️ **Six fichiers en conflit**, tous mécaniques : `storage.js` (6 zones — le coffre englobe
l'ancienne clé), `uikit.js` (7), `sheets.js` (2), `sync.js`, `app.css`, `index.html`. Résolution :
mes ajouts englobent son état, sauf les numéros de version.

⚠️ **Leçon** : un `push --force` sur une branche partagée entre deux sessions écrase le travail
de l'autre. Les **tags** sont ce qui a sauvé la mise — toujours taguer avant de forcer.

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

## ⚠️ setup-android cherche un paquet qui n'existe plus

```yaml
- uses: android-actions/setup-android@v3
  with:
    packages: ''      # ⚠️ indispensable
```

Sans ce paramètre, l'action tente d'installer le paquet **`tools`**, retiré du dépôt SDK par
Google : `Warning: Failed to find package 'tools'` puis `exit code 1`. La compilation échoue
alors qu'il n'y a **aucun problème dans le code**.

Le runner GitHub fournit déjà le SDK ; Gradle télécharge ce qui manque.

## Déploiement PWA — l'artefact en double

⚠️ **« Multiple artifacts named github-pages »** : un artefact resté d'une tentative
interrompue s'ajoute au nouveau, et le déploiement échoue après plusieurs minutes d'attente.

`overwrite: true` sur `upload-pages-artifact` évite le doublon. En cas de blocage,
**Re-run all jobs** suffit à repartir.

⚠️ **Node.js 20 est déprécié** sur les runners GitHub depuis septembre 2025 : `checkout` et
`setup-node` passés en v5.

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

## ⚠️ Le générateur du manuel a été perdu

L'environnement de travail a été réinitialisé : `manual/gen.py`, `mkstate.py` et le jeu de
31 captures ont disparu. **Ils n'étaient pas dans le ZIP.**

Le manuel est désormais mis à jour **par insertion directe** dans `www/manuel.html` :
générer les captures avec Playwright, les encoder en JPEG base64, insérer les chapitres à
l'ancre voulue. Les captures nouvelles sont vérifiées par OCR avant insertion.

⚠️ **Tout outillage utile doit être dans le ZIP** — sinon il disparaît avec l'environnement.

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

## ⚠️ decorateChip et openSoinComment sont LOCALES à _bindUnForm

**Le défaut qui a rendu les cartes muettes pendant quatre versions.**

Ces deux fonctions dépendent du patient courant : elles sont déclarées **dans**
`_bindUnForm`. Les appeler depuis `_restoreDraft` ou `menuSoin` — des fonctions séparées —
lève `decorateChip is not defined`, et **tout le câblage suivant est perdu**.

Le défaut ne se voyait que sur les patients ayant **un brouillon ou un passage du jour** :
`_restoreDraft` n'est appelée que dans ce cas. Mes jeux de test n'en avaient aucun — la
sauvegarde réelle de l'utilisateur l'a reproduit du premier coup.

```js
decorerSoin(chip, p)          // version globale, utilisable partout
ouvrirNoteSoin(chip, p, f)    // idem
```

`_test_portee` vérifie qu'aucun appel aux versions locales ne subsiste hors de leur portée.

⚠️ **Leçon de méthode** : quand un défaut ne se reproduit pas, demander la sauvegarde
réelle. Quatre versions perdues à chercher à l'aveugle, dix minutes avec les vraies données.

## ⚠️ navHeader dessine, bindNav câble — les deux sont nécessaires

```js
openSheet(`${navHeader("Fiche", true)} …`);   // dessine « ‹ Fiche » et « ✕ »
bindNav(() => sheetPatient(p));               // SANS CECI : boutons inertes
```

**Quatre modules l'avaient oublié** — `plaies`, `recueil`, `docs`, `fiche` : le bouton
« Annuler » s'affichait et ne faisait rien. `_test_navback` compte les `navHeader()` et les
`bindNav()` de chaque module et signale tout écart.

⚠️ **Le zoom du schéma corporel est à `z-index:950`** : il s'ouvre depuis un écran de saisie
et doit passer au-dessus du voile (90) et du dialogue (900), sinon sa croix est recouverte.

## ⚠️ bindInline ne devine plus — il câble TOUT

Deviner quel formulaire câbler a échoué **deux fois** :
- chercher dans tout le document prenait parfois celui du déroulé ;
- cibler `.pcard.open` échouait quand la carte n'était pas encore dans le DOM.

```js
bindInline(p)     → câble TOUS les [data-form="id"] présents
_bindUnForm(p,f)  → le câblage réel d'un formulaire
```

Un peu de travail en trop, **jamais un bouton muet**. Et un filet : 350 ms après le rendu,
si plus de deux boutons restent sans gestionnaire, l'app **recâble une fois** et enregistre
un incident.

## (ancien) bindInline devait cibler le formulaire VISIBLE

```js
bindInline(p)              // ✗ cherche [data-form=id] dans TOUT le document
bindInline(p, racine)      // ✓ cherche dans la racine, sinon retient l'affiché
```

`inlineForm` sert **deux contextes** : la carte de la liste et le déroulé. Si un formulaire
du même patient subsiste ailleurs — déroulé masqué, rendu partiel — `querySelector` retourne
le premier trouvé, et **c'est lui qui reçoit les gestionnaires**. Les boutons visibles
restent muets, alors que le même écran fonctionne dans l'autre contexte.

`seq.js` passe `fwrap`, `ui.js` passe `.pcard.open`. En dernier recours, le formulaire dont
`offsetParent !== null` — donc affiché. Un incident est enregistré s'il y en a plusieurs.

## ⚠️ Le câblage de la carte est en chaîne — une panne casse tout

```js
f.querySelector("[data-docs]").onclick = …   // ✗ TypeError si absent
qEl(f, "data-docs").onclick = …              // ✓ objet inerte en secours
```

`querySelector` renvoie `null` quand l'élément manque : poser `.onclick` dessus lève une
**TypeError**, et **tout le câblage qui suit est perdu** — Docs, Bilans, J-1, Fiche… tous les
boutons de la carte deviennent muets d'un coup.

`qEl(f, attr)` renvoie un Proxy inerte plutôt que `null`. Le câblage des soins est en plus
isolé dans un `try/catch` : un soin qui échoue ne doit pas emporter les outils.

Une **trace de diagnostic** s'ajoute 300 ms après le rendu : si plus de deux boutons restent
sans gestionnaire, un incident est enregistré avec leurs libellés. Consultable dans
🩺 Santé de l'application.

## ⚠️ Un remplacement de code qui échoue ne dit rien

**Deux fois** le câblage d'un bouton a été perdu parce qu'un `str.replace()` cherchait un
motif déjà modifié entre-temps : le remplacement ne trouve rien, ne lève aucune erreur, et
le code part sans le gestionnaire.

**Toujours vérifier après un remplacement** — compter les occurrences, ou mieux, laisser
`_test_boutons` le faire : il contrôle que les dix boutons de la carte patient
(`data-docs`, `data-plnew`, `data-save`…) sont bien câblés quelque part dans `ui.js`.

## ⚠️ Un bouton sans gestionnaire est muet et silencieux

Poser un `<button id="f-x">` sans `$("#f-x").onclick = …` produit un bouton **visible,
cliquable, et qui ne fait rien** — aucune erreur en console. C'est arrivé au bouton
« Fiche de recueil » : le remplacement du gestionnaire avait échoué silencieusement parce
que le motif cherché ne correspondait pas au code réel.

**Toujours vérifier après avoir ajouté un bouton** : `_test_boutons` parcourt les quatre
onglets de la fiche patient et signale ceux dont `onclick` est nul.

## ⚠️ Conformité : le plan COMPLET, jamais celui du créneau

```js
planFor(p, v.slot)   // ✗ un soin coché « matin » est hors plan le soir
p.plan               // ✓ le plan complet
```

`planFor()` filtre le plan **par créneau** — utile pour afficher les soins prévus, **faux**
pour juger de la conformité. Un soin prévu le matin et fait le soir ressortait en « soins
supplémentaires », alors qu'il appartient au plan.

Le créneau dit **quand** un soin est prévu, pas **s'il** fait partie du plan.

## ⚠️ Trois blocs écrivaient la conformité chacun à sa façon

`buildSyntheseCiblee`, le format structuré et le bloc principal produisaient tous
« Plan de soins respecté » — **un seul portait les dates**. `periodeTexte(vs)` unifie :

```
✅ Plan de soins respecté du 31 août au 11 sept.
```

## Relève — choisir ce qui remonte

```
v.soinNotes    = { "Change de protection": "Selles ++" }     ← le commentaire
v.soinNotesRel = { "Distribution": true }                    ← ceux qui remontent
p.noteReleve          ← mot pour CE patient, usage unique
S.noteReleveGlobale   ← mot pour toute la relève, usage unique
```

⚠️ **`comRemonte(v, soin)` renvoie `true` si `soinNotesRel` est absent** : les passages
antérieurs à ce choix gardent leurs commentaires visibles, sinon d'anciennes relèves
perdraient leur contenu.

⚠️ **`consommerNotes()` efface les deux mots après envoi** — sans quoi ils repartiraient
dans toutes les relèves suivantes.

⚠️ **La phrase pré-remplie par J-1** (« Soins conformes au plan habituel. ») est filtrée par
`noteUtile()` : elle ne dit rien de plus que la ligne de conformité et produisait une ligne
par passage.

⚠️ **`_rapsParPatient` se calcule EN TÊTE de `buildReleve`** : le bloc des rappels s'exécute
après l'écriture des patients, donc trop tard pour l'insertion sous chaque nom.

⚠️ **« Sélection » sans tri préalable** laissait `keep` indéfini → plantage, et le bouton
d'édition semblait bloqué. On montre tout plutôt que de planter.

⚠️ **« Narrative » a été retirée** : elle ne produisait pas de prose mais une liste
chronologique — un doublon de « Structurée » à l'ordre près.

## Relève — la conformité en une ligne

⚠️ **Un passage conforme ne produit AUCUNE ligne.** Avant, chaque passage sans commentaire
relançait la liste de ses soins : sur 14 passages, la relève devenait illisible alors que
tout allait bien.

```
✅ Plan de soins respecté du 5 sept. au 11 sept.    ← une seule ligne, période incluse
💬 7 sept. ☀️ matin — Pansement : plaie propre       ← on ne sort que pour ça
```

Matin et soir sont **fondus dans la période** quand les deux sont conformes.

⚠️ **Un soin du plan absent un jour n'est PAS un écart** : bandes 3×/sem., pilulier le lundi.
L'app ne peut pas distinguer un oubli d'un soin non dû — elle ne signale rien.

⚠️ **La liste des soins n'est pas répétée** sous la ligne de conformité : elle est dans la
fiche patient.

Une période coupée par un écart reste **une seule ligne globale**, l'écart étant listé à part.

## Suivi de plaie (plaies.js)

```
PLAIE_TYPES · PLAIE_REGIONS (54 localisations) · PLAIE_ZONES_SVG (dos 15, face 18)
plaieNom(pl)              → « Escarre sacrée » (formes adjectivales usuelles)
plaieJours(pl, ref)       → durée d'ouverture, ou totale si cicatrisée
plaiePhotos(p, pl)        → documents rattachés, par date
plaiesOuvertes(p) · docPlaieOuverte(p, docId)
plaieTexteReleve(p)       → constat daté, sans jugement
plaieSilhouette(genre, vue, choisie, grand)
sheetPlaies(pid) · plaieNouvelle(pid) · plaieZoom(...)

p.plaies = [{ id, type, loc, stade, mesures, depuis, cicatriseeLe, docIds:[] }]
```

⚠️ **L'app enregistre le stade, elle ne l'interprète JAMAIS.** Pas d'alerte « plaie qui se
dégrade », pas de conclusion clinique : ce serait franchir la frontière du dispositif
médical. Question ouverte dans `CONFORMITE_A_PREPARER.md`.

⚠️ **`docPlaieOuverte`** est le garde-fou du futur ménage documentaire : une photo de plaie
encore ouverte ne doit jamais être proposée d'office à la suppression.

⚠️ **Le SVG a besoin d'`aspect-ratio`** : sans lui le navigateur devine mal la hauteur et
rogne les jambes. Le tracé va de y=2 à y=118 dans un viewBox de 100×122.

⚠️ **Chaque région du corps EST la zone cliquable** (`plaieRegionsSVG`). Les pastilles
superposées masquaient le dessin ; désormais toucher une partie la colore directement.
Un `plaieCorpsFond()` dessine le corps entier sous les régions, qui restent transparentes.

⚠️ **Le nom de la zone s'affiche HORS du SVG.** Un `<text>` dans le tracé grandit
proportionnellement au zoom et devient illisible — c'est ce qui était signalé.

⚠️ **Le suivi de plaie n'est PAS dans ⚡ Actions** : il vit dans la carte patient, entre
constantes et transmission. Une seule ligne quand il n'y a rien.

⚠️ **Les silhouettes sont schématiques**, pas anatomiques. Trois formes — les différences
tiennent aux épaules, à la taille et aux hanches, plus cheveux longs et poitrine suggérée
pour la femme.

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

## ⚠️ Le micro dans le WebView Android

**Symptôme** : « accès au micro non autorisé » dans l'app, alors que la permission Android
est accordée — et que **tout fonctionne en PWA**.

**Deux causes cumulées**, traitées dans `scripts/postcap.js` :

**1. Deux permissions, pas une.** Le greffon de dictée ajoute `RECORD_AUDIO` mais pas
`MODIFY_AUDIO_SETTINGS`. Le WebView exige les deux.

**2. Le WebView doit accorder explicitement.** `getUserMedia` échoue tant que
`WebChromeClient.onPermissionRequest()` n'accorde pas `RESOURCE_AUDIO_CAPTURE` — la
permission Android ne suffit pas. En PWA, Chrome s'en charge seul ; dans un WebView, non.

⚠️ **Étendre `BridgeWebChromeClient`, jamais le remplacer** : Capacitor y branche le choix
de fichier, le plein écran et les journaux.

⚠️ **Le dossier `android/` n'est pas dans le dépôt** : il est créé par `npx cap add android`
à la compilation. Toute personnalisation native passe par `postcap.js`.

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

## ⚠️ Conversion binaire ↔ base64 sur de gros volumes

**Le piège qui a cassé la sauvegarde en v1.0.10.**

```js
btoa(String.fromCharCode(...u8))          // ✗ 2 Mo = 2 millions d'arguments
atob(b64).split("").map(c=>c.charCodeAt(0))  // ✗ tableau de 2 millions d'éléments
```

`String.fromCharCode(...tableau)` étale **chaque octet en argument séparé** : au-delà de
quelques dizaines de milliers, la pile d'appels explose — *« Maximum call stack size
exceeded »*. Le dossier patient passait, petit ; les documents non.

```js
_b64(u8)    → conversion par tranches de 32 Ko (0x8000)
_deb64(b64) → boucle sur charCodeAt, sans tableau intermédiaire
```

Vérifié jusqu'à 5 Mo. `_test_grosdoc` couvre 0,1 / 1 / 2 / 5 Mo plus un dossier de
20 patients et 140 passages.

⚠️ **Le chiffrement gonfle les données de 33 %** (encodage base64). Sur une base très
chargée, à surveiller.

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

## Soins d'un passage — toujours passer par armerChipSoin

```
armerChipSoin(c, p, f, decorateChip, openSoinComment)
```

⚠️ **Quatre endroits créent des soins** : construction du formulaire, restauration du
brouillon, recherche de soins, « ＋ autre… », et J-1. Un `onclick = () => toggle("on")` posé
à la main donne un soin **cochable mais sans crayon, sans appui long, sans commentaire** —
c'était le cas des soins repris par J-1.

⚠️ **`decorateChip` et `openSoinComment` sont LOCALES** au formulaire : elles dépendent du
patient courant. Les passer en paramètre, ne pas les chercher globalement.

⚠️ **Le crayon n'apparaît que sur un soin coché.** Changer `classList` ne réécrit pas le
contenu : il faut appeler `decorateChip(c)` après **chaque** cochage ou décochage. J-1
décochait tout puis recochait sans redécorer.

`_test_chipsoin` vérifie que les quatre créations passent par la fonction.

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

### Ménage documentaire et tri à la réception

**Le besoin** : à 120 patients avec 4 pièces chacun, environ 850 Mo. Le volume tient
largement (8 % du quota, sauvegarde en 12 ms), mais **rien ne permet aujourd'hui de faire
le ménage dans les documents** — il faut entrer dans chaque dossier et supprimer à la main.

**Trois écrans à construire**, conçus le 9 septembre 2026 :

**1. Ménage des documents** — `🦗 → 💾 Mes données → 📎 Ménage des documents`

Filtres combinables : **type** (prescriptions, plaies, résultats…), **patient**, **âge**
(> 6 mois, > 12 mois), **poids** (> 2 Mo). Le total en Mo s'actualise à chaque changement.
Suppression par lot après confirmation.

⚠️ **Garde-fou** : une photo de plaie **encore ouverte** n'est jamais cochée d'office, même
ancienne — elle sert à mesurer l'évolution. Une plaie **cicatrisée** suit les filtres d'âge
normalement.

**2. Déclarer une plaie cicatrisée** — prérequis du point précédent

L'app ne sait pas aujourd'hui qu'une plaie est refermée. Il faut regrouper les photos d'une
même plaie **par leur précision** (« Sacrum », « Talon droit ») et pouvoir la clore avec
sa date. C'est un premier pas vers le **suivi de plaie** laissé en réserve — les deux
chantiers se rejoignent.

```
p.plaies = [{ id, localisation, ouverte:true|false, cicatriseeLe, docIds:[] }]
```

**3. Différentiel à la réception d'une synchro**

Rendu possible par la nomenclature : l'app compare **type + date** au lieu des noms de
fichiers. Trois catégories :

| Catégorie | Situation | Décision |
|---|---|---|
| **Nouveau chez toi** | rien d'équivalent dans ton dossier | prendre ou laisser |
| **Version plus récente** | même type, date postérieure à la tienne | remplacer · garder les deux · ignorer |
| **Déjà chez toi** | même type, même date | ignoré, simplement compté |

Groupés par famille avec **le poids affiché**, dépliables pour choisir à l'unité. Les photos
de plaies ne sont **jamais cochées d'office** : les plus lourdes, souvent les moins utiles.

**Ce que ça règle** : le confrère peu rigoureux qui déverse tout son stock. Tu vois le poids
par famille avant d'accepter et tu peux refuser un groupe entier.

**Quand s'y mettre** : rien d'urgent en dessous de 60 patients. Le troisième écran est le
plus utile dès que la synchro tourne à plusieurs.



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

### Moniteur : cartes ou aérée (v1.0.57)
Réglage `S.moniteurStyle` ("cartes" par défaut | "aere"), appliqué par `applyTheme()` sur `<html data-moniteur>` ; les règles des cartes sont préfixées `html:not([data-moniteur="aere"])`.

#### Piège — piège `display:block !important`
Les quatre conteneurs `#tourbar`, `#slotbar`, `#synth`, `#filters` portent la classe `.mgrp` (+ `g-ac/g-am/g-bl/g-nt` pour la couleur du liseré). Une ancienne règle force `display:block !important` sur ces conteneurs, ce qui annule le `style.display="none"` posé par ui.js sur `#slotbar` : sans habillage c'était invisible, avec une carte on aurait vu un bloc vide. Garde-fou : `.mgrp:empty{display:none !important}` (ui.js vide bien `innerHTML` quand il masque le bandeau).

### v1.0.58 — affichages au choix, code de secours, échanges protégés
**Réglages d'affichage** (`S.constStyle`, `S.cardStyle`) : posés par `applyTheme()` sur `<html data-cards>` ; les tuiles (`vitalTilesHtml`, uikit.js) lisent la **dernière valeur de chaque constante** dans `p.visits` (pas `p.mesures`, réservé aux courbes). Le sens ↑/↓ est déduit du libellé renvoyé par `alertes()` — aucune règle de seuil dupliquée. Cartes : classes `st-<statut>` sur `.pcard`, bande = `::before`.

**Aides** : `aideUne(cle, {...})`, mémoire `S.aides[cle]`, remise à zéro par « Revoir les aides ». La légende et l'avertissement « envoi libre » (`libre-avert`) utilisent la même mémoire.

**Code de verrouillage** : ⚠️ le code n'entre PAS dans la clé de chiffrement locale — c'est un verrou d'écran (la clé est dérivée au chargement, avant lecture de `S.pin`). Nouveaux codes à 6 chiffres (`S.pinLen = 6`, absent = ancien code à 4). Code de secours : `XXXX-XXXX-XXXX` (alphabet sans 0/O/1/I/L), seule son empreinte SHA-256 est gardée (`S.pinRescue`). ⚠️ `askChoice` renvoie `option.val`, pas un index.

**Échanges protégés** (sync.js, fin) : enveloppe `{ _jmsecure:1, de, tour, cree, body, locks[] }`. Contenu chiffré une fois (AES-GCM 256, clé aléatoire) ; la clé est emballée par une serrure `pw` (PBKDF2-SHA256, 600 000 it., sel aléatoire par fichier) et/ou une serrure `pair` par collègue. ⚠️ `de` et `tour` sont en clair (recherche du mot de passe retenu) : jamais de donnée patient à cet endroit. Réception : `ouvrirTexteRecu` → `ouvrirProtege` → appairages, puis mots de passe retenus (`S.pwRecus["de|tour"]`, `S.tourPw`), puis saisie ; échec = rien importé. Envois branchés : `shareSyncFile` et `exportBackup("share", tour)` (premier échange). Les sauvegardes perso et les relèves PDF/Word/HTML ne sont pas chiffrées (décision).

**Appairage** : sécurisé = ECDH P-256, codes `JMS1P.<b64url>` avec clé publique seule ; clé commune = SHA-256(secret ECDH ‖ clés publiques triées), id = SHA-256("id|"+clés) tronqué. Rapide = `JMS1K.` contenant la clé. Code de contrôle 4 chiffres dérivé de la clé. Bibliothèques ajoutées dans `www/js/libs/` : **qrcode.js** (MIT, K. Arase) et **jsQR.js** (Apache-2.0) — hors `build.js`, en cache hors ligne dans `sw.js`.

⚠️ **Caméra Android** : `postcap.js` ajoute `CAMERA` (+ `uses-feature` caméra **facultative**, sinon le Play Store exclut les appareils sans caméra) et `onPermissionRequest` n'accorde plus « tout dès que le micro est permis » : il vérifie ressource par ressource (vidéo → CAMERA, audio → RECORD_AUDIO). Première utilisation : Android demande la permission, il faut retoucher 📷.

**Tests** : `_test_affichages.js` (tuiles, bande, légende, code 6 chiffres, secours, ancien code 4 chiffres) et `_test_echanges.js` (4 appareils simulés : mot de passe, appairage sécurisé et rapide, fichier à 3 serrures, réception, écran d'envoi, oubli d'un collègue).

### v1.0.59 — clé locale v2 (lot 3)
Nouvelle clé : PBKDF2-SHA256, **600 000 itérations**, **sel aléatoire** de 16 octets stocké en clair dans `__kdf__` (`{v:2, salt, it}`). ⚠️ `__kdf__` est lu et écrit **toujours dans IndexedDB** (`_rawGet/_rawSet`), comme `__secret__`, quel que soit le backend : si le sel suivait le backend SQLite, une migration IDB → SQLite postérieure à sa création ferait tirer un nouveau sel, et tous les blocs `k:2` deviendraient illisibles. Le secret, lui, ne change pas (il sert aussi de phrase de passe SQLCipher).

Chaque bloc chiffré porte sa version : `{ _enc, iv, data, k:2 }` ; absence de `k` = ancienne clé (sel fixe `jmsante_v1`, 100 000 it.). `decryptState` essaie d'abord la clé désignée, puis l'autre. `encryptState` écrit toujours en v2 (repli v1 si la v2 est impossible, jamais en clair tant qu'une clé existe).

`migrerCleLocale()` (lancée 4 s après le démarrage) parcourt `_backKeys()` (ajout : `_sqlKeys`), rechiffre chaque `doc_*` qui n'est pas en v2 — y compris les documents encore **en clair** d'avant le chiffrement —, puis `save(true)` réécrit l'état. Un bloc illisible n'est jamais touché ; `S.kdfMigre` n'est posé que si tout est passé, sinon un incident est journalisé et on retente au lancement suivant. Interruption sans risque : la version par bloc garantit la lecture.

Coût : la dérivation v2 prend quelques centaines de millisecondes, **une fois par session** (clé gardée en mémoire). L'ancienne clé n'est plus dérivée du tout une fois la migration faite, puisque plus aucun bloc ne la réclame.

Test : `_test_cle.js` (données écrites avec l'ancienne clé → lecture, migration, document en clair chiffré au passage, redémarrage, sel stable).

### v1.0.60 — couleurs et motifs des statuts
`S.couleurs = { preset, perso:{statut:hex}, motifs, motif:{statut} }` ; statuts `todo`, `done`, `alert`, `absent` (ce dernier couvre aussi « sans passage »). `appliquerCouleurs()` (uikit.js), appelée par `applyTheme()`, pose sur `<html>` : `--st-<statut>` (seulement hors palette « JM@Santé » ou si retouche, avec `data-stc`), `--st-<statut>-img/-size` (motif en dégradés CSS) et `data-motifs`.

⚠️ Palette « JM@Santé » = **aucune variable** : les règles propres à chaque thème (néons de Tubes néon…) restent maîtresses. Les règles `html[data-stc] .pcard.st-x .st` sont volontairement plus précises que `html[data-app-theme=…] .st.x` pour l'emporter quand une palette est choisie.

Encre des motifs : noire à 50 %, blanche à 55 % si la luminance de la couleur est < 0,2 (gris foncé). Formes des pastilles en CSS pur (`::after` « ✓ » / « ! », `clip-path` triangle). Le rouge de vigilance pilote aussi `.spill.warn`, `.vitals b.bad` et les tuiles `.vtile.hi`. Garde-fou : distance RGB pondérée (« redmean ») < 110 entre deux statuts.

Test : `_test_couleurs.js`.

### v1.0.61
Carte dépliée en mode bande : `.pcard.open::before{display:none}` et marge gauche normale. Tuiles : attribut `data-vtile="<constante>"` ; `brancherTuilesSaisie(f)` (appelée avec le câblage du formulaire de la carte) cible `[data-ta-s]` pour la TA, `[data-c="<k>"]` sinon ; `brancherTuilesFiche(p)` ouvre `sheetGraphConstantes` et demande confirmation si la fiche a reçu une saisie (écouteur `input` sur `#sheet`), sinon les modifications non enregistrées seraient perdues. Tailles de pastille : `S.dotSize` → `<html data-dot="petite|moyenne|grande">` ; le `padding-right` du nom suit la taille, les formes (motifs) aussi.

### v1.0.62 — Personnaliser
`sheetPersonnaliser()` / `sheetPersoZone(z)` (uikit.js). Clés d'affichage listées dans `REGLAGES_AFFICHAGE` (réinitialisation) et `REGLAGES_PARTAGES` (= thème + affichage, sans `ouverture`) : **liste fermée**, rien d'autre n'est exporté ni importé (`_jmreglages`), les anciens réglages sont gardés dans `S._reglagesAvant` pour ↺.

**Zoom intelligent** : propriété CSS `zoom` sur `<body>` (`S.zoomApp`, 0,85–1,6) → la mise en page se recompose, les éléments fixes restent en place ; `html[data-zoomcol]` à partir de 1,3 (une colonne). Geste : écouteurs `touchmove` non passifs sur `document`, seuil de 8 % pour ne pas confondre avec un défilement à deux doigts ; Ctrl + molette. Le badge est accroché à `<html>` (hors `<body>`) pour ne pas être zoomé lui-même. **Modes** (`S.zoomMode`) : la balise viewport passe à `user-scalable=yes, maximum-scale=5` en « natif », `no/1` sinon. ⚠️ Côté Android, `postcap.js` active une fois pour toutes `setSupportZoom/setBuiltInZoomControls(true)` + `setDisplayZoomControls(false)` : c'est la balise viewport qui autorise ou bloque ensuite — changement immédiat, sans réinstallation. **Non testable hors appareil.**

**Photos et documents** : `brancherZoomImage(img)` (transform scale/translate, ×1–×5, pan, double-tap), branché par un `MutationObserver` sur `#docview` ; `#docview` porte `.zv-veil`, que le geste global ignore.

**Constantes** : `ordreConst()`, `constVisible(k, p)` (masquées globalement `S.constsMasquees`, forcées par patient `p.constsForcees`), `cstStyle(k, p)` pose `order` + `display` sur les cases `[data-ck]` de la saisie ; `vitalsHtml(c, al, thr, p)` garde toujours une valeur hors seuil. **Cartes** : `carteMontre(k)` ; l'étiquette « prioritaire », les jours sans selle, l'absence et la saisie gardée ne sont jamais masqués. **Barre d'outils** : `renderToolbar()` reconstruit `.toolbar` à partir du bouton Cigale d'origine + `S.toolbar` (5 max) ; actions `route` et `sync` ajoutées au routeur `[data-a]`.

**Thème jour/nuit** : `themeEffectif()` (plage horaire, y compris à cheval sur minuit), vérifiée chaque minute ; `data-theme-actif` sur `<html>`. **Relève** : `S.releveDefaut` → mode et format présélectionnés, tri « vigilance d'abord » (sur la copie renvoyée par `relevePool`), rappels en fin, signature. **Ouverture** : `S.ouverture` appliqué au chargement (tournée fixe, `_viewSlot`).

Test : `_test_perso.js` (37 vérifications).

### v1.0.63
Constantes en trois lieux : `S.cstMasq = { ligne, tuiles, saisie }` (migration automatique de l'ancien `S.constsMasquees`), `constVisible(k, p, lieu)`, `S.cstLigneOn` (ligne ①), `S.cstAlertesToujours` (hors seuil forcé sur la ligne ①, défaut vrai). L'option « Constantes » a quitté le contenu des cartes (`CARTE_OPTS`) pour la zone 📊. Aperçus par zone : `apercuPerso(z)` → `_moniteurApercu`, `_constsApercu`, `_carteApercu` (patient fictif « Gabryella MISTRAL » ; il porte étiquettes, anniversaire et constantes normales pour que chaque case ait un effet visible).

### v1.0.64 — thème Cosmos · NGC 3324
Septième entrée d'`APP_THEMES` (`cosmos`). Variables dans `html[data-app-theme="cosmos"]`. Scène : `majCosmos()` (appelée par `applyTheme()` et toutes les 60 s) insère `#cz-scene` en tête de `.brand` ; chaque vue est un SVG animé en **SMIL** (`sceneCosmos(vue, suffixe)`), identifiants suffixés pour que deux calques puissent coexister pendant le **fondu** (transition CSS d'opacité de 60 s, ancien calque retiré après). `vueCosmos(date)` : créneaux triés par heure, vue de la veille avant le premier créneau, substitution boréale ↔ australe selon `nuit`. ▲▼ échange les **vues** entre créneaux, les heures restent en place. Animations : `data-cz-anim` sur `<html>` (« discrètes » masque `.cz-fil`), `svg.pauseAnimations()` si « aucune », si `document.hidden` ou si `prefers-reduced-motion`. Frise : `friseCosmos()`. ⚠️ La frise lit désormais le **thème effectif** (`themeEffectif()`), sinon la bascule jour/nuit gardait la frise du thème de base. Cartes sans `backdrop-filter` (performances de défilement) ; flou réservé aux feuilles et à la barre du bas.

Test : `_test_cosmos.js` ; les six scènes passent aussi une validation XML stricte.

### v1.0.65
Étiquette « ✨ NGC 3324 » : `_ngc(x, y, k, taille)` (uikit.js) — police **Comfortaa 700** embarquée en base64 dans `app.css` (`@font-face`, 13 Ko, **SIL OFL 1.1**, licence dans `www/fonts/OFL-Comfortaa.txt` ; le fichier `.woff2` d'origine est gardé à côté), dégradé `cng<k>` animé en SMIL et halo `cgw<k>`. ⚠️ Police en base64 plutôt qu'en fichier : une URL relative dans une feuille de style peut se résoudre différemment selon Capacitor, Electron et la PWA ; le base64 marche partout et hors connexion. Rendu de repli si la police manque : Varela Round, Nunito, Trebuchet MS.

### v1.0.66 — retour haptique
`vibrer(type)` (uikit.js) : `Capacitor.Plugins.Haptics.notification({type:"SUCCESS"})`, repli `navigator.vibrate` (PWA Android). ⚠️ Nouvelle dépendance **`@capacitor/haptics` ^6** : `npm install` (workflows) + `cap sync` l'intègrent ; elle déclare elle-même la permission VIBRATE. Appels : validation depuis la carte (après `commitVisit` réussi) et depuis le déroulé (`seq.js`). Réglage `S.haptique` (défaut actif), dans la liste `REGLAGES_AFFICHAGE`. Test : `_test_haptique.js`.

### v1.0.67 — étiquettes personnalisées
`S.tagsPerso[id]` (`id` = `u_` + 8 caractères) : `{ ic, lbl, col, genre, carte, releve, route }`. **Toujours passer par `tagDef(k)`** (étiquette fournie ou personnelle) et `tousLesTags()` au lieu de `PATIENT_TAGS[k]` : la carte, la rangée d'étiquettes de la carte ouverte, le commentaire (appui long), la relève (`releve`) et la feuille de route (`route`) ont été convertis. Échanges : le paquet de synchro porte `tagsPerso` ; le premier échange et les sauvegardes l'ont via l'état. À la réception, `ouvrirTexteRecu` appelle `fusionTagsPerso()` avant tout routage (y compris après déchiffrement) : ajout des seules définitions absentes, clés et couleurs validées, **jamais d'écrasement**. Test : `_test_etiquettes.js`.
