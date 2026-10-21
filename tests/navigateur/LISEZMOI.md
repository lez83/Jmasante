# Les épreuves en navigateur réel

Les suites de `tests/` lisent le **code source**. Celles-ci font **tourner l'application** dans un
Chromium, mesurent ce qui est à l'écran et cliquent comme le ferait un doigt.

```bash
npm i -D playwright
node tests/navigateur/pw_v111.js
```

⚠️ Le chemin du navigateur est en dur en tête de chaque fichier
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) : la version attendue par le paquet npm
n'est pas toujours celle qui est installée. À adapter selon la machine.

⚠️ Les épreuves servent l'application depuis un petit serveur local sur un port à elles. Deux
épreuves lancées en même temps sur le même port se gênent — lance-les l'une après l'autre.

## Quatre pièges, à relire avant d'en écrire une nouvelle

1. **`S.firstRun = false`** avant tout. Sinon `render()` s'arrête sur l'écran de bienvenue : le
   board reste vide et les contrôles passent au vert sur du néant.
2. **`#sheet` est permanent.** C'est `#veil.on` qui dit qu'une feuille est ouverte.
3. **Le nom d'un patient est une valeur de champ**, invisible à `textContent`.
4. **La démo n'a que six dossiers**, et tous n'ont ni téléphone ni adresse : un contrôle sur les
   boutons 📞 📍 peut passer au vert sur zéro bouton. Pose les données dont tu as besoin.

## Ce qu'elles ont trouvé et qu'une relecture n'aurait pas donné

| Épreuve | Défaut |
|---|---|
| `pw_v111` | `#board` est une grille à deux colonnes : le listing y était écrasé sur une demi-largeur, les noms coupés à « M… ». La dernière pastille d'une ligne chargée **se coupait en deux**. Un raccourci de rythme effaçait le nom du médicament (redessin sans `grab()`). |
| `pw_presc` | Reproduction de la vidéo : les deux pastilles de prescripteur portaient `data-tpr=""` — **le même bouton**. |
| `pw_adr` | — |
| `pw_al` | Une alerte neuve à `on:true` : le premier toucher l'**éteignait**. |
| `pw_drag` | 1440 lectures de mise en page par geste, sur des lignes **en cours de transition** : le glisser-déposer oscillait. Mesuré, 1440 → 0. |
| `pw_search` | Cinq cas où un résultat de recherche ne menait nulle part. |
| `pw_guide` | `#toast` portait `pointer-events:none` sans exception : **aucun bouton « Annuler » n'avait jamais été cliquable**. |
| `pw_themes` | 28 règles peignaient les blocs en creux avec `--bg` : sur le thème Réunion, **contraste 1,32:1**. Vérifiée en retirant la correction — elle tombe bien sur le défaut qu'elle garde. |
| `pw_jeu` | `✕ Quitter` posé par-dessus les boutons 🏆 SCORES et 🔊 SON : **les scores étaient inatteignables**. |
| `pw_calculs` | `calcMajResultats()` appariait **une liste de noms à l'ordre des blocs** : ajouter un résultat au milieu décalait tous les suivants. Chaque bloc porte désormais un `data-cr`. |
| `pw_feuilles` | Mesuré au **nombre de pages du PDF** : à 8,1 mm de hauteur de ligne, une mention de deux lignes renvoyait la feuille serrée **au verso, à toutes les tailles**. Et deux pièges d'écriture — les normes passaient par `esc()` sur un chemin (`&gt;`) et pas sur l'autre (`>`), si bien que le contrôle restait **vert sur le code d'avant** ; et l'aperçu laisse `#fichePrev` par-dessus l'écran, où chaque clic suivant attendait trente secondes un bouton pourtant visible. Vérifiée en remettant le code d'avant : 16 contrôles tombent. |
| `pw_filigrane` | Trois choses qu'aucune relecture n'aurait données. **Un fond CSS ne s'imprime pas** : 0 pixel sur le PDF produit sans l'option « arrière-plans », qui est décochée par défaut — la marque se serait vue à l'écran et le papier serait sorti vierge. **Le zébrage du tableau découpait la cigale en bandes**, Chromium repeignant ces cellules en blanc opaque (256 lignes sur 404 sans marque) — et au passage, ce zébrage ne s'était jamais imprimé. **Vidé, le champ de mention faisait déborder la feuille sur deux pages.** |
| `pw_barre` | La règle qui réserve la place de la barre d'état du téléphone **existait**, enfermée dans `@media (display-mode: standalone)` : l'application Android est en mode `browser`, donc elle n'était **jamais** appliquée. Et l'écran du jeu, lui, l'appliquait sans condition depuis longtemps — *une correction locale à un défaut global laisse le défaut*. |
| `pw_annuler` | Quatre défauts d'un coup, et un cinquième trouvé en mesurant. Le déroulé **ne reprenait jamais sa place** (arrêté sur le 4ᵉ, on revenait sur le 1ᵉʳ) — et c'est ce qui a fait noter « pas de passage » chez un patient déjà vu. Ce bouton **ne disait rien** et son message était **faux**. Rien n'était annulable au-delà de six secondes. **Quitter une fiche patient par la flèche effaçait tout, sans un mot** — ce qui faisait croire qu'inscrire un médecin au cabinet ne marchait pas : ça n'avait jamais eu lieu. Et avec deux cabinets, le médecin partait dans **celui qui était ouvert**, pas dans celui du patient. Vérifiée contre la v1.22.0 livrée : 24 contrôles tombent. |
| `pw_themes2` | **« Vu » et « vigilance » sortaient de la même couleur** sur le thème Littoral : accent et danger tous deux en terre cuite. Aucun contrôle de contraste ne l'aurait vu — les deux étaient parfaitement lisibles. Et les quinze vignettes de l'écran de choix sortaient **identiques**, les blocs de jetons ne visant que `html[data-app-theme]`. |
| `pw_colonnes` | **La mesure du contraste regardait le mauvais fond.** Elle accusait le thème Réunion d'un texte à 3,28:1 : `.rowbox` et `.fc-l` sont transparents, et le repli sur `document.body` mesurait le **décor** du thème — un ardoise foncé *derrière* une feuille crème. L'épreuve remonte désormais la chaîne des ancêtres jusqu'au premier fond réellement peint. Le piège que `--inset` existe pour éviter, et cette fois c'est l'épreuve qui est tombée dedans. |
| `pw_barre_seq` | **Une règle CSS n'est pas un comportement.** `position:sticky;top:0` était écrit depuis des mois, avec un commentaire affirmant que la barre collait. Elle ne collait pas : `overflow-x:hidden` sur le `body` en faisait un conteneur de défilement, et un élément collé se colle au bord du SIEN — or c'est `html` qui défile. Un contrôle « la règle est bien là » serait resté vert tout ce temps. |
| `pw_med`, `pw_infos`, `pw_mail`, `pw_slots`, `pw_v112` | — |

