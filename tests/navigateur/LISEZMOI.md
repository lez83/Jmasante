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

Et un défaut trouvé par un simple script Node, hors navigateur : `adresseRepetition()` transformait
**« 3 rue de Toulon » en « 3 rue de »** — alors que le commentaire juste au-dessus prétendait que ce
cas était protégé.
