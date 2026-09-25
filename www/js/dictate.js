/* ============================================================
   DICTÉE — on passe la main au clavier du téléphone
   ─────────────────────────────────────────────────────────
   ⚠️ Avant : le bouton tentait une reconnaissance vocale, d'abord
   par un plugin natif JAMAIS installé dans le projet, puis par celle
   du navigateur — qui exige une connexion et se comporte mal dans
   une WebView Android. Résultat : une dictée qui marchait une fois
   sur deux.

   ⚠️ AUCUNE application ne peut déclencher le micro du clavier :
   c'est une fonction du clavier lui-même, hors de portée d'une page
   web. Tout ce qu'on peut faire, et qu'on fait ici, c'est ouvrir le
   clavier sur le bon champ, curseur en fin de texte. L'utilisateur
   appuie ensuite sur SON micro, celui qu'il connaît, qui marche hors
   ligne et dans sa langue.

   ⚠️ Ne touche PAS au micro des messages vocaux (vocal.js) : celui-là
   enregistre un fichier sonore sans chercher à le comprendre, et
   fonctionne très bien.
============================================================ */
let _dictHintVu = false;

function dictate(t, b){
  if (!t){ toast("Champ introuvable."); return; }
  /* Curseur en fin de texte : la dictée s'ajoute à la suite */
  try {
    t.focus({ preventScroll:false });
    const n = (t.value || "").length;
    if (t.setSelectionRange) t.setSelectionRange(n, n);
  } catch(e){}
  if (t.scrollIntoView) t.scrollIntoView({ block:"center", behavior:"smooth" });

  /* Le rappel une fois par session : au-delà, c'est du bruit */
  if (!_dictHintVu){
    _dictHintVu = true;
    toast("Appuie sur le 🎤 de ton clavier pour dicter");
  }
  if (b){ b.classList.add("on"); setTimeout(() => b.classList.remove("on"), 600); }
}