⚠️ **`pw_calculs` ne compare pas le code à lui-même.** Chacun de ses soixante contrôles est posé
contre un nombre connu d'avance — 250 mg = 250 000 µg, G5 % dans 500 mL = 25 g, 20 000 UI à
5 000 UI/mL = 4 mL. *Un contrôle qui recalcule avec la même formule que celle qu'il garde ne garde
rien.*

Et un défaut trouvé par un simple script Node, hors navigateur : `adresseRepetition()` transformait
**« 3 rue de Toulon » en « 3 rue de »** — alors que le commentaire juste au-dessus prétendait que ce
cas était protégé.

## Un piège qui ne vient pas du navigateur

⚠️ **jsdom n'a pas `CSS.escape`**, et les suites statiques de `tests/` tournent dans jsdom.
`_restoreDraft` s'en sert pour retrouver la pastille d'un soin : sans calfeutrage, la reprise d'une
saisie gardée lève « CSS is not defined » et la suite tombe sur un DOM à moitié dessiné. Le
correctif a longtemps vécu dans une **copie locale** du dossier d'exécution — invisible au dépôt,
et perdu au premier recopiage des épreuves. Il est désormais **dans `_test_draft.js`**. Si une
nouvelle suite statique touche à la reprise d'une saisie, elle a besoin du même calfeutrage.

*Un rapiéçage qui ne vit pas dans le dépôt n'existe pas.*

## Une mesure qui ne voit pas ce qu'elle mesure ne dit rien

⚠️ Le premier jet de `pw_filigrane` comptait les pixels « assez verts » et annonçait **90 pixels
de filigrane** sur une page qui en portait **23 714** : à 22 % d'opacité, les traits antialiasés
tombent sous n'importe quel seuil de teinte. Pour une marque pâle, on compare **la page avec et la
page sans**, pixel à pixel — jamais une couleur à un seuil.

## Simuler une encoche sans téléphone

⚠️ `env(safe-area-inset-top)` vaut 0 sur un écran d'ordinateur, et aucun outil de Playwright ne
permet de le forcer. Mais toute l'application lit la variable `--sbtop`, jamais `env()` en direct :
`pw_barre` la pose à la main, ce qui est **exactement le chemin qu'emprunte un téléphone qui ne
déclare rien**, et mesure le haut du bandeau. C'est aussi pour ça que le réglage manuel existe.

## Vérifier en rouge contre la version LIVRÉE, pas contre un code rapiécé

