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