⚠️ Pour `pw_annuler`, remettre « le code d'avant » à la main aurait voulu dire défaire cinq
corrections dans six fichiers — autant d'occasions de se tromper de cible et de croire l'épreuve
sévère alors qu'elle tombe sur autre chose. On restaure donc **le `www/` du zip de la version
précédente**, on reconstruit, on lance : c'est le code d'avant, exactement.

⚠️ Et une épreuve qui garde du code absent doit **tomber, pas planter** : sans `?.` et sans
`typeof x === "function"`, la première fonction manquante arrête tout et la liste rouge ne dit
qu'un défaut sur vingt-quatre.

## Une liste recopiée dans une épreuve est une liste qui vieillit

⚠️ `pw_themes` portait **neuf thèmes écrits en dur**. Les deux ajoutés en v1.24.0 n'y figuraient
pas : l'épreuve passait au vert **sans les avoir regardés**, et aurait laissé passer n'importe
quel défaut de contraste sur eux. Elle lit désormais `APP_THEMES` dans l'application.

⚠️ Et quand un invariant d'épreuve devient faux parce que le besoin a changé — ici « `--inset`
égal à `--bg` partout sauf Réunion », cassé par deux thèmes qui le déclarent exprès — on **réécrit
la règle vers ce qu'elle protégeait vraiment** (du texte lisible sur le creux), on ne l'efface pas
et on n'ajoute pas une exception de plus.

## Mesurer la couleur, pas seulement le contraste

⚠️ Deux couleurs peuvent être **parfaitement lisibles toutes les deux et impossibles à
distinguer l'une de l'autre**. Pour tout ce qui porte un sens par la couleur — vu, à voir,
vigilance — on mesure l'**écart** entre elles (somme des écarts R+G+B, seuil 60), jamais leur seul
contraste avec le fond.

## Un contrôle qui passe sur les deux versions est parfois le plus important

`pw_colonnes` compte 61 contrôles : **50 tombent** sur le `www/` de la v1.24.0, et **3 passent sur
les deux versions**. Ces trois-là sont les plus précieux de l'épreuve — ils gardent l'invariant
« une fiche où rien n'a été composé sort la feuille d'avant, **mot pour mot** ». Leur échec ne
voudrait pas dire « la nouveauté manque », il voudrait dire « la nouveauté a cassé les quarante
dossiers existants ».

⚠️ Et c'est la **comparaison de chaîne** qui les rend utiles, pas un contrôle de forme : l'en-tête
d'origine n'affichait l'unité que sur la **seule** colonne de la douleur, les quatre autres
constantes n'en montraient aucune. Un contrôle du genre « chaque colonne a son unité » aurait été
vert tout en ayant changé la feuille de tout le monde.

## Mesurer une largeur, pas lire un attribut

⚠️ `width:14%` dans le HTML ne prouve pas que la case fait 14 % de la page : avec
`table-layout:fixed`, une case de trop ne s'ajoute pas au tableau, **elle sort de la page sans un
mot**. Les largeurs sont donc rendues à la taille d'une A4 et mesurées au
`getBoundingClientRect`, et un contrôle vérifie que **la somme des cases fait la largeur du
tableau**.

⚠️ **À la bonne largeur de fenêtre.** La feuille est bornée à 210 mm par son propre CSS d'écran :
mesurée dans la fenêtre de 430 px des autres épreuves, elle serait comprimée et toutes les
mesures seraient fausses. Contexte dédié à 1000 px.

## Garder le besoin, pas la mise en page

Premier jet du contrôle de `pw_barre_seq` : « la barre est à `top >= 0` à tous les défilements ».
Il est **tombé sur le code neuf**, et il avait tort : tant que la barre n'a pas atteint le haut,
elle est encore dans le flux, à 479 px, et c'est exactement ce qu'on veut. Le besoin était
*« qu'elle reste visible en permanence »* — donc **entièrement dans l'écran**, pas collée au bord.

⚠️ Quand un contrôle tombe sur du code qu'on vient d'écrire et qu'on sait juste, la première
question n'est pas « quel est le défaut » mais **« qu'est-ce que je croyais garder »**. Ici, une
mise en page au lieu d'un besoin.

## Ce qui est mesuré ici

- La position de la barre à **quatre hauteurs de défilement**, puis tout en bas du formulaire —
  jamais la valeur de `position` dans la feuille de style.
- Sa **hauteur rendue**, pleine et resserrée (131 → 80 px), pas le nombre de règles qui la
  resserrent.
- La **réserve de barre d'état** : réglage à 44 px → premier bouton à 50 px ; réglage
  automatique sur un appareil qui ne déclare rien → aucune place perdue.
- Le **non-débordement horizontal**, thème par thème, dans le déroulé et dehors : c'est la
  contrepartie du correctif, la ligne retirée l'empêchait en double. Ces contrôles-là passent sur
  les deux versions, et c'est leur rôle.
